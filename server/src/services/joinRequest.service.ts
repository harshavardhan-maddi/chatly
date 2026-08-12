import { prisma } from "../utils/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { notifyUser } from "./notification.service.js";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export async function requestToJoin(chatIdCode: string, userId: string) {
  const chat = await prisma.chat.findUnique({ where: { chatId: chatIdCode } });
  if (!chat || chat.deletedAt) throw new ApiError(404, "Invalid Chat ID");
  if (chat.accessType === "INVITE_ONLY") throw new ApiError(403, "This chat is invite-only");

  const membership = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId: chat.id, userId } },
  });
  if (membership?.status === "BANNED") throw new ApiError(403, "You are banned");
  if (membership?.status === "ACTIVE") throw new ApiError(409, "Already a member");

  const pending = await prisma.joinRequest.findFirst({
    where: { chatId: chat.id, userId, status: "PENDING" },
  });
  if (pending) throw new ApiError(409, "Join request already pending");

  const request = await prisma.joinRequest.create({
    data: { chatId: chat.id, userId, status: "PENDING" },
  });

  await notifyUser(chat.ownerId, "JOIN_REQUEST", { chatId: chat.chatId, requestId: request.id, userId });

  return request;
}

export async function reviewJoinRequest(
  requestId: string,
  reviewerId: string,
  decision: "APPROVED" | "REJECTED",
) {
  return prisma.$transaction(async (tx: Tx) => {
    const request = await tx.joinRequest.findUnique({ where: { id: requestId }, include: { chat: true } });
    if (!request || request.status !== "PENDING") throw new ApiError(404, "Join request not found");

    // A user must not be able to approve their own request.
    if (request.userId === reviewerId) throw new ApiError(403, "Permission denied");

    const reviewerMembership = await tx.chatMember.findUnique({
      where: { chatId_userId: { chatId: request.chatId, userId: reviewerId } },
    });
    if (!reviewerMembership || !["OWNER", "ADMIN"].includes(reviewerMembership.role)) {
      throw new ApiError(403, "Permission denied");
    }

    if (decision === "APPROVED") {
      const [chatRow] = await tx.$queryRaw<Array<{ maxMembers: number }>>`
        SELECT max_members as "maxMembers" FROM chats WHERE id = ${request.chatId} FOR UPDATE
      `;
      const memberCount = await tx.chatMember.count({ where: { chatId: request.chatId, status: "ACTIVE" } });
      if (memberCount >= chatRow.maxMembers) throw new ApiError(409, "Chat is full");

      await tx.chatMember.upsert({
        where: { chatId_userId: { chatId: request.chatId, userId: request.userId } },
        update: { status: "ACTIVE", role: "MEMBER", joinedAt: new Date() },
        create: { chatId: request.chatId, userId: request.userId, role: "MEMBER", status: "ACTIVE" },
      });
    }

    const updated = await tx.joinRequest.update({
      where: { id: requestId },
      data: { status: decision, reviewedBy: reviewerId, reviewedAt: new Date() },
    });

    await notifyUser(
      request.userId,
      decision === "APPROVED" ? "JOIN_APPROVED" : "JOIN_REJECTED",
      { chatId: request.chat.chatId },
    );

    return updated;
  });
}
