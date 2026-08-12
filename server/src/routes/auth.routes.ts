import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

import { env } from "../config/env.js";

const router = Router();

// Tighter limits on auth endpoints — these are brute-force targets.
const isDev = env.nodeEnv === "development";
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: isDev ? 1000 : 20 });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: isDev ? 1000 : 10 });

router.get("/me", requireAuth, authController.me);
router.post("/guest", authLimiter, authController.guestLogin);
router.post("/register", authLimiter, authController.register);
router.post("/login", loginLimiter, authController.login);
router.post("/logout", authController.logout);
router.post("/logout-all", requireAuth, authController.logoutAll);
router.post("/refresh", authController.refresh);
router.post("/forgot-password", authLimiter, authController.forgotPassword);
router.post("/reset-password", authLimiter, authController.resetPassword);

export default router;
