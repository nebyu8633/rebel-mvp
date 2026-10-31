import type { DB } from "./types";
import { addDays, weekday, diffDays } from "./dates";
import { importanceScore, instancesInRange, isOpen, overdueInstances, type TaskInstance } from "./tasks";

export interface RecoveryAction {
  key: string;
  title: string;
  action: "move" | "skip" | "unschedule";
  date?: string;
  reason: string;
}

export interface RecoveryPlan {
  actions: RecoveryAction[];
  warnings: string[];
}

/**
 * Build a realistic recovery plan for missed work instead of dumping everything on tomorrow:
 *  - most important first (priority, deadline, goal link)
 *  - spread over the next `horizon` days within available time
 *  - missed occurrences of recurring routines are skipped (the next one is coming anyway)
 *  - low-priority items without a deadline that don't fit go back to the inbox
 */
export function buildRecoveryPlan(db: DB, today: string, horizon = 7): RecoveryPlan {
  const settings = Object.values(db.settings)[0];
  const availability = settings?.availability ?? [null, null, null, null, null, null, null];
  const unknown = availability.every((a) => a == null);
  const missed = [
    ...overdueInstances(db, today, 14),
    // also include recurring occurrences under other policies within the last week
    ...instancesInRange(db, addDays(today, -7), addDays(today, -1), today).filter(
      (i) => i.recurring && isOpen(i.status) && i.task.recurrence?.missedPolicy !== "carry",
    ),
  ];
  const uniq = new Map<string, TaskInstance>();
  for (const m of missed) uniq.set(m.key, m);
  const list = [...uniq.values()].sort((a, b) => importanceScore(db, b, today) - importanceScore(db, a, today));

  const upcoming = instancesInRange(db, today, addDays(today, horizon - 1), today);
  const used = new Map<string, number>();
  const count = new Map<string, number>();
  for (const i of upcoming) {
    if (!isOpen(i.status)) continue;
    used.set(i.date!, (used.get(i.date!) ?? 0) + (i.task.estimatedMinutes ?? 0));
    count.set(i.date!, (count.get(i.date!) ?? 0) + 1);
  }

  const actions: RecoveryAction[] = [];
  const warnings: string[] = [];
  if (unknown) warnings.push("לא הוגדרה זמינות יומית — השיבוץ מוגבל ל-2 משימות משוחזרות ביום.");
  const recoveredPerDay = new Map<string, number>();

  for (const inst of list) {
    const t = inst.task;
    if (inst.recurring) {
      actions.push({ key: inst.key, title: inst.title, action: "skip", reason: "משימה חוזרת — המופע הבא כבר מתוכנן." });
      continue;
    }
    const dur = t.estimatedMinutes ?? 30;
    const lastDay = t.deadline && t.deadline >= today ? t.deadline : addDays(today, horizon - 1);
    let chosen: string | null = null;
    for (let d = today; d <= lastDay && diffDays(today, d) < horizon; d = addDays(d, 1)) {
      if (unknown) {
        if ((recoveredPerDay.get(d) ?? 0) < 2) {
          chosen = d;
          break;
        }
        continue;
      }
      const avail = availability[weekday(d)];
      if (avail == null) continue;
      if ((used.get(d) ?? 0) + dur <= avail) {
        chosen = d;
        break;
      }
    }
    if (chosen) {
      used.set(chosen, (used.get(chosen) ?? 0) + dur);
      recoveredPerDay.set(chosen, (recoveredPerDay.get(chosen) ?? 0) + 1);
      actions.push({
        key: inst.key,
        title: inst.title,
        action: "move",
        date: chosen,
        reason: t.deadline ? `דדליין ${t.deadline}` : t.priority === "high" ? "עדיפות גבוהה" : "יש זמן פנוי ביום הזה",
      });
    } else if (t.priority === "low" && !t.deadline) {
      actions.push({ key: inst.key, title: inst.title, action: "unschedule", reason: "עדיפות נמוכה ואין זמן פנוי השבוע — חוזרת לרשימת ״ללא תאריך״." });
    } else {
      const d = t.deadline && t.deadline >= today ? t.deadline : addDays(today, horizon - 1);
      actions.push({ key: inst.key, title: inst.title, action: "move", date: d, reason: "אין זמן פנוי — שובצה למרות עומס." });
      warnings.push(`"${inst.title}" שובצה ליום שכבר מלא. שקול/י לוותר על משהו אחר.`);
    }
  }
  return { actions, warnings };
}
