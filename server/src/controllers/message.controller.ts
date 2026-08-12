import type { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { getSignedDownloadUrl } from "../services/storage.service.js";
import { getIO } from "../sockets/index.js";

const PAGE_SIZE = 50;

/**
 * GET /api/chats/:chatId/messages?cursor=<messageId>
 * Cursor-based pagination, newest-first.
 */
export async function listMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const cursor = req.query.cursor as string | undefined;

    const messages = await prisma.message.findMany({
      where: { chatId: req.chatMembership!.chatId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        sender: { select: { id: true, name: true, username: true, profileImage: true } },
        attachments: true,
        reactions: true,
        replyTo: { select: { id: true, content: true, messageType: true, senderId: true } },
        _count: { select: { reads: true } },
      },
    });

    res.json({ messages: messages.reverse(), nextCursor: messages.length === PAGE_SIZE ? messages[0].id : null });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/chats/:chatId/messages
 * Send a message via REST endpoint (works reliably across Vercel serverless and WebSockets).
 */
export async function createMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const { content, messageType = "TEXT" } = req.body;
    const chatId = req.chatMembership!.chatId;
    const userId = req.userId!;

    if (!content && messageType === "TEXT") {
      throw new ApiError(400, "Message content is required");
    }

    const message = await prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        content: content?.trim() || null,
        messageType,
      },
      include: {
        sender: { select: { id: true, name: true, username: true, profileImage: true } },
        attachments: true,
        reactions: true,
        replyTo: { select: { id: true, content: true, messageType: true, senderId: true } },
        _count: { select: { reads: true } },
      },
    });

    await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });

    // Emit live event over Socket.IO if server instance is active
    try {
      const io = getIO();
      if (io) {
        io.to(`chat:${chatId}`).emit("message:new", message);
      }
    } catch {
      // Ignore socket emit errors on isolated serverless lambdas
    }

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

export async function deleteMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const message = await prisma.message.findUnique({ where: { id: req.params.messageId } });
    if (!message || message.chatId !== req.chatMembership!.chatId) throw new ApiError(404, "Message not found");

    const role = req.chatMembership!.role;
    const isSender = message.senderId === req.userId;
    const isModerator = role === "OWNER" || role === "ADMIN";
    if (!isSender && !isModerator) throw new ApiError(403, "Permission denied");

    await prisma.message.update({ where: { id: message.id }, data: { deletedAt: new Date() } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getAttachmentUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const attachment = await prisma.messageAttachment.findUnique({
      where: { id: req.params.attachmentId },
      include: { message: true },
    });
    if (!attachment || attachment.message.chatId !== req.chatMembership!.chatId) {
      throw new ApiError(404, "File not found");
    }

    const url = await getSignedDownloadUrl(attachment.fileUrl);
    res.json({ url, expiresInSeconds: 600 });
  } catch (err) {
    next(err);
  }
}
