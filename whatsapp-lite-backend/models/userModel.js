import pool from "../config/db.js";
import { v4 as uuid } from "uuid";

const LEGACY_SAFE_COLS = "id, name, email, phone_number, is_online, last_seen, created_at";
const AVATAR_SAFE_COLS = "id, name, email, phone_number, avatar_base64, avatar_mime_type, is_online, last_seen, created_at";

let _safeCols = AVATAR_SAFE_COLS;

function isMissingAvatarColumnError(err) {
  return err?.code === "ER_BAD_FIELD_ERROR" && /avatar_(base64|mime_type)/i.test(err?.message ?? "");
}

async function executeSelectWithFallback(sql, params) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (err) {
    if (!isMissingAvatarColumnError(err) || _safeCols === LEGACY_SAFE_COLS) throw err;
    _safeCols = LEGACY_SAFE_COLS;
    const legacySql = sql.replace(AVATAR_SAFE_COLS, LEGACY_SAFE_COLS);
    const [rows] = await pool.execute(legacySql, params);
    return rows;
  }
}

export const UserModel = {

  async create({ name, email, phone_number, password }) {
    const id = uuid();
    await pool.execute(
      `INSERT INTO users (id, name, email, phone_number, password)
       VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        name.trim(),
        email?.trim().toLowerCase() || null,
        phone_number.trim(),
        password,
      ]
    );
    return this.findById(id);
  },

  async findById(id) {
    const rows = await executeSelectWithFallback(
      `SELECT ${_safeCols} FROM users WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] ?? null;
  },

  // Returns password hash too — only used internally for auth checks
  async findByPhone(phone_number) {
    try {
      const [rows] = await pool.execute(
        `SELECT id, name, email, phone_number, password, avatar_base64, avatar_mime_type, is_online, last_seen, created_at
         FROM   users
         WHERE  phone_number = ?
         LIMIT  1`,
        [phone_number.trim()]
      );
      return rows[0] ?? null;
    } catch (err) {
      if (!isMissingAvatarColumnError(err)) throw err;
      _safeCols = LEGACY_SAFE_COLS;
      const [rows] = await pool.execute(
        `SELECT id, name, email, phone_number, password, is_online, last_seen, created_at
         FROM   users
         WHERE  phone_number = ?
         LIMIT  1`,
        [phone_number.trim()]
      );
      return rows[0] ?? null;
    }
  },

  async findAllExcept(userId) {
    const rows = await executeSelectWithFallback(
      `SELECT ${_safeCols}
       FROM   users
       WHERE  id <> ?
       ORDER BY is_online DESC, name ASC`,
      [userId]
    );
    return rows;
  },

  async search(query, excludeId) {
    const q = `%${query}%`;
    const rows = await executeSelectWithFallback(
      `SELECT ${_safeCols}
       FROM   users
       WHERE  id <> ?
         AND  (name LIKE ? OR phone_number LIKE ?)
       ORDER BY is_online DESC, name ASC
       LIMIT  20`,
      [excludeId, q, q]
    );
    return rows;
  },

  async updatePassword(phone_number, hashedPassword) {
    const [result] = await pool.execute(
      `UPDATE users SET password = ? WHERE phone_number = ?`,
      [hashedPassword, phone_number.trim()]
    );
    return result.affectedRows > 0;
  },

  async setOnlineStatus(id, isOnline) {
    await pool.execute(
      `UPDATE users SET is_online = ?, last_seen = NOW() WHERE id = ?`,
      [isOnline ? 1 : 0, id]
    );
  },

  async updateAvatar(id, { avatar_base64 = null, avatar_mime_type = null } = {}) {
    try {
      const [result] = await pool.execute(
        `UPDATE users
         SET avatar_base64 = ?, avatar_mime_type = ?
         WHERE id = ?`,
        [avatar_base64, avatar_mime_type, id]
      );
      return result.affectedRows > 0;
    } catch (err) {
      if (isMissingAvatarColumnError(err)) {
        const e = new Error("Avatar columns are missing in DB. Run scripts/add_user_avatar.sql first.");
        e.status = 500;
        throw e;
      }
      throw err;
    }
  },
};
