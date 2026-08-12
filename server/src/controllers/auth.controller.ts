import type { Request, Response, NextFunction } from "express";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth.validator.js";
import * as authService from "../services/auth.service.js";
import { env } from "../config/env.js";
import { prisma } from "../utils/prisma.js";
import { ApiError } from "../utils/apiError.js";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";

const REFRESH_COOKIE = "refresh_token";
const ACCESS_COOKIE = "access_token";

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const secure = env.nodeEnv === "production";
  const domain = env.cookieDomain && env.cookieDomain !== "localhost" ? env.cookieDomain : undefined;

  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    domain,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    domain,
    path: "/api/auth",
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  });
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const input = registerSchema.parse(req.body);
    const result = await authService.registerUser(input, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.status(201).json({ user: result.user });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.loginUser(input, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json({ user: result.user });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await authService.logoutSession(token);
    res.clearCookie(ACCESS_COOKIE);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function logoutAll(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.logoutAllSessions(req.userId!);
    res.clearCookie(ACCESS_COOKIE);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new ApiError(401, "Session expired");
    const result = await authService.refreshSession(token);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json({ user: result.user });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return 200 regardless of whether the email exists —
    // prevents user enumeration via this endpoint.
    if (user) {
      const rawToken = randomBytes(32).toString("hex");
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: createHash("sha256").update(rawToken).digest("hex"),
          expiresAt: new Date(Date.now() + 1000 * 60 * 30),
        },
      });
      // TODO: send rawToken via transactional email provider.
    }

    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const record = await prisma.passwordReset.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!record) throw new ApiError(400, "Invalid or expired reset token");

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Invalidate all existing sessions on password change.
      prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    res.json({ message: "Password updated. Please log in again." });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw new ApiError(401, "User not found");
    const { passwordHash: _omit, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    next(err);
  }
}
