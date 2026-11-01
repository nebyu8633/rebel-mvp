"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStore, useSettings } from "@/lib/store/store";
import { dueReminders, remindersForDate } from "@/lib/reminders";
import { nowInZone } from "@/lib/dates";

const SENT_KEY = "lifeos:notified:v1";
const SNOOZE_KEY = "lifeos:snoozed:v1";

interface Snoozed {
  key: string;
  at: number; // epoch ms
  title: string;
  body: string;
  href: string;
}
function loadSnoozed(): Snoozed[] {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) || "[]");
  } catch {
    return [];
  }
}
export function snooze(r: { key: string; title: string; body: string; href: string }, minutes = 10) {
  const list = loadSnoozed().filter((s) => s.key !== r.key);
  list.push({ ...r, at: Date.now() + minutes * 60_000 });
  localStorage.setItem(SNOOZE_KEY, JSON.stringify(list));
}

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
      const due: Array<{ key: string; title: string; body: string; href: string }> = dueReminders(all, now.minutes, new Set(Object.keys(sentLog)));
      // snoozed reminders whose time has come (same device)
      const snoozed = loadSnoozed();
      const ready = snoozed.filter((x) => x.at <= Date.now());
      if (ready.length) {
        localStorage.setItem(SNOOZE_KEY, JSON.stringify(snoozed.filter((x) => x.at > Date.now())));
        for (const x of ready) if (Date.now() - x.at < 30 * 60_000) due.push({ ...x, key: `${x.key}:snz${x.at}` });
      }
      if (!due.length) return;
      const ts = Date.now();
      // claim before showing so a second tab can't fire the same reminder
      for (const r of due) sentLog[r.key] = ts;
      for (const [k, v] of Object.entries(sentLog)) if (ts - v > 3 * 86_400_000) delete sentLog[k];
      localStorage.setItem(SENT_KEY, JSON.stringify(sentLog));
      for (const r of due) {
        if (settings.notifyInApp)
          toast(`⏰ ${r.title} — ${r.body}`, "info", { label: "פתיחה", run: () => routerRef.current.push(r.href) }, { label: "נודניק 10 דק׳", run: () => snooze({ ...r, key: r.key.split(":snz")[0] }) });
        // when background push is on for this device the server sends the system notification — avoid a duplicate
        const pushOn = (() => {
          try {
            return localStorage.getItem("lifeos:push:on") === "1";
          } catch {
            return false;
          }
        })();
        if (!pushOn && settings.notifyBrowser && typeof Notification !== "undefined" && Notification.permission === "granted") {
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
