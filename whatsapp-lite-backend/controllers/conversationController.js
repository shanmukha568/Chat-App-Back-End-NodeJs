import { ConversationService } from "../services/conversationService.js";
import { ok, fail }            from "../utils/response.js";

export const ConversationController = {

  // GET /api/conversations
  async getAll(req, res, next) {
    try {
      const conversations = await ConversationService.getAllForUser(req.user.id);
      return ok(res, { conversations });
    } catch (err) { next(err); }
  },

  // POST /api/conversations
  async getOrCreate(req, res, next) {
    try {
      const recipientId = req.body?.recipient_id || req.body?.recipientId;
      if (!recipientId) return fail(res, "recipientId is required");
      const conversation = await ConversationService.getOrCreate(req.user.id, recipientId);
      return ok(res, { conversation });
    } catch (err) { next(err); }
  },
};
