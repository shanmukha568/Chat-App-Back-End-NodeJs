import { MessageService }                from "../services/messageService.js";
import { MessageModel }                  from "../models/messageModel.js";   // ← static import (was dynamic)
import { ConversationModel }             from "../models/conversationModel.js";
import { ok, fail, notFound, forbidden } from "../utils/response.js";
import { validateSendMessage, validateUpdateStatus } from "../utils/validate.js";

export const MessageController = {

  // GET /api/messages/:conversationId?page=1&limit=50
  async getHistory(req, res, next) {
    try {
      const conv = await ConversationModel.findById(req.params.conversationId);
      if (!conv) return notFound(res, "Conversation not found");
      if (conv.user1_id !== req.user.id && conv.user2_id !== req.user.id)
        return forbidden(res, "Access denied");

      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const page  = Math.max(Number(req.query.page)  || 1,  1);
      const result = await MessageService.getHistory(req.params.conversationId, { limit, page });
      return ok(res, result);
    } catch (err) { next(err); }
  },

  // POST /api/messages/send
  async send(req, res, next) {
    try {
      const body = {
        conversation_id: req.body?.conversation_id || req.body?.conversationId,
        sender_id: req.user.id,
        recipient_id: req.body?.recipient_id || req.body?.recipientId,
        message_type: req.body?.message_type || req.body?.type || "text",
        message_text: req.body?.message_text || req.body?.content || req.body?.messageText,
        image_base64: req.body?.image_base64 || req.body?.image || null,
        image_mime_type: req.body?.image_mime_type || req.body?.imageType || null,
        image_file_name: req.body?.image_file_name || req.body?.imageFileName || null,
        image_file_size: req.body?.image_file_size || req.body?.imageFileSize || null,
      };
      const errors = validateSendMessage(body);
      if (errors.length) return fail(res, "Validation failed", 400, errors);

      const message = await MessageService.send(body);

      // Broadcast over Socket.IO
      const io = req.app.get("io");
      io.to(message.conversationId ?? message.conversation_id).emit("receive_message", message);
      if (body.recipient_id) {
        io.to(`user:${body.recipient_id}`).emit("receive_message", message);
      }

      return ok(res, { message }, "Message sent", 201);
    } catch (err) { next(err); }
  },

  // PUT /api/messages/status
  async updateStatus(req, res, next) {
    try {
      const body = {
        message_id: req.body?.message_id || req.body?.messageId,
        status: req.body?.status,
      };
      const errors = validateUpdateStatus(body);
      if (errors.length) return fail(res, "Validation failed", 400, errors);

      const message = await MessageService.updateStatus(body.message_id, body.status);

      const io = req.app.get("io");
      const conversationId = message.conversationId ?? message.conversation_id;
      io.to(conversationId).emit("update_message_status", {
        messageId:      message.id,
        conversationId,
        status:         message.status,
      });

      return ok(res, { message });
    } catch (err) { next(err); }
  },

  // PATCH /api/messages/:conversationId/read
  async markRead(req, res, next) {
    try {
      const updated = await MessageService.markConversationRead(
        req.params.conversationId,
        req.user.id
      );
      return ok(res, { updated });
    } catch (err) { next(err); }
  },

  // DELETE /api/messages/:messageId
  async deleteMessage(req, res, next) {
    try {
      const deleted = await MessageModel.softDelete(req.params.messageId, req.user.id);
      if (!deleted) return notFound(res, "Message not found or not yours");
      return ok(res, {}, "Message deleted");
    } catch (err) { next(err); }
  },
};
