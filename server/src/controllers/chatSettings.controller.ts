import type { Request, Response, NextFunction } from "express";
import { updateChatSchema } from "../validators/chat.validator.js";
import * as chatSettingsService from "../services/chatSettings.service.js";
import * as memberService from "../services/member.service.js";
import { z } from "zod";

export async function updateChat(req: Request, res: Response, next: NextFunction) {
  try {
    const input = updateChatSchema.parse(req.body);
    const chat = await chatSettingsService.updateChat(req.chatMembership!.chatId, input);
    res.json({ chat });
  } catch (err) {
    next(err);
  }
}

export async function deleteChat(req: Request, res: Response, next: NextFunction) {
  try {
    await chatSettingsService.deleteChat(req.chatMembership!.chatId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function leaveChat(req: Request, res: Response, next: NextFunction) {
  try {
    await memberService.leaveChat(req.chatMembership!.chatId, req.userId!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function regenerateChatId(req: Request, res: Response, next: NextFunction) {
  try {
    const chat = await chatSettingsService.regenerateChatId(req.chatMembership!.chatId);
    res.json({ chat });
  } catch (err) {
    next(err);
  }
}

export async function transferOwnership(req: Request, res: Response, next: NextFunction) {
  try {
    const { newOwnerId } = z.object({ newOwnerId: z.string().uuid() }).parse(req.body);
    await chatSettingsService.transferOwnership(req.chatMembership!.chatId, req.userId!, newOwnerId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function listJoinRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const requests = await chatSettingsService.listJoinRequests(req.chatMembership!.chatId);
    res.json({ requests });
  } catch (err) {
    next(err);
  }
}
