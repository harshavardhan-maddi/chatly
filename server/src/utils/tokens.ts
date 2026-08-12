import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";
import { env } from "../config/env.js";

export interface AccessTokenPayload {
  sub: string; // userId
  username: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: jwt.SignOptions = { expiresIn: env.accessTokenTtl as jwt.SignOptions["expiresIn"] };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AccessTokenPayload;
}

/**
 * Refresh tokens are opaque random strings, not JWTs — we store only their
 * hash in the DB so a leaked database dump can't be replayed directly.
 */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString("hex");
  const hash = hashToken(token);
  return { token, hash };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiryDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + env.refreshTokenTtlDays);
  return d;
}
