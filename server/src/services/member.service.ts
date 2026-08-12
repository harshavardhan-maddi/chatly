import { prisma } from "../utils/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { notifyUser } from "./notification.service.js";
import { getIO } from "../sockets/index.js";
import type { MemberRole } from "@prisma/client";

interface ActorContext {
  chatId: string; // internal DB id
  actorId: string;
  actorRole: MemberRole;
}

export async function listMembers(chatId: string) {
  return prisma.chatMember.findMany({
    where: { chatId, status: { in: ["ACTIVE", "BANNED"] } },
    include: { user: { select: { id: true, name: true, username: true, profileImage: true, lastSeen: true } } },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });
}

export async function promoteToAdmin(ctx: ActorContext, targetUserId: string) {
  // Only the OWNER can create/remove admins per spec section 31.
  if (ctx.actorRole !== "OWNER") throw new ApiError(403, "Permission denied");
  if (targetUserId === ctx.actorId) throw new ApiError(400, "You are already the owner");

  const target = await getActiveMember(ctx.chatId, targetUserId);
  const updated = await prisma.chatMember.update({ where: { id: target.id }, data: { role: "ADMIN" } });

  await notifyUser(targetUserId, "ADMIN_PROMOTED", { chatId: ctx.chatId });
  broadcastMemberUpdate(ctx.chatId, updated);
  return updated;
}

export async function demoteAdmin(ctx: ActorContext, targetUserId: string) {
  if (ctx.actorRole !== "OWNER") throw new ApiError(403, "Permission denied");

  const target = await getActiveMember(ctx.chatId, targetUserId);
  if (target.role !== "ADMIN") throw new ApiError(400, "User is not an admin");

  const updated = await prisma.chatMember.update({ where: { id: target.id }, data: { role: "MEMBER" } });
  await notifyUser(targetUserId, "ADMIN_DEMOTED", { chatId: ctx.chatId });
  broadcastMemberUpdate(ctx.chatId, updated);
  return updated;
}

export async function removeMember(ctx: ActorContext, targetUserId: string) {
  assertCanModerate(ctx, targetUserId);

  const target = await getActiveMember(ctx.chatId, targetUserId);
  if (target.role === "OWNER") throw new ApiError(403, "Cannot remove the chat owner");
  // Admins may not remove other admins — only the owner can (mirrors spec: owner can "Add/remove admins").
  if (target.role === "ADMIN" && ctx.actorRole !== "OWNER") throw new ApiError(403, "Permission denied");

  const updated = await prisma.chatMember.update({ where: { id: target.id }, data: { status: "REMOVED" } });
  await notifyUser(targetUserId, "MEMBER_REMOVED", { chatId: ctx.chatId });
  kickSocket(ctx.chatId, targetUserId);
  return updated;
}

export async function banMember(ctx: ActorContext, targetUserId: string) {
  assertCanModerate(ctx, targetUserId);

  const target = await getActiveMember(ctx.chatId, targetUserId);
  if (target.role === "OWNER") throw new ApiError(403, "Cannot ban the chat owner");
  if (target.role === "ADMIN" && ctx.actorRole !== "OWNER") throw new ApiError(403, "Permission denied");

  const updated = await prisma.chatMember.update({ where: { id: target.id }, data: { status: "BANNED" } });
  await notifyUser(targetUserId, "MEMBER_BANNED", { chatId: ctx.chatId });
  kickSocket(ctx.chatId, targetUserId);
  return updated;
}

export async function unbanMember(ctx: ActorContext, targetUserId: string) {
  if (!["OWNER", "ADMIN"].includes(ctx.actorRole)) throw new ApiError(403, "Permission denied");

  const target = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId: ctx.chatId, userId: targetUserId } },
  });
  if (!target || target.status !== "BANNED") throw new ApiError(404, "Member is not banned");

  return prisma.chatMember.update({ where: { id: target.id }, data: { status: "REMOVED" } }); // back to "not a member" — they must rejoin/request
}

export async function leaveChat(chatId: string, userId: string) {
  const member = await getActiveMember(chatId, userId);
  if (member.role === "OWNER") {
    throw new ApiError(400, "Transfer ownership before leaving, or delete the chat instead");
  }
  await prisma.chatMember.update({ where: { id: member.id }, data: { status: "LEFT" } });
  kickSocket(chatId, userId);
}

async function getActiveMember(chatId: string, userId: string) {
  const member = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId } } });
  if (!member || member.status !== "ACTIVE") throw new ApiError(404, "Member not found");
  return member;
}

function assertCanModerate(ctx: ActorContext, targetUserId: string) {
  if (!["OWNER", "ADMIN"].includes(ctx.actorRole)) throw new ApiError(403, "Permission denied");
  if (targetUserId === ctx.actorId) throw new ApiError(400, "You cannot moderate yourself");
}

function broadcastMemberUpdate(chatId: string, member: unknown) {
  getIO()?.to(`chat:${chatId}`).emit("member:updated", member);
}

function kickSocket(chatId: string, userId: string) {
  const io = getIO();
  if (!io) return;
  // Force every socket belonging to this user out of the chat room so they
  // stop receiving live events immediately, not just on next reconnect.
  io.to(`user:${userId}`).emit("chat:removed", { chatId });
  io.in(`user:${userId}`).socketsLeave(`chat:${chatId}`);
}
