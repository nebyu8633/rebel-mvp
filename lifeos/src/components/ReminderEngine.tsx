"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { create } from "zustand";
import { Bell, Play, Clock, CalendarClock, Check, X } from "lucide-react";
import { useStore, useSettings } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { useGameUI } from "@/lib/game/ui";
import { nowInZone } from "@/lib/dates";
import { dueScheduled, scheduledReminders, type ScheduledReminder } from "@/lib/game/notify";
import { appendLog } from "@/lib/game/notifyLog";
import { playSound } from "@/lib/game/sound";
import { profileOf } from "@/lib/game/engine";
import { instanceFromKey, toggleComplete } from "@/lib/actions";

const SENT_KEY = "lifeos:notified:v1";
const SNOOZE_KEY = "lifeos:snoozed:v1";

interface Snoozed {
  key: string;
  at: number; // epoch ms
  title: string;
  body: string;
  href: string;
  instanceKey?: string;
}
function loadSnoozed(): Snoozed[] {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) || "[]");
  } catch {
    return [];
  }
}
export function snooze(r: { key: string; title: string; body: string; href: string; instanceKey?: string }, minutes = 10) {
  const list = loadSnoozed().filter((s) => s.key !== r.key);
  list.push({ key: r.key, title: r.title, body: r.body, href: r.href, instanceKey: r.instanceKey, at: Date.now() + minutes * 60_000 });
  localStorage.setItem(SNOOZE_KEY, JSON.stringify(list));
}

function loadSent(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) || "{}");
  } catch {
    return {};
  }
}

type Card = Pick<ScheduledReminder, "key" | "title" | "body" | "href" | "instanceKey" | "time" | "date">;
const useCards = create<{ cards: Card[]; add(c: Card): void; drop(key: string): void }>((set, get) => ({
  cards: [],
  add: (c) => set({ cards: [...get().cards.filter((x) => x.key !== c.key), c].slice(-4) }),
  drop: (key) => set({ cards: get().cards.filter((x) => x.key !== key) }),
}));

/** Show a reminder now through every enabled channel and record what actually happened. */
export function deliver(r: Card, opts: { inApp: boolean; browser: boolean; sound: Parameters<typeof playSound>[0]; onOpen: (href: string) => void; note?: string }) {
  const channels: Array<"inapp" | "browser" | "sound"> = [];
  if (opts.inApp) {
    useCards.getState().add(r);
    channels.push("inapp");
    if (opts.sound !== "none" && playSound(opts.sound)) channels.push("sound");
  }
  // when background push is on for this device the server sends the system notification — avoid a duplicate
  const pushOn = (() => {
    try {
      return localStorage.getItem("lifeos:push:on") === "1";
    } catch {
      return false;
    }
  })();
  if (opts.browser && !pushOn && typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      const n = new Notification(r.title, { body: r.body, tag: r.key, lang: "he", dir: "rtl" });
      n.onclick = () => {
        window.focus();
        opts.onOpen(r.href);
      };
      channels.push("browser");
    } catch {
      // some mobile browsers only allow notifications through a service worker
      navigator.serviceWorker?.ready.then((reg) => reg.showNotification(r.title, { body: r.body, tag: r.key, lang: "he", dir: "rtl", data: { href: r.href } })).catch(() => undefined);
      channels.push("browser");
    }
  }
  appendLog({ key: r.key, title: r.title, date: r.date, time: r.time, deliveredAt: Date.now(), channels: pushOn && opts.browser ? [...channels, "push-device"] : channels, note: opts.note });
  return channels;
}

/**
 * In-app reminder loop. Runs while the app is open in a tab: checks every 20 seconds and
 * delivers due reminders (in-app card + sound, browser notification if permitted). A shared
 * "sent" log in localStorage prevents the same reminder firing twice, across tabs and reloads.
 * Limitation: when every LifeOS tab is closed, nothing runs here — only Web Push (server) can.
 */
export function ReminderEngine() {
  const settings = useSettings();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!settings) return;
    const tick = () => {
      const db = useStore.getState().db;
      const profile = profileOf(db);
      const now = nowInZone(settings.timezone);
      const sentLog = loadSent();
      const all = scheduledReminders(db, now.date);
      const due: Card[] = dueScheduled(all, now.minutes, new Set(Object.keys(sentLog)));
      // snoozed reminders whose time has come (same device)
      const snoozed = loadSnoozed();
      const ready = snoozed.filter((x) => x.at <= Date.now());
      if (ready.length) {
        localStorage.setItem(SNOOZE_KEY, JSON.stringify(snoozed.filter((x) => x.at > Date.now())));
        for (const x of ready) {
          // a snoozed task reminder is dropped if the task got done meanwhile
          const inst = x.instanceKey ? instanceFromKey(db, x.instanceKey) : null;
          if (x.instanceKey && (!inst || inst.status === "completed" || inst.status === "skipped")) continue;
          if (Date.now() - x.at < 30 * 60_000) due.push({ ...x, key: `${x.key}:snz${x.at}`, date: now.date, time: now.time.slice(0, 5) });
        }
      }
      if (!due.length) return;
      const ts = Date.now();
      // claim before showing so a second tab can't fire the same reminder
      for (const r of due) sentLog[r.key] = ts;
      for (const [k, v] of Object.entries(sentLog)) if (ts - v > 3 * 86_400_000) delete sentLog[k];
      localStorage.setItem(SENT_KEY, JSON.stringify(sentLog));
      for (const r of due) deliver(r, { inApp: settings.notifyInApp, browser: settings.notifyBrowser, sound: profile?.notify.sound ?? "chime", onOpen: (h) => routerRef.current.push(h) });
    };
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, [settings]);

  return null;
}

/** In-app reminder cards with real actions: start (focus), snooze, reschedule, complete. */
export function ReminderCards() {
  const cards = useCards((s) => s.cards);
  const drop = useCards((s) => s.drop);
  const router = useRouter();
  if (!cards.length) return null;
  return (
    <div className="fixed inset-x-0 top-3 z-[62] flex flex-col items-center gap-2 px-3" aria-live="assertive">
      {cards.map((c) => {
        const db = useStore.getState().db;
        const inst = c.instanceKey ? instanceFromKey(db, c.instanceKey) : null;
        const open = inst && inst.status !== "completed" && inst.status !== "skipped" ? inst : null;
        const btn = "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium hover:bg-white/10";
        return (
          <div key={c.key} role="alert" className="glass animate-sheet w-full max-w-md rounded-2xl p-3 shadow-2xl" data-testid="reminder-card">
            <div className="flex items-start gap-2.5">
              <Bell size={17} className="gold-text mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{c.title}</div>
                <div className="text-[12px] text-slate-300">{c.body}</div>
              </div>
              <button onClick={() => drop(c.key)} className="rounded-lg p-1 text-slate-400 hover:bg-white/10" aria-label="סגירה">
                <X size={16} />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1 border-t border-white/10 pt-2 text-slate-100">
              {open ? (
                <>
                  <button
                    className={`${btn} text-amber-200`}
                    onClick={() => {
                      drop(c.key);
                      useGameUI.getState().openFocus(open.key);
                    }}
                  >
                    <Play size={13} /> התחלה
                  </button>
                  <button
                    className={btn}
                    onClick={() => {
                      drop(c.key);
                      snooze({ ...c, key: c.key.split(":snz")[0] });
                    }}
                  >
                    <Clock size={13} /> נודניק 10 דק׳
                  </button>
                  <button
                    className={btn}
                    onClick={() => {
                      drop(c.key);
                      useUI.getState().openReschedule(open);
                    }}
                  >
                    <CalendarClock size={13} /> דחייה
                  </button>
                  <button
                    className={btn}
                    onClick={() => {
                      drop(c.key);
                      void toggleComplete(open);
                    }}
                  >
                    <Check size={13} /> בוצע
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={`${btn} text-amber-200`}
                    onClick={() => {
                      drop(c.key);
                      router.push(c.href);
                    }}
                  >
                    פתיחה
                  </button>
                  {!c.instanceKey && (
                    <button
                      className={btn}
                      onClick={() => {
                        drop(c.key);
                        snooze({ ...c, key: c.key.split(":snz")[0] });
                      }}
                    >
                      <Clock size={13} /> נודניק 10 דק׳
                    </button>
                  )}
                  {c.instanceKey && <span className="px-2 py-1.5 text-[12px] text-emerald-300">כבר בוצע ✓</span>}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
