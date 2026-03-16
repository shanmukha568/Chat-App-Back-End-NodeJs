import { ConversationModel } from "../models/conversationModel.js";
import { UserModel }         from "../models/userModel.js";
import { normalizeUser, normalizeConversationListItem } from "../utils/normalize.js";

export const ConversationService = {

  async getOrCreate(requesterId, recipientId) {
    const recipient = await UserModel.findById(recipientId);
    if (!recipient) {
      const err = new Error("Recipient not found");
      err.status = 404;
      throw err;
    }

    const conversation = await ConversationModel.getOrCreate(requesterId, recipientId);

    // Because getOrCreate normalises order (smaller UUID = user1_id),
    // we must check which side IS the requester, not assume.
    const participantId =
      conversation.user1_id === requesterId
        ? conversation.user2_id
        : conversation.user1_id;

    const participant = await UserModel.findById(participantId);
    return {
      id: conversation.id,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      participantId: participant?.id ?? null,
      participant: normalizeUser(participant),
    };
  },

  async getAllForUser(userId) {
    const rows = await ConversationModel.findAllForUser(userId);
    return rows.map(normalizeConversationListItem);
  },
};
