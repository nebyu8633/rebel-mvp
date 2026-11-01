import type { DB } from "../types";
import { nowInZone, addDays } from "../dates";
import { dueReminders, remindersForDate, type Reminder } from "../reminders";

/**
 * Reminders that are due for one user right now (server-side scheduler). Includes the previous
 * calendar day so reminders around midnight aren't lost. `sent` = keys already delivered.
 */
export function dueForUser(db: DB, at: Date, sent: Set<string>, graceMinutes = 10): Reminder[] {
  const tz = db.settings.settings?.timezone || "Asia/Jerusalem";
  const now = nowInZone(tz, at);
  const today = remindersForDate(db, now.date);
  const due = dueReminders(today, now.minutes, sent, graceMinutes);
  if (now.minutes < graceMinutes) {
    const y = remindersForDate(db, addDays(now.date, -1));
    due.push(...dueReminders(y, now.minutes + 24 * 60, sent, graceMinutes));
  }
  return due;
}
