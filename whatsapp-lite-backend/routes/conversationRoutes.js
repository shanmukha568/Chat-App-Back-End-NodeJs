import { Router }                  from "express";
import { ConversationController }  from "../controllers/conversationController.js";
import { authenticate }            from "../middleware/authMiddleware.js";

const router = Router();
router.use(authenticate);

router.get("/",  ConversationController.getAll);
router.post("/", ConversationController.getOrCreate);

export default router;
