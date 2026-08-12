import { prisma } from "../utils/prisma.js";
import { getIO } from "../sockets/index.js";
import type { NotificationType, Prisma } from "@prisma/client";

export async function notifyUser(recipientId: string, type: NotificationType, payload: Prisma.InputJsonValue) {
  const notification = await prisma.notification.create({
    data: { recipientId, type, payload },
  });

  // Push it live if the user has an active socket connection; the DB row
  // still exists for when they're offline and open the Activity tab later.
  getIO()?.to(`user:${recipientId}`).emit("notification:new", notification);

  return notification;
}
