import type { DB } from "./types";
import { eventsInRange, habitDueOn, instancesInRange, isOpen } from "./tasks";
import { addDays, minutesToTime, timeToMinutes } from "./dates";

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
  // explicit reminders (one or more per task)
  const byTask = new Map<string, DB["reminders"][string][]>();
  for (const r of Object.values(db.reminders ?? {})) {
    if (!r.enabled) continue;
    byTask.set(r.taskId, [...(byTask.get(r.taskId) ?? []), r]);
  }
  if (byTask.size) {
    for (const i of instancesInRange(db, date, date)) {
      const rs = byTask.get(i.task.id);
      if (!rs || !isOpen(i.status)) continue;
      for (const r of rs) {
        if (r.kind === "before_start" && i.date === date && i.startTime && r.minutes != null) {
          const at = timeToMinutes(i.startTime) - r.minutes;
          if (at >= 0) out.push({ key: `rem:${r.id}:${i.key}:${i.startTime}:${r.minutes}`, date, at, time: minutesToTime(at), title: i.title, body: r.minutes ? `מתחיל בעוד ${r.minutes} דק׳ (${i.startTime})` : `עכשיו (${i.startTime})`, kind: "task", href: "/" });
        }
      }
    }
    for (const r of Object.values(db.reminders ?? {})) {
      if (!r.enabled) continue;
      const t = db.tasks[r.taskId];
      if (!t || !isOpen(t.status) || t.recurrence) continue;
      if (r.kind === "at" && r.date === date && r.time) {
        out.push({ key: `rem:${r.id}:${r.date}:${r.time}`, date, at: timeToMinutes(r.time), time: r.time, title: t.title, body: "תזכורת", kind: "task", href: "/" });
      }
      if (r.kind === "before_deadline" && t.deadline && r.minutes != null) {
        // relative to 09:00 on the deadline day, may fall on an earlier day
        const totalBefore = r.minutes;
        const dayOffset = Math.ceil(Math.max(0, totalBefore - 9 * 60) / (24 * 60));
        const fireDate = addDays(t.deadline, -dayOffset);
        const at = 9 * 60 - totalBefore + dayOffset * 24 * 60;
        if (fireDate === date && at >= 0 && at < 24 * 60)
          out.push({ key: `rem:${r.id}:${t.deadline}:${r.minutes}`, date, at, time: minutesToTime(at), title: t.title, body: `דדליין ב-${t.deadline}`, kind: "task", href: "/" });
      }
    }
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
