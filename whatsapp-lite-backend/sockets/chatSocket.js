import jwt                  from "jsonwebtoken";
import { MessageModel }      from "../models/messageModel.js";
import { ConversationModel } from "../models/conversationModel.js";
import { UserModel }         from "../models/userModel.js";

// userId → Set<socketId>  (one user can connect from multiple tabs/devices)
const onlineMap = new Map();

function trackAdd(userId, socketId) {
  if (!onlineMap.has(userId)) onlineMap.set(userId, new Set());
  onlineMap.get(userId).add(socketId);
}

function trackRemove(userId, socketId) {
  const sockets = onlineMap.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) onlineMap.delete(userId);
}

function isOnline(userId) {
  return (onlineMap.get(userId)?.size ?? 0) > 0;
}

function verifyToken(socket) {
  // Client must pass token in: io({ auth: { token } })  or  ?token= query param
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.query?.token;
  if (!token) throw new Error("No authentication token provided");
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function initSocket(io) {

  // ── Per-connection JWT auth ────────────────────────────────────────────────
  io.use((socket, next) => {
    try {
      socket.user = verifyToken(socket);
      next();
    } catch (err) {
      next(new Error("Socket authentication failed: " + err.message));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.user.id;

    // Track this socket and join the user's private room
    trackAdd(userId, socket.id);
    socket.join(`user:${userId}`);

    try {
      await UserModel.setOnlineStatus(userId, true);
    } catch (err) {
      console.error("[socket] setOnlineStatus(true) failed:", err.message);
    }

    // Notify all other clients that this user came online
    socket.broadcast.emit("user:online", { userId });
    console.log(`🟢  connected   socket=${socket.id}  user=${userId}`);

    // ── conversation:join ────────────────────────────────────────────────────
    socket.on("conversation:join", async ({ conversationId } = {}) => {
      if (!conversationId) return;
      try {
        const conv = await ConversationModel.findById(conversationId);
        // Silently ignore if conversation not found or user is not a participant
        if (!conv) return;
        if (conv.user1_id !== userId && conv.user2_id !== userId) return;

        socket.join(conversationId);

        // Mark all unread messages in this conversation as seen
        const count = await MessageModel.markConversationSeen(conversationId, userId);
        if (count > 0) {
          io.to(conversationId).emit("messages:seen_bulk", { conversationId, userId });
        }
      } catch (err) {
        console.error("[socket] conversation:join error:", err.message);
      }
    });

    // ── conversation:leave ───────────────────────────────────────────────────
    socket.on("conversation:leave", ({ conversationId } = {}) => {
      if (conversationId) socket.leave(conversationId);
    });

    // ── send_message ─────────────────────────────────────────────────────────
    // Expected flow:
    //   1. Client POSTs to /api/messages/send  → gets back { message }
    //   2. Client emits "send_message" with { conversationId, messageId, recipientId }
    // This event re-broadcasts the already-persisted message to the room.
    socket.on("send_message", async (payload, ack) => {
      try {
        const { conversationId, messageId, recipientId } = payload ?? {};

        if (!conversationId || !messageId) {
          return ack?.({ error: "conversationId and messageId are required" });
        }

        const message = await MessageModel.findById(messageId);
        if (!message) {
          return ack?.({ error: "Message not found" });
        }

        // Broadcast to everyone in the conversation room
        io.to(conversationId).emit("receive_message", message);

        // Also push to recipient's personal room (covers the case where they
        // haven't joined the conversation room yet)
        if (recipientId) {
          socket.to(`user:${recipientId}`).emit("receive_message", message);

          // Auto-upgrade to "delivered" if recipient is currently online
          if (isOnline(recipientId)) {
            await MessageModel.updateStatus(messageId, "delivered");
            io.to(conversationId).emit("update_message_status", {
              messageId,
              conversationId,
              status: "delivered",
            });
          }
        }

        ack?.({ success: true });
      } catch (err) {
        console.error("[socket] send_message error:", err.message);
        ack?.({ error: "Internal error processing message" });
      }
    });

    // ── message_delivered ────────────────────────────────────────────────────
    socket.on("message_delivered", async ({ messageId, conversationId } = {}) => {
      if (!messageId || !conversationId) return;
      try {
        await MessageModel.updateStatus(messageId, "delivered");
        io.to(conversationId).emit("update_message_status", {
          messageId,
          conversationId,
          status: "delivered",
        });
      } catch (err) {
        console.error("[socket] message_delivered error:", err.message);
      }
    });

    // ── message_seen ─────────────────────────────────────────────────────────
    socket.on("message_seen", async ({ messageId, conversationId } = {}) => {
      if (!messageId || !conversationId) return;
      try {
        await MessageModel.updateStatus(messageId, "seen");
        io.to(conversationId).emit("update_message_status", {
          messageId,
          conversationId,
          status: "seen",
        });
      } catch (err) {
        console.error("[socket] message_seen error:", err.message);
      }
    });

    // ── typing indicators ─────────────────────────────────────────────────────
    socket.on("typing:start", ({ conversationId } = {}) => {
      if (conversationId) {
        socket.to(conversationId).emit("typing:start", { conversationId, userId });
      }
    });

    socket.on("typing:stop", ({ conversationId } = {}) => {
      if (conversationId) {
        socket.to(conversationId).emit("typing:stop", { conversationId, userId });
      }
    });

    // ── disconnect ───────────────────────────────────────────────────────────
    socket.on("disconnect", async (reason) => {
      trackRemove(userId, socket.id);

      // Only mark offline once ALL of this user's sockets have disconnected
      if (!isOnline(userId)) {
        try {
          await UserModel.setOnlineStatus(userId, false);
        } catch (err) {
          console.error("[socket] setOnlineStatus(false) failed:", err.message);
        }
        socket.broadcast.emit("user:offline", {
          userId,
          lastSeen: new Date().toISOString(),
        });
        console.log(`🔴  disconnected socket=${socket.id}  user=${userId}  reason=${reason}`);
      }
    });
  });
}
