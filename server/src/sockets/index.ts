import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import cookie from "cookie";
import { verifyAccessToken } from "../utils/tokens.js";
import { env } from "../config/env.js";
import { prisma } from "../utils/prisma.js";
import { registerMessageHandlers } from "./message.handlers.js";
import { registerPresenceHandlers } from "./presence.handlers.js";

let io: Server | undefined;

export function getIO() {
  return io;
}

export function initSockets(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientUrl, credentials: true },
  });

  // Every socket connection must present a valid access token — the same
  // JWT used for REST calls, read from the same HTTP-only cookie.
  io.use((socket, next) => {
    try {
      const raw = socket.handshake.headers.cookie;
      const parsed = raw ? cookie.parse(raw) : {};
      const token = parsed["access_token"];
      if (!token) return next(new Error("Unauthorized"));

      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.username = payload.username;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId: string = socket.data.userId;

    // Personal room for direct notifications (calls, join approvals, etc).
    socket.join(`user:${userId}`);

    registerPresenceHandlers(io!, socket);
    registerMessageHandlers(io!, socket);

    // chat:join — client asks to subscribe to a chat's live events.
    // We re-verify membership server-side; never trust the client's claim.
    socket.on("chat:join", async (chatIdCode: string, ack?: (ok: boolean) => void) => {
      const chat = await prisma.chat.findUnique({ where: { chatId: chatIdCode } });
      if (!chat) return ack?.(false);

      const membership = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: chat.id, userId } },
      });
      if (!membership || membership.status !== "ACTIVE") return ack?.(false);

      socket.join(`chat:${chat.id}`);
      ack?.(true);
    });

    socket.on("chat:leave", (chatIdInternal: string) => {
      socket.leave(`chat:${chatIdInternal}`);
    });

    socket.on("disconnect", async () => {
      await prisma.user.update({ where: { id: userId }, data: { lastSeen: new Date() } });
      io!.emit("user:offline", { userId });
    });
  });

  return io;
}
