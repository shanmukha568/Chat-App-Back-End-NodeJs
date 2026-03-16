import pool from "../config/db.js";
import { v4 as uuid } from "uuid";

export const ConversationModel = {

  // ── Get existing or create new conversation between two users ─────────────
  // Normalise pair order (smaller UUID = user1) so (A,B) and (B,A) always
  // map to the same row.
  async getOrCreate(userAId, userBId) {
    const [lo, hi] = userAId < userBId
      ? [userAId, userBId]
      : [userBId, userAId];

    const [rows] = await pool.execute(
      `SELECT id, user1_id, user2_id, created_at, updated_at
       FROM   conversations
       WHERE  user1_id = ? AND user2_id = ?
       LIMIT  1`,
      [lo, hi]
    );
    if (rows[0]) return rows[0];

    const id = uuid();
    await pool.execute(
      `INSERT INTO conversations (id, user1_id, user2_id) VALUES (?, ?, ?)`,
      [id, lo, hi]
    );
    return this.findById(id);
  },

  // ── Find conversation by ID ───────────────────────────────────────────────
  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT id, user1_id, user2_id, created_at, updated_at
       FROM   conversations
       WHERE  id = ?
       LIMIT  1`,
      [id]
    );
    return rows[0] ?? null;
  },

  // ── All conversations for a user, most-recent first ───────────────────────
  // FIX: removed inline SQL comments (-- ...) from inside the prepared
  // statement string — while mysql2 generally handles them, stripping
  // comments avoids any edge case with older MySQL server versions.
  async findAllForUser(userId) {
    const sql = `SELECT
         c.id,
         c.created_at,
         c.updated_at,
         ou.id           AS participant_id,
         ou.name         AS participant_name,
         ou.phone_number AS participant_phone,
         ou.avatar_base64    AS participant_avatar_base64,
         ou.avatar_mime_type AS participant_avatar_mime_type,
         ou.is_online    AS participant_is_online,
         ou.last_seen    AS participant_last_seen,
         lm.id           AS last_message_id,
         lm.message_type AS last_message_type,
         lm.message_text AS last_message_text,
         lm.status       AS last_message_status,
         lm.sent_at      AS last_message_sent_at,
         (lm.sender_id = ?) AS last_message_is_mine,
         (
           SELECT COUNT(*)
           FROM   messages ur
           WHERE  ur.conversation_id = c.id
             AND  ur.sender_id      <> ?
             AND  ur.status         <> 'seen'
             AND  ur.is_deleted      = 0
         ) AS unread_count
       FROM conversations c
       JOIN users ou
         ON ou.id = IF(c.user1_id = ?, c.user2_id, c.user1_id)
       LEFT JOIN messages lm
         ON lm.id = (
           SELECT lmi.id
           FROM   messages lmi
           WHERE  lmi.conversation_id = c.id
             AND  lmi.is_deleted = 0
           ORDER BY lmi.sent_at DESC
           LIMIT 1
         )
       WHERE  (c.user1_id = ? OR c.user2_id = ?)
         AND  lm.id IS NOT NULL
       ORDER BY c.updated_at DESC`;

    try {
      const [rows] = await pool.execute(sql, [userId, userId, userId, userId, userId]);
      return rows;
    } catch (err) {
      const isMissingAvatarCol = err?.code === "ER_BAD_FIELD_ERROR" && /avatar_(base64|mime_type)/i.test(err?.message ?? "");
      if (!isMissingAvatarCol) throw err;

      const legacySql = sql
        .replace("         ou.avatar_base64    AS participant_avatar_base64,\n", "")
        .replace("         ou.avatar_mime_type AS participant_avatar_mime_type,\n", "");

      const [rows] = await pool.execute(legacySql, [userId, userId, userId, userId, userId]);
      return rows;
    }
  },

  // ── Bump updated_at after a new message ───────────────────────────────────
  async touch(id) {
    await pool.execute(
      `UPDATE conversations SET updated_at = NOW() WHERE id = ?`,
      [id]
    );
  },
};
