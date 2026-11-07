import type { DB } from "../types";
import { nowInZone, addDays } from "../dates";
import { dueScheduled, scheduledReminders, type ScheduledReminder } from "../game/notify";

/**
 * Reminders that are due for one user right now (server-side scheduler). Includes the previous
 * calendar day so reminders around midnight aren't lost. `sent` = keys already delivered.
 * Muted reminders (category off / quiet hours) are never sent.
 */
export function dueForUser(db: DB, at: Date, sent: Set<string>, graceMinutes = 10): ScheduledReminder[] {
  const tz = db.settings.settings?.timezone || "Asia/Jerusalem";
  const now = nowInZone(tz, at);
  const due = dueScheduled(scheduledReminders(db, now.date), now.minutes, sent, graceMinutes);
  if (now.minutes < graceMinutes) due.push(...dueScheduled(scheduledReminders(db, addDays(now.date, -1)), now.minutes + 24 * 60, sent, graceMinutes));
  return due;
}
