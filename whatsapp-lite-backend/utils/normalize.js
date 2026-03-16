function toBool(v) {
  return v === true || v === 1 || v === "1";
}

function toDataUrl(base64, mime) {
  if (!base64 || typeof base64 !== "string") return null;
  if (base64.startsWith("data:")) return base64;
  const safeMime = (mime && typeof mime === "string") ? mime : "image/jpeg";
  return `data:${safeMime};base64,${base64}`;
}

export function normalizeUser(row) {
  if (!row) return null;
  const phone = row.phone_number ?? row.phone ?? row.phoneNumber ?? null;
  return {
    id: row.id,
    name: row.name ?? null,
    email: row.email ?? null,
    phone,
    phoneNumber: phone,
    avatar: toDataUrl(
      row.avatar_base64 ?? row.avatarBase64 ?? row.avatar,
      row.avatar_mime_type ?? row.avatarMimeType ?? row.avatarType
    ),
    isOnline: toBool(row.is_online ?? row.isOnline),
    lastSeen: row.last_seen ?? row.lastSeen ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
  };
}

export function normalizeMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversationId: row.conversation_id ?? row.conversationId,
    senderId: row.sender_id ?? row.senderId,
    senderName: row.sender_name ?? row.senderName ?? null,
    type: row.message_type ?? row.type ?? "text",
    content: row.message_text ?? row.content ?? "",
    status: row.status ?? "sent",
    createdAt: row.sent_at ?? row.createdAt ?? null,
    deliveredAt: row.delivered_at ?? row.deliveredAt ?? null,
    seenAt: row.seen_at ?? row.seenAt ?? null,
    image: row.image_base64 ?? row.image ?? null,
    imageType: row.image_mime_type ?? row.imageType ?? null,
    imageFileName: row.image_file_name ?? row.imageFileName ?? null,
  };
}

export function normalizeConversationListItem(row) {
  if (!row) return null;

  const participant = {
    id: row.participant_id,
    name: row.participant_name ?? null,
    phone: row.participant_phone ?? null,
    phoneNumber: row.participant_phone ?? null,
    avatar: toDataUrl(row.participant_avatar_base64 ?? null, row.participant_avatar_mime_type ?? null),
    isOnline: toBool(row.participant_is_online),
    lastSeen: row.participant_last_seen ?? null,
  };

  const lastMessage = row.last_message_id
    ? {
        id: row.last_message_id,
        type: row.last_message_type ?? "text",
        content: row.last_message_text ?? "",
        status: row.last_message_status ?? "sent",
        createdAt: row.last_message_sent_at ?? null,
        isOwn: toBool(row.last_message_is_mine),
      }
    : null;

  return {
    id: row.id,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    participantId: row.participant_id ?? null,
    participant,
    lastMessage,
    unreadCount: Number(row.unread_count ?? 0) || 0,
  };
}
