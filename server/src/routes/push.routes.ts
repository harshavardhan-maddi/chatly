import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { getVapidKey, subscribePush } from "../controllers/push.controller.js";

const router = Router();

router.get("/vapid-key", getVapidKey);
router.post("/subscribe", requireAuth, subscribePush);

export default router;
