import type { Server, Socket } from "socket.io";
import { prisma } from "../utils/prisma.js";
import type { MessageType } from "@prisma/client";

interface PendingAttachment {
  fileName: string;
  fileUrl: string; // storage object key returned by POST /uploads
  mimeType: string;
  fileSize: number;
  thumbnailUrl?: string;
}

interface SendMessagePayload {
  chatId: string; // internal DB id
  content?: string;
  messageType: MessageType;
  replyToMessageId?: string;
  attachment?: PendingAttachment; // from a prior POST /api/chats/:chatId/uploads call
}

export function registerMessageHandlers(io: Server, socket: Socket) {
  const userId: string = socket.data.userId;

  socket.on("message:send", async (payload: SendMessagePayload, ack?: (res: unknown) => void) => {
    try {
      const membership = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: payload.chatId, userId } },
      });
      if (!membership || membership.status !== "ACTIVE") {
        return ack?.({ error: "Permission denied" });
      }

      const chat = await prisma.chat.findUniqueOrThrow({ where: { id: payload.chatId } });

      const canSend =
        chat.messagePermission === "EVERYONE" ||
        (chat.messagePermission === "ADMINS_ONLY" && ["OWNER", "ADMIN"].includes(membership.role));
      if (!canSend) return ack?.({ error: "Permission denied" });

      const message = await prisma.message.create({
        data: {
          chatId: payload.chatId,
          senderId: userId,
          content: payload.content,
          messageType: payload.messageType,
          replyToMessageId: payload.replyToMessageId,
          attachments: payload.attachment
            ? {
                create: {
                  fileName: payload.attachment.fileName,
                  fileUrl: payload.attachment.fileUrl,
                  mimeType: payload.attachment.mimeType,
                  fileSize: payload.attachment.fileSize,
                  thumbnailUrl: payload.attachment.thumbnailUrl,
                },
              }
            : undefined,
        },
        include: {
          sender: { select: { id: true, name: true, username: true, profileImage: true } },
          attachments: true,
        },
      });

      await prisma.chat.update({ where: { id: payload.chatId }, data: { updatedAt: new Date() } });

      io.to(`chat:${payload.chatId}`).emit("message:new", message);
      ack?.({ message });
    } catch {
      ack?.({ error: "Something went wrong" });
    }
  });

  socket.on("message:delivered", async ({ messageId }: { messageId: string }) => {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return;
    io.to(`chat:${message.chatId}`).emit("message:delivered", { messageId, userId });
  });

  socket.on("message:read", async ({ messageId }: { messageId: string }) => {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return;

    await prisma.messageRead.upsert({
      where: { messageId_userId: { messageId, userId } },
      update: { readAt: new Date() },
      create: { messageId, userId },
    });

    io.to(`chat:${message.chatId}`).emit("message:read", { messageId, userId });
  });
}
