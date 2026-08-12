import type { Server, Socket } from "socket.io";

export function registerPresenceHandlers(io: Server, socket: Socket) {
  const userId: string = socket.data.userId;

  io.emit("user:online", { userId });

  socket.on("typing:start", ({ chatId }: { chatId: string }) => {
    // chatId here is the internal DB id the client received after chat:join.
    socket.to(`chat:${chatId}`).emit("typing:start", { chatId, userId });
  });

  socket.on("typing:stop", ({ chatId }: { chatId: string }) => {
    socket.to(`chat:${chatId}`).emit("typing:stop", { chatId, userId });
  });
}
