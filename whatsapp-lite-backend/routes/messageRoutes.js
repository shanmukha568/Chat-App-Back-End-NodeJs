import { Router }            from "express";
import { MessageController } from "../controllers/messageController.js";
import { authenticate }      from "../middleware/authMiddleware.js";

const router = Router();
router.use(authenticate);

// NOTE: /send and /status must be declared before /:conversationId to avoid route collision
router.post("/send",                      MessageController.send);
router.put("/status",                     MessageController.updateStatus);
router.get("/:conversationId",            MessageController.getHistory);
router.patch("/:conversationId/read",     MessageController.markRead);
router.delete("/:messageId",              MessageController.deleteMessage);

export default router;
