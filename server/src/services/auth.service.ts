import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../utils/prisma.js";
import { ApiError } from "../utils/apiError.js";
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiryDate,
} from "../utils/tokens.js";
import type { z } from "zod";
import type { registerSchema, loginSchema } from "../validators/auth.validator.js";

type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;

export async function registerUser(input: RegisterInput, meta: { ip?: string; userAgent?: string }) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
  });
  if (existing) {
    throw new ApiError(409, existing.email === input.email ? "Email already in use" : "Username already taken");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      username: input.username,
      email: input.email,
      passwordHash,
    },
  });

  // Fire off an email-verification token. Actual email delivery is left to
  // whichever transactional-email provider you wire up (SES, Resend, etc.)
  // — see EmailVerification model + README for the integration point.
  const verifyToken = randomBytes(32).toString("hex");
  await prisma.emailVerification.create({
    data: {
      userId: user.id,
      tokenHash: createHash("sha256").update(verifyToken).digest("hex"),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  });

  const session = await issueSession(user.id, meta);

  return {
    user: sanitizeUser(user),
    ...session,
    verifyToken, // dev-only: in production this goes in the email, not the response
  };
}

export async function loginUser(input: LoginInput, meta: { ip?: string; userAgent?: string }) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: input.identifier }, { username: input.identifier }] },
  });
  if (!user) throw new ApiError(401, "Invalid credentials");

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new ApiError(401, "Invalid credentials");

  const session = await issueSession(user.id, meta);
  return { user: sanitizeUser(user), ...session };
}

export async function refreshSession(rawToken: string) {
  const hash = hashToken(rawToken);
  const session = await prisma.session.findUnique({ where: { refreshToken: hash } });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new ApiError(401, "Session expired");
  }

  // Rotate: revoke the old refresh token, issue a new one.
  await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) throw new ApiError(401, "Session expired");

  const newSession = await issueSession(user.id, { ip: session.ip ?? undefined, userAgent: session.userAgent ?? undefined });
  return { user: sanitizeUser(user), ...newSession };
}

export async function logoutSession(rawToken: string) {
  const hash = hashToken(rawToken);
  await prisma.session.updateMany({
    where: { refreshToken: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function logoutAllSessions(userId: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function issueSession(userId: string, meta: { ip?: string; userAgent?: string }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const accessToken = signAccessToken({ sub: user.id, username: user.username });
  const { token: refreshToken, hash } = generateRefreshToken();

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: hash,
      ip: meta.ip,
      userAgent: meta.userAgent,
      expiresAt: refreshTokenExpiryDate(),
    },
  });

  return { accessToken, refreshToken };
}

function sanitizeUser<T extends { passwordHash: string }>(user: T) {
  const { passwordHash: _omit, ...safe } = user;
  return safe;
}
