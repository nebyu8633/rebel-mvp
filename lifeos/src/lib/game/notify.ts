/**
 * Game reminders on top of the regular ones: a prep message before a timed task, a "time to
 * start" message, and a follow-up if it's still open — e.g. 17:45 / 18:00 / 18:15 for an
 * 18:00 workout. Plus a daily nudge for unfinished work, a challenge reminder and an upcoming-
 * milestone reminder. Everything is derived from real data; a reminder disappears by itself once
 * the task is done. Categories and quiet hours come from the game profile.
 */
import type { DB, GameProfile } from "../types";
import { addDays, minutesToTime, timeToMinutes } from "../dates";
import { instancesInRange, isOpen, overdueInstances } from "../tasks";
import { remindersForDate, type Reminder } from "../reminders";
import { profileOf, taskXp } from "./engine";
import { challengesFor } from "./challenges";

export type ReminderCategory = keyof GameProfile["notify"]["categories"];

export interface GameReminder extends Reminder {
  category: ReminderCategory;
  /** High priority reminders ignore quiet hours. */
  urgent: boolean;
  /** Task instance it belongs to (enables start / snooze / reschedule / complete actions). */
  instanceKey?: string;
  stage?: "prep" | "start" | "follow" | "other";
}

export const CATEGORY_LABEL: Record<ReminderCategory, string> = {
  standard: "רגילות",
  high: "עדיפות גבוהה",
  repeat: "משימות שלא הושלמו",
  challenge: "אתגרים",
  achievement: "הישגים",
  milestone: "אבני דרך",
};

function inQuiet(at: number, p: GameProfile | null): boolean {
  const s = p?.notify.quietStart;
  const e = p?.notify.quietEnd;
  if (!s || !e) return false;
  const a = timeToMinutes(s);
  const b = timeToMinutes(e);
  return a <= b ? at >= a && at < b : at >= a || at < b;
}

export function gameReminders(db: DB, date: string): GameReminder[] {
  const p = profileOf(db);
  const out: GameReminder[] = [];
  const prepOn = p?.notify.prepAndFollowUp ?? true;
  const prep = p?.notify.prepMinutes ?? 15;
  const follow = p?.notify.followUpMinutes ?? 15;
  if (prepOn) {
    for (const i of instancesInRange(db, date, date)) {
      if (!i.startTime || !isOpen(i.status) || i.date !== date) continue;
      const start = timeToMinutes(i.startTime);
      const xp = taskXp(db, i.task);
      const high = i.task.priority === "high";
      const cat: ReminderCategory = high ? "high" : "standard";
      const base = { date, kind: "task" as const, href: "/today", instanceKey: i.key, urgent: high };
      // an explicit reminder on the task already covers the "before" moment
      if (i.task.reminderMinutes == null && prep > 0 && start - prep >= 0)
        out.push({ ...base, key: `g:prep:${i.key}:${date}:${i.startTime}:${prep}`, at: start - prep, time: minutesToTime(start - prep), title: `בעוד ${prep} דק׳: ${i.title}`, body: `כדאי להתכונן · +${xp} XP`, category: cat, stage: "prep" });
      if (i.task.reminderMinutes !== 0)
        out.push({ ...base, key: `g:start:${i.key}:${date}:${i.startTime}`, at: start, time: i.startTime, title: `הגיע הזמן: ${i.title}`, body: `מתחילים את המסע · +${xp} XP`, category: cat, stage: "start" });
      if (follow > 0 && start + follow < 24 * 60)
        out.push({ ...base, key: `g:follow:${i.key}:${date}:${i.startTime}:${follow}`, at: start + follow, time: minutesToTime(start + follow), title: `התחלת? ${i.title}`, body: "אפשר להתחיל, לדחות או לסמן שבוצע", category: "repeat", stage: "follow" });
    }
  }
  // unfinished work from earlier days — one gentle nudge a day
  const overdue = overdueInstances(db, date);
  if (overdue.length)
    out.push({ key: `g:overdue:${date}`, date, at: 10 * 60, time: "10:00", title: `${overdue.length === 1 ? "משימה אחת מחכה" : `${overdue.length} משימות מחכות`} מימים קודמים`, body: "אפשר לבחור אחת ולהמשיך — בלי עונש", kind: "task", href: "/today", category: "repeat", urgent: false, stage: "other" });
  // daily challenge still open in the evening
  const ch = challengesFor(db, date).find((c) => c.period === "daily" && !c.done);
  if (ch)
    out.push({ key: `g:challenge:${ch.id}`, date, at: 19 * 60, time: "19:00", title: `אתגר יומי: ${ch.title}`, body: `${ch.progress}/${ch.target} · +${ch.xp} XP`, kind: "task", href: "/challenges", category: "challenge", urgent: false, stage: "other" });
  // milestone planned for tomorrow
  for (const m of Object.values(db.milestones)) {
    if (m.status === "done" || m.targetDate !== addDays(date, 1)) continue;
    out.push({ key: `g:ms:${m.id}:${m.targetDate}`, date, at: 9 * 60, time: "09:00", title: `אבן דרך מחר: ${m.title}`, body: "כדאי לבדוק מה נשאר", kind: "task", href: "/quests", category: "milestone", urgent: false, stage: "other" });
  }
  return out;
}

export interface ScheduledReminder extends GameReminder {
  /** Why it will not be delivered (category off / quiet hours), or null. */
  muted: null | "category" | "quiet";
}

/** Every reminder for `date` with its category and mute state. Used by the engine, the server and the log. */
export function scheduledReminders(db: DB, date: string): ScheduledReminder[] {
  const p = profileOf(db);
  const regular: GameReminder[] = remindersForDate(db, date).map((r) => {
    const key = r.instanceKey;
    const t = key ? (db.tasks[key] ?? db.tasks[key.slice(0, -11)]) : null;
    const high = t?.priority === "high";
    return { ...r, category: high ? "high" : "standard", urgent: !!high, stage: "other" };
  });
  const all = [...regular, ...gameReminders(db, date)].sort((a, b) => a.at - b.at);
  return all.map((r) => ({
    ...r,
    muted: p && !p.notify.categories[r.category] ? "category" : !r.urgent && inQuiet(r.at, p) ? "quiet" : null,
  }));
}

/** Due now, not muted, not already sent. */
export function dueScheduled(all: ScheduledReminder[], nowMinutes: number, sent: Set<string>, graceMinutes = 10): ScheduledReminder[] {
  return all.filter((r) => !r.muted && r.at <= nowMinutes && nowMinutes - r.at <= graceMinutes && !sent.has(r.key));
}
