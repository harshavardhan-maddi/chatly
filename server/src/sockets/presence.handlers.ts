import type { Server, Socket } from "socket.io";

const userSocketCounts = new Map<string, number>();
const onlineUserIds = new Set<string>();

export function getOnlineUsers(): string[] {
  return Array.from(onlineUserIds);
}

export function registerPresenceHandlers(io: Server, socket: Socket) {
  const userId: string = socket.data.userId;
  const userName: string = socket.data.name || socket.data.username || "Member";

  const currentCount = userSocketCounts.get(userId) || 0;
  userSocketCounts.set(userId, currentCount + 1);
  onlineUserIds.add(userId);

  // Broadcast live online user presence
  io.emit("user:online", { userId, onlineUsers: Array.from(onlineUserIds) });

  socket.on("presence:get", (ack?: (onlineUsers: string[]) => void) => {
    ack?.(Array.from(onlineUserIds));
  });

  socket.on("typing:start", ({ chatId, chatIdCode }: { chatId: string; chatIdCode?: string }) => {
    socket.to(`chat:${chatId}`).emit("typing:start", { chatId, userId, userName });
    if (chatIdCode && chatIdCode !== chatId) {
      socket.to(`chat:${chatIdCode}`).emit("typing:start", { chatId, userId, userName });
    }
  });

  socket.on("typing:stop", ({ chatId, chatIdCode }: { chatId: string; chatIdCode?: string }) => {
    socket.to(`chat:${chatId}`).emit("typing:stop", { chatId, userId, userName });
    if (chatIdCode && chatIdCode !== chatId) {
      socket.to(`chat:${chatIdCode}`).emit("typing:stop", { chatId, userId, userName });
    }
  });
}

export function handleUserDisconnect(io: Server, socket: Socket) {
  const userId: string = socket.data.userId;
  const currentCount = (userSocketCounts.get(userId) || 1) - 1;

  if (currentCount <= 0) {
    userSocketCounts.delete(userId);
    onlineUserIds.delete(userId);
    io.emit("user:offline", { userId, onlineUsers: Array.from(onlineUserIds) });
  } else {
    userSocketCounts.set(userId, currentCount);
  }
}
