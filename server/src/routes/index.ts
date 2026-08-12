import { Router } from "express";
import authRoutes from "./auth.routes.js";
import chatRoutes from "./chat.routes.js";
import pushRoutes from "./push.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/chats", chatRoutes);
router.use("/push", pushRoutes);

export default router;
