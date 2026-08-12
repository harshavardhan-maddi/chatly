import { prisma } from "../utils/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { generateUniqueChatId } from "../utils/chatId.js";
import { getIO } from "../sockets/index.js";
import type { z } from "zod";
import type { updateChatSchema } from "../validators/chat.validator.js";

type UpdateChatInput = z.infer<typeof updateChatSchema>;

export async function updateChat(chatId: string, input: UpdateChatInput) {
  if (input.maxMembers !== undefined) {
    const currentCount = await prisma.chatMember.count({ where: { chatId, status: "ACTIVE" } });
    if (input.maxMembers < currentCount) {
      throw new ApiError(400, `Cannot set max members below current member count (${currentCount})`);
    }
  }

  const updated = await prisma.chat.update({ where: { id: chatId }, data: input });
  getIO()?.to(`chat:${chatId}`).emit("chat:updated", updated);
  return updated;
}

export async function deleteChat(chatId: string) {
  // Soft delete: keeps historical records (messages, calls) intact for
  // audit/compliance while removing the chat from everyone's chat list.
  await prisma.chat.update({ where: { id: chatId }, data: { deletedAt: new Date() } });
  getIO()?.to(`chat:${chatId}`).emit("chat:deleted", { chatId });
}

export async function regenerateChatId(chatId: string) {
  const newChatId = await generateUniqueChatId();
  const updated = await prisma.chat.update({ where: { id: chatId }, data: { chatId: newChatId } });
  getIO()?.to(`chat:${chatId}`).emit("chat:updated", updated);
  return updated;
}

export async function transferOwnership(chatId: string, currentOwnerId: string, newOwnerId: string) {
  const target = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId: newOwnerId } } });
  if (!target || target.status !== "ACTIVE") throw new ApiError(404, "Member not found");

  return prisma.$transaction([
    prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId: currentOwnerId } },
      data: { role: "ADMIN" },
    }),
    prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId: newOwnerId } },
      data: { role: "OWNER" },
    }),
    prisma.chat.update({ where: { id: chatId }, data: { ownerId: newOwnerId } }),
  ]);
}

export async function listJoinRequests(chatId: string) {
  return prisma.joinRequest.findMany({
    where: { chatId, status: "PENDING" },
    include: { requester: { select: { id: true, name: true, username: true, profileImage: true } } },
    orderBy: { createdAt: "asc" },
  });
}
