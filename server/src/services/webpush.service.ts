import webpush from "web-push";
import { prisma } from "../utils/prisma.js";

// Standard VAPID keys for Chatly Web Push Notifications
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgD8R69L1uVn071-G2-uK62b95H78r2c7f_R206i8";
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "eL77042_c9-i-i3_lR92j28v6-2_S348_R71-i93_R2";

try {
  webpush.setVapidDetails(
    "mailto:support@chatly.app",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} catch (err) {
  console.error("VAPID initialization warning:", err);
}

export async function savePushSubscription(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: { userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  } catch (err) {
    console.error("Error saving push subscription:", err);
  }
}

export async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) return;

    const data = JSON.stringify(payload);

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            data
          );
        } catch (err: any) {
          // If subscription expired or invalid (410 / 404), remove from database
          if (err.statusCode === 410 || err.statusCode === 404) {
            await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
          }
        }
      })
    );
  } catch (err) {
    console.error("Error sending push to user:", err);
  }
}
