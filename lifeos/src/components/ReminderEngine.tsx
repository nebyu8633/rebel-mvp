"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStore, useSettings } from "@/lib/store/store";
import { dueReminders, remindersForDate } from "@/lib/reminders";
import { nowInZone } from "@/lib/dates";

const SENT_KEY = "lifeos:notified:v1";

function loadSent(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) || "{}");
  } catch {
    return {};
  }
}

/**
 * In-app reminder loop. Runs while the app is open in a tab: checks every 20 seconds,
 * shows an in-app toast and (if permitted) a browser notification. A shared "sent" log
 * in localStorage prevents the same reminder firing twice, across tabs and reloads.
 * Limitation: when every LifeOS tab is closed, nothing runs — see Settings for details.
 */
export function ReminderEngine() {
  const settings = useSettings();
  const toast = useStore((s) => s.toast);
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!settings) return;
    const tick = () => {
      const db = useStore.getState().db;
      const now = nowInZone(settings.timezone);
      const sentLog = loadSent();
      const all = remindersForDate(db, now.date);
      const due = dueReminders(all, now.minutes, new Set(Object.keys(sentLog)));
      if (!due.length) return;
      const ts = Date.now();
      // claim before showing so a second tab can't fire the same reminder
      for (const r of due) sentLog[r.key] = ts;
      for (const [k, v] of Object.entries(sentLog)) if (ts - v > 3 * 86_400_000) delete sentLog[k];
      localStorage.setItem(SENT_KEY, JSON.stringify(sentLog));
      for (const r of due) {
        if (settings.notifyInApp) toast(`⏰ ${r.title} — ${r.body}`, "info", { label: "פתיחה", run: () => routerRef.current.push(r.href) });
        if (settings.notifyBrowser && typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            const n = new Notification(r.title, { body: r.body, tag: r.key, lang: "he", dir: "rtl" });
            n.onclick = () => {
              window.focus();
              routerRef.current.push(r.href);
            };
          } catch {
            // some mobile browsers only allow notifications through a service worker
            navigator.serviceWorker?.ready.then((reg) => reg.showNotification(r.title, { body: r.body, tag: r.key, lang: "he", dir: "rtl", data: { href: r.href } })).catch(() => undefined);
          }
        }
      }
    };
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, [settings, toast]);

  return null;
}
