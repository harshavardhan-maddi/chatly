import { api } from "./api";
import { playNotificationSound } from "../utils/audio";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerGlobalPushSubscription() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

  try {
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }

    if (Notification.permission !== "granted") return;

    const reg = await navigator.serviceWorker.ready;
    const { data } = await api.get<{ publicKey: string }>("/push/vapid-key");
    if (!data.publicKey) return;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
    }

    if (sub) {
      await api.post("/push/subscribe", { subscription: sub });
    }
  } catch (err) {
    console.error("Global Web Push registration error:", err);
  }
}

export async function triggerAppNotification(title: string = "New Notification", body: string = "Message from Chatly", url: string = "") {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  playNotificationSound();

  if (Notification.permission !== "granted") return;

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: "chatly-msg-" + Date.now(),
          renotify: true,
          vibrate: [200, 100, 200],
          data: { url },
        } as NotificationOptions);
        return;
      }
    }
    new Notification(title, { body, icon: "/icon-192.png" });
  } catch (err) {
    console.error("Mobile notification trigger error:", err);
  }
}
