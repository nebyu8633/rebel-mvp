// LifeOS service worker v2: displays notifications and opens the right task on click.
// It does NOT schedule reminders in the background (browsers don't allow reliable timers here).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/today";
  // only ever open LifeOS itself
  let url = new URL(href, self.location.origin);
  if (url.origin !== self.location.origin) url = new URL("/today", self.location.origin);
  url = url.href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (list) => {
      // reuse an open LifeOS window (on iPhone: the installed app), else open one
      const win = list.find((c) => c.url.startsWith(self.location.origin)) || list[0];
      if (win) {
        try {
          const nav = "navigate" in win ? await win.navigate(url) : null;
          return (nav || win).focus();
        } catch {
          /* navigate() is refused for uncontrolled windows — fall through */
        }
      }
      return self.clients.openWindow(url);
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
        // iOS requires every push to show a notification; the tag collapses a re-sent reminder into one
    self.registration.showNotification(data.title || "LifeOS", { body: data.body || "", tag: data.tag, lang: "he", dir: "rtl", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { href: data.href || "/today" } }),
  );
});
