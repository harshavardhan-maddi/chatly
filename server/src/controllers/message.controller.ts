import type { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { getSignedDownloadUrl } from "../services/storage.service.js";

const PAGE_SIZE = 30;

/**
 * GET /api/chats/:chatId/messages?cursor=<messageId>
 * Cursor-based pagination, newest-first, so the client never has to load
 * the full history — matches the spec's "do not load all messages at once".
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

    const nextCursor = messages.length === PAGE_SIZE ? messages[messages.length - 1].id : null;
    res.json({ messages: messages.reverse(), nextCursor });
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

/**
 * GET /api/chats/:chatId/messages/:messageId/attachments/:attachmentId/url
 * Returns a short-lived signed URL — this is the ONLY way to read a
 * private file. Membership was already verified by requireChatMembership;
 * we additionally confirm the attachment actually belongs to this chat.
 */
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
