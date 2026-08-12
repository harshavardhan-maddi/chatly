import { prisma } from "../utils/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { generateUniqueChatId } from "../utils/chatId.js";
import type { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { createChatSchema } from "../validators/chat.validator.js";

type Tx = Prisma.TransactionClient;

type CreateChatInput = z.infer<typeof createChatSchema>;

export async function createChat(ownerId: string, input: CreateChatInput) {
  const chatId = await generateUniqueChatId();

  const chat = await prisma.$transaction(async (tx: Tx) => {
    const created = await tx.chat.create({
      data: {
        chatId,
        name: input.name,
        description: input.description,
        image: input.image,
        ownerId,
        maxMembers: input.maxMembers,
        accessType: input.accessType,
        messagePermission: input.messagePermission,
        startCallPermission: input.startCallPermission,
        joinCallPermission: input.joinCallPermission,
      },
    });

    await tx.chatMember.create({
      data: { chatId: created.id, userId: ownerId, role: "OWNER", status: "ACTIVE" },
    });

    return created;
  });

  return chat;
}

/**
 * Attempts to join a chat directly (PUBLIC access type only — approval and
 * invite flows go through joinRequest.service.ts instead).
 *
 * Race-condition safety: two users hitting "join" for the same near-full
 * chat at the same instant must not both succeed and blow past maxMembers.
 * We take a row lock on the chat via `SELECT ... FOR UPDATE` inside a
 * serializable-enough interactive transaction, then re-check the live
 * member count before inserting — this makes the check-then-insert atomic
 * per chat, which is exactly where the race would otherwise happen.
 */
export async function joinPublicChat(chatIdCode: string, userId: string) {
  return prisma.$transaction(async (tx: Tx) => {
    const [chat] = await tx.$queryRaw<Array<{ id: string; maxMembers: number; accessType: string; deletedAt: Date | null }>>`
      SELECT id, max_members as "maxMembers", access_type as "accessType", deleted_at as "deletedAt"
      FROM chats WHERE chat_id = ${chatIdCode} FOR UPDATE
    `;

    if (!chat || chat.deletedAt) throw new ApiError(404, "Invalid Chat ID");
    if (chat.accessType !== "PUBLIC") throw new ApiError(403, "This chat requires approval or an invite to join");

    const existingMembership = await tx.chatMember.findUnique({
      where: { chatId_userId: { chatId: chat.id, userId } },
    });

    if (existingMembership?.status === "BANNED") throw new ApiError(403, "You are banned");
    if (existingMembership?.status === "ACTIVE") throw new ApiError(409, "Already a member");

    const memberCount = await tx.chatMember.count({
      where: { chatId: chat.id, status: "ACTIVE" },
    });
    if (memberCount >= chat.maxMembers) throw new ApiError(409, "Chat is full");

    if (existingMembership) {
      return tx.chatMember.update({
        where: { id: existingMembership.id },
        data: { status: "ACTIVE", role: "MEMBER", joinedAt: new Date() },
      });
    }

    return tx.chatMember.create({
      data: { chatId: chat.id, userId, role: "MEMBER", status: "ACTIVE" },
    });
  });
}

export async function getChatByCode(chatIdCode: string) {
  const chat = await prisma.chat.findUnique({
    where: { chatId: chatIdCode },
    include: { _count: { select: { members: { where: { status: "ACTIVE" } } } } },
  });
  if (!chat || chat.deletedAt) throw new ApiError(404, "Chat not found");
  return chat;
}

export async function listUserChats(userId: string) {
  return prisma.chatMember.findMany({
    where: { userId, status: "ACTIVE" },
    include: {
      chat: {
        include: { _count: { select: { members: { where: { status: "ACTIVE" } } } } },
      },
    },
    orderBy: { chat: { updatedAt: "desc" } },
  });
}
