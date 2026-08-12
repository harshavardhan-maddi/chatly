import type { Request, Response, NextFunction } from "express";
import { createChatSchema, joinChatSchema } from "../validators/chat.validator.js";
import * as chatService from "../services/chat.service.js";
import * as joinRequestService from "../services/joinRequest.service.js";

export async function createChat(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createChatSchema.parse(req.body);
    const chat = await chatService.createChat(req.userId!, input);
    res.status(201).json({ chat });
  } catch (err) {
    next(err);
  }
}

export async function listMyChats(req: Request, res: Response, next: NextFunction) {
  try {
    const memberships = await chatService.listUserChats(req.userId!);
    res.json({ chats: memberships.map((m: (typeof memberships)[number]) => ({ ...m.chat, myRole: m.role })) });
  } catch (err) {
    next(err);
  }
}

export async function getChat(req: Request, res: Response, next: NextFunction) {
  try {
    const chat = await chatService.getChatByCode(req.params.chatId);
    res.json({ chat });
  } catch (err) {
    next(err);
  }
}

/** POST /api/chats/join — direct join, only succeeds for PUBLIC chats. */
export async function joinChat(req: Request, res: Response, next: NextFunction) {
  try {
    const { chatId } = joinChatSchema.parse(req.body);
    const membership = await chatService.joinPublicChat(chatId, req.userId!);
    res.status(200).json({ membership });
  } catch (err) {
    next(err);
  }
}

export async function requestToJoin(req: Request, res: Response, next: NextFunction) {
  try {
    const { chatId } = joinChatSchema.parse(req.body);
    const request = await joinRequestService.requestToJoin(chatId, req.userId!);
    res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
}

export async function reviewJoinRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { decision } = req.body as { decision: "APPROVED" | "REJECTED" };
    const request = await joinRequestService.reviewJoinRequest(req.params.requestId, req.userId!, decision);
    res.json({ request });
  } catch (err) {
    next(err);
  }
}
