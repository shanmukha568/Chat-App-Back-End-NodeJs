import { UserModel }               from "../models/userModel.js";
import { ok, notFound, fail }      from "../utils/response.js";
import { normalizeUser }           from "../utils/normalize.js";

const ALLOWED_AVATAR_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]);
const MAX_AVATAR_BYTES = 600 * 1024; // ~600 KB

function parseDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return { base64: null, mime: null };
  if (!dataUrl.startsWith("data:")) return { base64: dataUrl, mime: null };
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return { base64: null, mime: null };
  return { mime: match[1].toLowerCase(), base64: match[2] };
}

function estimateBytesFromBase64(base64) {
  if (!base64 || typeof base64 !== "string") return 0;
  const cleaned = base64.replace(/[\r\n\s]/g, "");
  const padding = cleaned.endsWith("==") ? 2 : cleaned.endsWith("=") ? 1 : 0;
  return Math.floor((cleaned.length * 3) / 4) - padding;
}

// Removed dead import of ConversationService — it was never used here

export const UserController = {

  // GET /api/users?q=optional_search
  async getAll(req, res, next) {
    try {
      const q     = req.query.q?.trim();
      const users = q
        ? await UserModel.search(q, req.user.id)
        : await UserModel.findAllExcept(req.user.id);
      return ok(res, { users: users.map(normalizeUser) });
    } catch (err) { next(err); }
  },

  // GET /api/users/:id
  async getById(req, res, next) {
    try {
      const user = await UserModel.findById(req.params.id);
      if (!user) return notFound(res, "User not found");
      return ok(res, { user: normalizeUser(user) });
    } catch (err) { next(err); }
  },

  // GET /api/users/:id/status
  async getStatus(req, res, next) {
    try {
      const user = await UserModel.findById(req.params.id);
      if (!user) return notFound(res, "User not found");
      return ok(res, { isOnline: Boolean(user.is_online), lastSeen: user.last_seen });
    } catch (err) { next(err); }
  },

  // GET /api/auth/me
  async getMe(req, res, next) {
    try {
      const user = await UserModel.findById(req.user.id);
      if (!user) return notFound(res, "User not found");
      return ok(res, { user: normalizeUser(user) });
    } catch (err) { next(err); }
  },

  // PUT /api/users/me/avatar
  async updateMyAvatar(req, res, next) {
    try {
      const avatar = req.body?.avatar ?? req.body?.image ?? null;

      if (!avatar) {
        await UserModel.updateAvatar(req.user.id, { avatar_base64: null, avatar_mime_type: null });
        const updated = await UserModel.findById(req.user.id);
        return ok(res, { user: normalizeUser(updated) }, "Avatar removed");
      }

      const { base64, mime } = parseDataUrl(avatar);
      const mimeType = (mime ?? req.body?.avatarMimeType ?? req.body?.imageType ?? "image/jpeg").toLowerCase();

      if (!ALLOWED_AVATAR_MIME.has(mimeType)) {
        return fail(res, "Unsupported avatar type", 400, [`Allowed: ${Array.from(ALLOWED_AVATAR_MIME).join(", ")}`]);
      }

      const approxBytes = estimateBytesFromBase64(base64);
      if (!base64 || approxBytes <= 0) {
        return fail(res, "Invalid avatar payload", 400, ["avatar must be a base64 data URL"]);
      }
      if (approxBytes > MAX_AVATAR_BYTES) {
        return fail(res, "Avatar too large", 413, [`Max size is ${(MAX_AVATAR_BYTES / 1024).toFixed(0)} KB`]);
      }

      await UserModel.updateAvatar(req.user.id, { avatar_base64: base64, avatar_mime_type: mimeType });
      const updated = await UserModel.findById(req.user.id);
      return ok(res, { user: normalizeUser(updated) }, "Avatar updated");
    } catch (err) { next(err); }
  },
};
