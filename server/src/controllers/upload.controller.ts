import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError.js";
import { validateUpload, categoryForMimeType } from "../utils/fileValidation.js";
import { buildObjectKey, uploadObject } from "../services/storage.service.js";
import { prisma } from "../utils/prisma.js";

/**
 * POST /api/chats/:chatId/uploads
 * Multipart upload, gated behind requireChatMembership + a message
 * permission check (you can't upload into a chat you can't post in).
 * Returns an attachment id the client then references in message:send.
 */
export async function uploadFile(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) throw new ApiError(400, "No file provided");

    const category = categoryForMimeType(file.mimetype);
    if (!category) throw new ApiError(415, "Unsupported file");

    validateUpload(category, file.mimetype, file.size, file.buffer);

    const chat = await prisma.chat.findUniqueOrThrow({ where: { id: req.chatMembership!.chatId } });
    const membership = req.chatMembership!;
    const canSend =
      chat.messagePermission === "EVERYONE" ||
      (chat.messagePermission === "ADMINS_ONLY" && ["OWNER", "ADMIN"].includes(membership.role));
    if (!canSend) throw new ApiError(403, "Permission denied");

    const key = buildObjectKey(chat.id, file.originalname);
    await uploadObject(key, file.buffer, file.mimetype);

    // Not attached to a message yet — the client links it via
    // message:send({ attachmentId }) so upload progress and send are
    // decoupled (matches the spec's upload-progress UX requirement).
    const pending = {
      fileName: file.originalname,
      fileUrl: key,
      mimeType: file.mimetype,
      fileSize: file.size,
      category,
    };

    res.status(201).json({ attachment: pending });
  } catch (err) {
    next(err);
  }
}
