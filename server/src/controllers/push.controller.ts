import type { Request, Response, NextFunction } from "express";
import { savePushSubscription, VAPID_PUBLIC_KEY } from "../services/webpush.service.js";

export async function getVapidKey(req: Request, res: Response) {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
}

export async function subscribePush(req: Request, res: Response, next: NextFunction) {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Invalid subscription" });
    }
    await savePushSubscription(req.userId!, subscription);
    res.json({ status: "ok" });
  } catch (err) {
    next(err);
  }
}
