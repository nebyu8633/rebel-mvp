import type { Habit, HabitLog } from "./types";
import { addDays, startOfWeek } from "./dates";
import { habitDueOn } from "./tasks";

export type LogIndex = Record<string, HabitLog>;
const done = (logs: LogIndex, h: Habit, d: string) => logs[`${h.id}:${d}`]?.status === "done";

/** Completion for one week. `due` counts only days up to today; skipped days are excused, not failures. */
export function weekCompletion(h: Habit, logs: LogIndex, weekStart: string, today: string): { done: number; due: number; rate: number | null } {
  const end = addDays(weekStart, 6);
  let d = 0;
  let due = 0;
  if (h.frequency.type === "times_per_week") {
    for (let x = weekStart; x <= end; x = addDays(x, 1)) if (done(logs, h, x)) d++;
    const target = h.frequency.count;
    return { done: d, due: target, rate: Math.min(1, d / target) };
  }
  for (let x = weekStart; x <= end && x <= today; x = addDays(x, 1)) {
    if (!habitDueOn(h, x)) continue;
    if (logs[`${h.id}:${x}`]?.status === "skipped") continue;
    due++;
    if (done(logs, h, x)) d++;
  }
  return { done: d, due, rate: due ? d / due : null };
}

/** Current streak: consecutive due days (or weeks, for N-per-week habits) completed. Today doesn't break it. */
export function streak(h: Habit, logs: LogIndex, today: string, weekStartsOn = 0): number {
  if (h.frequency.type === "times_per_week") {
    let n = 0;
    let ws = startOfWeek(today, weekStartsOn);
    if (weekCompletion(h, logs, ws, today).rate === 1) n++;
    for (let i = 0; i < 104; i++) {
      ws = addDays(ws, -7);
      if (ws < startOfWeek(h.startDate, weekStartsOn)) break;
      if (weekCompletion(h, logs, ws, addDays(ws, 6)).rate === 1) n++;
      else break;
    }
    return n;
  }
  let n = 0;
  let d = today;
  if (!done(logs, h, d)) d = addDays(d, -1);
  for (let i = 0; i < 1000 && d >= h.startDate; i++, d = addDays(d, -1)) {
    if (!habitDueOn({ ...h, paused: false }, d)) continue;
    const l = logs[`${h.id}:${d}`];
    if (l?.status === "done") n++;
    else if (l?.status === "skipped") continue;
    else break;
  }
  return n;
}

export function describeFrequency(h: Habit): string {
  const WD = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
  if (h.frequency.type === "daily") return "כל יום";
  if (h.frequency.type === "weekdays") return `בימים ${h.frequency.days.map((d) => WD[d]).join(" ")}`;
  return `${h.frequency.count} פעמים בשבוע`;
}
