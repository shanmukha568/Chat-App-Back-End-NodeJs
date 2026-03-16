import { MessageModel }      from "../models/messageModel.js";
import { ConversationModel } from "../models/conversationModel.js";

export const MessageService = {

  async send({
    conversation_id,
    sender_id,
    message_type   = "text",
    message_text,
    image_base64,
    image_mime_type,
    image_file_name,
    image_file_size,
  }) {
    // Verify conversation exists and sender is a participant
    const conv = await ConversationModel.findById(conversation_id);
    if (!conv) {
      const err = new Error("Conversation not found"); err.status = 404; throw err;
    }
    if (conv.user1_id !== sender_id && conv.user2_id !== sender_id) {
      const err = new Error("Not a participant of this conversation"); err.status = 403; throw err;
    }

    // Insert message row
    const message = await MessageModel.create({
      conversation_id,
      sender_id,
      message_type,
      message_text,
    });

    // Attach image data if this is an image message
    if (message_type === "image" && image_base64) {
      await MessageModel.attachImage(message.id, {
        image_base64,
        mime_type: image_mime_type || "image/jpeg",
        file_name: image_file_name || null,
        file_size: image_file_size || null,
      });
    }

    // Bump conversation activity timestamp
    await ConversationModel.touch(conversation_id);

    // Re-fetch so the response always includes the image join columns
    return MessageModel.findById(message.id);
  },

  async getHistory(conversationId, { limit = 50, page = 1 } = {}) {
    const offset   = (page - 1) * limit;
    const messages = await MessageModel.findByConversation(conversationId, { limit, offset });
    const total    = await MessageModel.countByConversation(conversationId);
    return {
      messages,
      total,
      page,
      limit,
      hasMore: offset + messages.length < total,
    };
  },

  async updateStatus(messageId, status) {
    const updated = await MessageModel.updateStatus(messageId, status);
    if (!updated) {
      const err = new Error("Message not found"); err.status = 404; throw err;
    }
    return MessageModel.findById(messageId);
  },

  async markConversationRead(conversationId, userId) {
    return MessageModel.markConversationSeen(conversationId, userId);
  },
};
