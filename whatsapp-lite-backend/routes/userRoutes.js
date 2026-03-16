import { Router }         from "express";
import { UserController } from "../controllers/userController.js";
import { authenticate }   from "../middleware/authMiddleware.js";

const router = Router();
router.use(authenticate);

router.get("/",          UserController.getAll);
router.put("/me/avatar", UserController.updateMyAvatar);
router.get("/:id/status", UserController.getStatus);
router.get("/:id",       UserController.getById);

export default router;
