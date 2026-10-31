import type { DB } from "./types";
import { eventsInRange, habitDueOn, instancesInRange, isOpen } from "./tasks";
import { minutesToTime, timeToMinutes } from "./dates";

export interface Reminder {
  /** Stable key used for duplicate prevention: same reminder never fires twice. */
  key: string;
  date: string;
  /** Wall-clock minute of day (user's time zone) when the reminder fires. */
  at: number;
  time: string;
  title: string;
  body: string;
  kind: "task" | "event" | "habit" | "meal";
  href: string;
}

/** All reminders scheduled for `date`. Pure; the caller decides which are due. */
export function remindersForDate(db: DB, date: string): Reminder[] {
  const out: Reminder[] = [];
  const settings = db.settings.settings;
  for (const i of instancesInRange(db, date, date)) {
    if (!i.startTime || i.task.reminderMinutes == null || !isOpen(i.status)) continue;
    const at = timeToMinutes(i.startTime) - i.task.reminderMinutes;
    if (at < 0) continue;
    out.push({
      key: `task:${i.key}:${date}:${i.startTime}:${i.task.reminderMinutes}`,
      date,
      at,
      time: minutesToTime(at),
      title: i.title,
      body: i.task.reminderMinutes ? `מתחיל בעוד ${i.task.reminderMinutes} דק׳ (${i.startTime})` : `עכשיו (${i.startTime})`,
      kind: "task",
      href: i.task.routine === "grocery" ? "/meals?tab=groceries" : i.task.routine === "meal_prep" ? "/meals?tab=prep" : i.task.routine === "weekly_review" ? "/progress?review=1" : "/",
    });
  }
  for (const e of eventsInRange(db, date, date)) {
    if (!e.event.startTime || e.event.reminderMinutes == null) continue;
    const at = timeToMinutes(e.event.startTime) - e.event.reminderMinutes;
    if (at < 0) continue;
    out.push({ key: `event:${e.key}:${e.event.startTime}:${e.event.reminderMinutes}`, date, at, time: minutesToTime(at), title: e.event.title, body: `ב-${e.event.startTime}`, kind: "event", href: "/calendar" });
  }
  for (const h of Object.values(db.habits)) {
    if (!h.reminderTime || !habitDueOn(h, date)) continue;
    if (db.habitLogs[`${h.id}:${date}`]) continue;
    out.push({ key: `habit:${h.id}:${date}:${h.reminderTime}`, date, at: timeToMinutes(h.reminderTime), time: h.reminderTime, title: h.title, body: "תזכורת להרגל", kind: "habit", href: "/habits" });
  }
  if (settings)
    for (const m of settings.mealReminders) {
      if (!m.enabled) continue;
      out.push({ key: `meal:${m.id}:${date}:${m.time}`, date, at: timeToMinutes(m.time), time: m.time, title: m.label, body: "תזכורת לארוחה", kind: "meal", href: "/meals" });
    }
  return out.sort((a, b) => a.at - b.at);
}

/** Reminders that should fire now: fire time passed within the grace window and not already sent. */
export function dueReminders(all: Reminder[], nowMinutes: number, sent: Set<string>, graceMinutes = 10): Reminder[] {
  return all.filter((r) => r.at <= nowMinutes && nowMinutes - r.at <= graceMinutes && !sent.has(r.key));
}
