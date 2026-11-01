// Minimal service worker: only used to display notifications and focus the app on click.
// It does NOT schedule reminders in the background (browsers don't allow reliable timers here).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(href);
          return c.focus();
        }
      }
      return self.clients.openWindow(href);
    }),
  );
});

// Web Push (sent by /api/cron/reminders when configured). Works while the browser is running,
// even if no LifeOS tab is open.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "LifeOS", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "LifeOS", { body: data.body || "", tag: data.tag, lang: "he", dir: "rtl", icon: "/icon.svg", data: { href: data.href || "/" } }),
  );
});
