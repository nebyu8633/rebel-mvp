import type { DB } from "../types";
import { nowInZone, addDays, minutesToTime } from "../dates";
import { dueScheduled, scheduledReminders, type ScheduledReminder } from "../game/notify";
import { instanceFromKey, isOpen } from "../tasks";

/** A reminder is "on time" within this many minutes of its moment; later than that it's "late". */
export const GRACE_MINUTES = 10;
/** Late reminders are still worth sending (as "missed") up to this long after their moment. */
export const RECOVERY_MINUTES = 6 * 60;

/**
 * Reminders that are due for one user right now (server-side scheduler). Looks back over midnight
 * when needed. `sent` = keys already delivered. Muted reminders (category off / quiet hours) are
 * never sent. Completed tasks never appear (the schedule is derived from current task state).
 */
export function dueForUser(db: DB, at: Date, sent: Set<string>, graceMinutes = GRACE_MINUTES): ScheduledReminder[] {
  const tz = db.settings.settings?.timezone || "Asia/Jerusalem";
  const now = nowInZone(tz, at);
  const due = dueScheduled(scheduledReminders(db, now.date), now.minutes, sent, graceMinutes);
  if (now.minutes < graceMinutes) due.push(...dueScheduled(scheduledReminders(db, addDays(now.date, -1)), now.minutes + 24 * 60, sent, graceMinutes));
  return due;
}

export interface Outgoing {
  /** delivery keys this message covers (claimed together, never sent twice) */
  keys: string[];
  title: string;
  body: string;
  href: string;
  tag: string;
  late: boolean;
}

/**
 * What the scheduler should send now: each on-time reminder as its own notification, plus — after
 * an interruption (scheduler down, phone offline) — reminders up to RECOVERY_MINUTES late, still
 * relevant (task open), as ONE "missed" notification (or a single one with its original time).
 */
export function planForUser(db: DB, at: Date, sent: Set<string>): Outgoing[] {
  const tz = db.settings.settings?.timezone || "Asia/Jerusalem";
  const now = nowInZone(tz, at);
  const all = dueForUser(db, at, sent, RECOVERY_MINUTES);
  const onTime: ScheduledReminder[] = [];
  const late: ScheduledReminder[] = [];
  for (const r of all) {
    const age = r.date === now.date ? now.minutes - r.at : now.minutes + 24 * 60 - r.at;
    (age <= GRACE_MINUTES ? onTime : late).push(r);
  }
  const out: Outgoing[] = onTime.map((r) => ({ keys: [r.key], title: r.title, body: r.body, href: r.href, tag: r.key, late: false }));
  if (late.length === 1) {
    const r = late[0];
    out.push({ keys: [r.key], title: `פספסת: ${r.title}`, body: `התזכורת הייתה ל-${r.time}`, href: r.href, tag: r.key, late: true });
  } else if (late.length > 1) {
    const names = late.slice(0, 3).map((r) => r.title).join(" · ");
    out.push({ keys: late.map((r) => r.key), title: `${late.length} תזכורות שפספסת`, body: late.length > 3 ? `${names} ועוד` : names, href: "/today", tag: `late:${now.date}:${minutesToTime(now.minutes)}`, late: true });
  }
  return out;
}

export interface SnoozeRow {
  id: string;
  reminder_key: string;
  instance_key: string | null;
  title: string;
  body: string;
  href: string;
  fire_at: string;
}

/** A server-side snooze is sent when its time has come — unless the task was completed/skipped meanwhile. */
export function snoozeDecision(db: DB, s: SnoozeRow, at: Date): "wait" | "send" | "drop" {
  const fire = Date.parse(s.fire_at);
  if (fire > at.getTime()) return "wait";
  if (at.getTime() - fire > RECOVERY_MINUTES * 60_000) return "drop";
  if (s.instance_key) {
    const inst = instanceFromKey(db, s.instance_key);
    if (!inst || !isOpen(inst.status)) return "drop";
  }
  return "send";
}
