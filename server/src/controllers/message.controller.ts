import type { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { getSignedDownloadUrl } from "../services/storage.service.js";
import { getIO } from "../sockets/index.js";
import { sendPushToUser } from "../services/webpush.service.js";

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
        reactions: { include: { user: { select: { id: true, name: true, username: true } } } },
        replyTo: {
          select: {
            id: true,
            content: true,
            messageType: true,
            sender: { select: { id: true, name: true, username: true } },
          },
        },
        reads: { select: { userId: true, readAt: true } },
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
 * Send a message with instant WebSockets broadcast & VAPID background push notifications.
 */
export async function createMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const { content, messageType = "TEXT", replyToMessageId } = req.body;
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
        replyToMessageId: replyToMessageId || null,
      },
      include: {
        sender: { select: { id: true, name: true, username: true, profileImage: true } },
        attachments: true,
        reactions: { include: { user: { select: { id: true, name: true, username: true } } } },
        replyTo: {
          select: {
            id: true,
            content: true,
            messageType: true,
            sender: { select: { id: true, name: true, username: true } },
          },
        },
        reads: { select: { userId: true, readAt: true } },
        _count: { select: { reads: true } },
      },
    });

    await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { name: true, chatId: true },
    });
    const chatName = chat?.name || "Chatly";
    const notificationBody = `Message from ${chatName}`;

    try {
      const io = getIO();

      const members = await prisma.chatMember.findMany({
        where: { chatId, status: "ACTIVE" },
        select: { userId: true },
      });

      for (const m of members) {
        if (m.userId !== userId) {
          if (io) {
            io.to(`chat:${chatId}`).emit("message:new", message);
            io.to(`user:${m.userId}`).emit("notification:new", {
              chatId,
              message,
              chatName,
            });
          }

          sendPushToUser(m.userId, {
            title: "New Notification",
            body: notificationBody,
            url: `/chats/${chat?.chatId || chatId}`,
          }).catch(() => {});
        }
      }
    } catch {
      // Ignore socket emit errors
    }

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/chats/:chatId/messages/:messageId/reactions
 * Toggle emoji reaction (❤️, 😂, 😭, 👍, 😮, 🔥, 🙏) on a message.
 */
export async function toggleReaction(req: Request, res: Response, next: NextFunction) {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const chatId = req.chatMembership!.chatId;
    const userId = req.userId!;

    if (!emoji || typeof emoji !== "string") {
      throw new ApiError(400, "Emoji is required");
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.chatId !== chatId || message.deletedAt) {
      throw new ApiError(404, "Message not found");
    }

    const existing = await prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
    });

    if (existing) {
      await prisma.messageReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.messageReaction.create({
        data: {
          messageId,
          userId,
          emoji,
        },
      });
    }

    const reactions = await prisma.messageReaction.findMany({
      where: { messageId },
      include: { user: { select: { id: true, name: true, username: true } } },
    });

    // Broadcast live WebSockets reaction event to all chat room participants
    const io = getIO();
    if (io) {
      io.to(`chat:${chatId}`).emit("message:reaction", {
        messageId,
        chatId,
        reactions,
      });
    }

    res.json({ messageId, reactions });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/chats/:chatId/messages/:messageId
 * Sender can edit message content ONLY BEFORE the receiver sees/reads it.
 */
export async function updateMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const chatId = req.chatMembership!.chatId;
    const userId = req.userId!;

    if (!content || !content.trim()) {
      throw new ApiError(400, "Content cannot be empty");
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { reads: true },
    });

    if (!message || message.chatId !== chatId || message.deletedAt) {
      throw new ApiError(404, "Message not found");
    }

    if (message.senderId !== userId) {
      throw new ApiError(403, "Only the sender can edit this message");
    }

    const isReadByReceiver = message.reads.some((r) => r.userId !== userId);
    if (isReadByReceiver) {
      throw new ApiError(403, "Cannot edit message after it has been seen by the receiver");
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { content: content.trim() },
      include: {
        sender: { select: { id: true, name: true, username: true, profileImage: true } },
        attachments: true,
        reactions: { include: { user: { select: { id: true, name: true, username: true } } } },
        replyTo: {
          select: {
            id: true,
            content: true,
            messageType: true,
            sender: { select: { id: true, name: true, username: true } },
          },
        },
        reads: { select: { userId: true, readAt: true } },
      },
    });

    res.json({ message: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/chats/:chatId/read
 * Marks all messages in this chat as read by the current user.
 */
export async function markChatAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const chatId = req.chatMembership!.chatId;
    const userId = req.userId!;

    const unreadMessages = await prisma.message.findMany({
      where: {
        chatId,
        senderId: { not: userId },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (unreadMessages.length > 0) {
      await prisma.messageRead.createMany({
        data: unreadMessages.map((m) => ({
          messageId: m.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    res.json({ status: "ok" });
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
