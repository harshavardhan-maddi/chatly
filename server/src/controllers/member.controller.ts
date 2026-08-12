import type { Request, Response, NextFunction } from "express";
import * as memberService from "../services/member.service.js";

function ctx(req: Request) {
  return { chatId: req.chatMembership!.chatId, actorId: req.userId!, actorRole: req.chatMembership!.role };
}

export async function listMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const members = await memberService.listMembers(req.chatMembership!.chatId);
    res.json({ members });
  } catch (err) {
    next(err);
  }
}

export async function updateMemberRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { action } = req.body as { action: "PROMOTE" | "DEMOTE" };
    const targetUserId = req.params.userId;
    const result =
      action === "PROMOTE"
        ? await memberService.promoteToAdmin(ctx(req), targetUserId)
        : await memberService.demoteAdmin(ctx(req), targetUserId);
    res.json({ member: result });
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await memberService.removeMember(ctx(req), req.params.userId);
    res.json({ member: result });
  } catch (err) {
    next(err);
  }
}

export async function banMember(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await memberService.banMember(ctx(req), req.params.userId);
    res.json({ member: result });
  } catch (err) {
    next(err);
  }
}

export async function unbanMember(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await memberService.unbanMember(ctx(req), req.params.userId);
    res.json({ member: result });
  } catch (err) {
    next(err);
  }
}
