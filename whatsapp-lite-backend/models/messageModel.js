import pool from "../config/db.js";
import { v4 as uuid } from "uuid";
import { normalizeMessage } from "../utils/normalize.js";

// Reusable SELECT fragment with image JOIN
const SELECT_WITH_IMAGE = `
  SELECT
    m.id,
    m.conversation_id,
    m.sender_id,
    u.name          AS sender_name,
    m.message_type,
    m.message_text,
    m.status,
    m.sent_at,
    m.delivered_at,
    m.seen_at,
    mi.image_base64,
    mi.mime_type    AS image_mime_type,
    mi.file_name    AS image_file_name
  FROM   messages m
  JOIN   users    u  ON u.id = m.sender_id
  LEFT JOIN message_images mi ON mi.message_id = m.id
`;

export const MessageModel = {

  // ── Create message row ────────────────────────────────────────────────────
  async create({ conversation_id, sender_id, message_type = "text", message_text }) {
    const id = uuid();
    await pool.execute(
      `INSERT INTO messages
         (id, conversation_id, sender_id, message_type, message_text, status, sent_at)
       VALUES (?, ?, ?, ?, ?, 'sent', NOW())`,
      [id, conversation_id, sender_id, message_type, message_text?.trim() || null]
    );
    return this.findById(id);
  },

  // ── Attach image to existing message ──────────────────────────────────────
  async attachImage(message_id, {
    image_base64,
    mime_type  = "image/jpeg",
    file_name  = null,
    file_size  = null,
  }) {
    await pool.execute(
      `INSERT INTO message_images (id, message_id, image_base64, mime_type, file_name, file_size)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuid(), message_id, image_base64, mime_type, file_name, file_size ?? null]
    );
  },

  // ── Find single message by ID (includes image join) ───────────────────────
  async findById(id) {
    const [rows] = await pool.execute(
      `${SELECT_WITH_IMAGE} WHERE m.id = ? AND m.is_deleted = 0 LIMIT 1`,
      [id]
    );
    return normalizeMessage(rows[0] ?? null);
  },

  // ── Paginated chat history ────────────────────────────────────────────────
  // FIX: use pool.query() (not execute) for LIMIT/OFFSET so mysql2 does not
  // try to bind them as prepared-statement parameters — avoids the
  // "Incorrect arguments to mysqld_stmt_execute" error seen in some mysql2
  // versions when integer params are sent for LIMIT/OFFSET.
  async findByConversation(conversationId, { limit = 50, offset = 0 } = {}) {
    const safeLimit  = Number(limit)  || 50;
    const safeOffset = Number(offset) || 0;

    // pool.query() uses text protocol — safe here because limit/offset are
    // coerced to integers above (no SQL-injection risk).
    const [rows] = await pool.query(
      `${SELECT_WITH_IMAGE}
       WHERE  m.conversation_id = ? AND m.is_deleted = 0
       ORDER BY m.sent_at DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      [conversationId]
    );
    // return in ascending (oldest-first) order for UI
    return rows.reverse().map(normalizeMessage);
  },

  // ── Count total messages in a conversation ────────────────────────────────
  async countByConversation(conversationId) {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM messages
       WHERE conversation_id = ? AND is_deleted = 0`,
      [conversationId]
    );
    return Number(rows[0].total);
  },

  // ── Update message status + corresponding timestamp ───────────────────────
  // FIX: build SQL via a lookup map instead of string concatenation to keep
  // queries consistent and prevent any edge-case caching issue in mysql2.
  async updateStatus(messageId, status) {
    const SQL_BY_STATUS = {
      sending:   `UPDATE messages SET status = 'sending' WHERE id = ? AND is_deleted = 0`,
      sent:      `UPDATE messages SET status = 'sent'    WHERE id = ? AND is_deleted = 0`,
      delivered: `UPDATE messages SET status = 'delivered', delivered_at = NOW() WHERE id = ? AND is_deleted = 0`,
      seen:      `UPDATE messages SET status = 'seen',      seen_at = NOW()       WHERE id = ? AND is_deleted = 0`,
    };

    const sql = SQL_BY_STATUS[status];
    if (!sql) throw new Error(`Invalid status: ${status}`);

    const [result] = await pool.execute(sql, [messageId]);
    return result.affectedRows > 0;
  },

  // ── Bulk mark-as-seen when recipient opens a conversation ─────────────────
  async markConversationSeen(conversationId, recipientId) {
    const [result] = await pool.execute(
      `UPDATE messages
       SET    status = 'seen', seen_at = NOW()
       WHERE  conversation_id = ?
         AND  sender_id       <> ?
         AND  status          <> 'seen'
         AND  is_deleted       = 0`,
      [conversationId, recipientId]
    );
    return result.affectedRows;
  },

  // ── Soft-delete (only sender can delete their own message) ────────────────
  async softDelete(messageId, userId) {
    const [result] = await pool.execute(
      `UPDATE messages SET is_deleted = 1
       WHERE id = ? AND sender_id = ?`,
      [messageId, userId]
    );
    return result.affectedRows > 0;
  },
};
