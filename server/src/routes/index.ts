import { Router } from "express";
import authRoutes from "./auth.routes.js";
import chatRoutes from "./chat.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/chats", chatRoutes);

// TODO(next phases): mount these as they're implemented —
// router.use("/users", userRoutes);
// router.use("/chats/:chatId/members", memberRoutes);
// router.use("/chats/:chatId/messages", messageRoutes);
// router.use("/uploads", uploadRoutes);
// router.use("/calls", callRoutes);
// router.use("/notifications", notificationRoutes);

export default router;
