const CACHE_NAME = "chatly-v5";
const ASSETS_TO_CACHE = ["/", "/index.html", "/manifest.json", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Handle messages from the app (e.g. SKIP_WAITING on user "Update Now" click)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // ALWAYS BYPASS SERVICE WORKER CACHE FOR /version.json
  if (url.pathname === "/version.json" || url.pathname.endsWith("/version.json")) {
    event.respondWith(
      fetch(event.request, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
      })
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

// Handle Background VAPID Push Notifications & App Badge Counter
self.addEventListener("push", (event) => {
  let data = { title: "New Notification", body: "Message from Chatly", url: "/" };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  // Update PWA App Badge Icon Counter
  if ("setAppBadge" in self.navigator) {
    self.navigator.setAppBadge(1).catch(() => {});
  }

  const options = {
    body: data.body || "Message from Chatly",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200],
    tag: "chatly-push-" + Date.now(),
    renotify: true,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(data.title || "New Notification", options));
});

// Handle mobile notification center click to focus or open chat room & clear badge
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Clear App Badge when user opens notification
  if ("clearAppBadge" in self.navigator) {
    self.navigator.clearAppBadge().catch(() => {});
  }

  const urlToOpen = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
