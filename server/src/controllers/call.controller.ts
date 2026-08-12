import type { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { getIO } from "../sockets/index.js";

/**
 * POST /api/chats/:chatId/calls
 * Start or join an active voice or video call in this chat room.
 */
export async function startCall(req: Request, res: Response, next: NextFunction) {
  try {
    const chatId = req.chatMembership!.chatId;
    const userId = req.userId!;
    const { callType = "VIDEO" } = req.body;

    const chat = await prisma.chat.findUniqueOrThrow({ where: { id: chatId } });

    // Check if there is already an ongoing call
    let call = await prisma.call.findFirst({
      where: { chatId, status: "ONGOING" },
      include: { participants: true },
    });

    if (!call) {
      const roomId = `chatly_${chat.chatId}_${Date.now()}`;
      call = await prisma.call.create({
        data: {
          chatId,
          startedBy: userId,
          roomId,
          callType,
          status: "ONGOING",
          participants: {
            create: { userId },
          },
        },
        include: { participants: true },
      });

      // Broadcast new call notification to all chat members
      try {
        const io = getIO();
        if (io) {
          io.to(`chat:${chatId}`).emit("call:started", { callId: call.id, roomId: call.roomId, callType, startedBy: userId });
        }
      } catch {}
    } else {
      // Add user to active call participants if not already added
      await prisma.callParticipant.upsert({
        where: { callId_userId: { callId: call.id, userId } },
        update: { leftAt: null },
        create: { callId: call.id, userId },
      });
    }

    res.json({
      call,
      jitsiDomain: "meet.jit.si",
      roomName: call.roomId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/chats/:chatId/calls/active
 * Get current active call for this chat.
 */
export async function getActiveCall(req: Request, res: Response, next: NextFunction) {
  try {
    const chatId = req.chatMembership!.chatId;
    const call = await prisma.call.findFirst({
      where: { chatId, status: "ONGOING" },
      include: {
        starter: { select: { id: true, name: true, username: true } },
        participants: { include: { user: { select: { id: true, name: true, username: true } } } },
      },
    });

    if (!call) return res.json({ call: null });

    res.json({
      call,
      jitsiDomain: "meet.jit.si",
      roomName: call.roomId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/chats/:chatId/calls/:callId/end
 * End an ongoing call.
 */
export async function endCall(req: Request, res: Response, next: NextFunction) {
  try {
    const { callId } = req.params;
    const chatId = req.chatMembership!.chatId;

    await prisma.call.updateMany({
      where: { id: callId, chatId },
      data: { status: "ENDED", endedAt: new Date() },
    });

    try {
      const io = getIO();
      if (io) {
        io.to(`chat:${chatId}`).emit("call:ended", { callId });
      }
    } catch {}

    res.json({ status: "ended" });
  } catch (err) {
    next(err);
  }
}
