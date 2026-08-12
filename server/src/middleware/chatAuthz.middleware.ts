import type { NextFunction, Request, Response } from "express";
import { prisma } from "../utils/prisma.js";
import { ApiError } from "../utils/apiError.js";
import type { MemberRole } from "@prisma/client";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      chatMembership?: { chatId: string; role: MemberRole };
    }
  }
}

/**
 * Loads the caller's membership for :chatId and rejects if they are not an
 * ACTIVE member. This is the single choke point every chat-scoped route
 * must pass through — never trust a chatId in the URL without this.
 */
export function requireChatMembership() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const chatIdParam = req.params.chatId;
      const chat = await prisma.chat.findUnique({ where: { chatId: chatIdParam } });
      if (!chat || chat.deletedAt) throw new ApiError(404, "Chat not found");

      const membership = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: chat.id, userId: req.userId! } },
      });

      if (!membership || membership.status !== "ACTIVE") {
        throw new ApiError(403, "Permission denied");
      }

      req.chatMembership = { chatId: chat.id, role: membership.role };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Restricts a route to specific roles (e.g. OWNER, or OWNER|ADMIN). */
export function requireRole(...roles: MemberRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.chatMembership || !roles.includes(req.chatMembership.role)) {
      return next(new ApiError(403, "Permission denied"));
    }
    next();
  };
}
