/**
 * Scheduling engine for goal plans. Uses the SAME task/event data as the calendar, so goals
 * share one global calendar and workload limit.
 *
 * Rules:
 *  - never before dependencies; never after the deadline unless it cannot fit (then flagged)
 *  - no front-loading: a task is placed in a lead window before its deadline
 *  - respects the user's daily availability minus what's already planned (all goals),
 *    keeping a 20% buffer so the day is never filled completely
 *  - respects the goal's weekly hour budget (one-off tasks + routines)
 *  - concrete start times only when the user chose a time of day; timed slots avoid existing
 *    events/timed tasks with a 15-minute buffer
 *  - without any availability information, tasks are proposed WITHOUT dates (user approves)
 */
import type { DB } from "../types";
import type { GoalPlan, GPRoutine, GPTask } from "./schema";
import { addDays, diffDays, minutesToTime, startOfWeek, timeToMinutes, weekday } from "../dates";
import { dayLoad, eventsInRange, instancesInRange, isOpen } from "../tasks";
import { expandRule } from "../recurrence";
import { topoSortGeneric } from "./util";

export const TIME_WINDOWS: Record<string, [number, number]> = {
  morning: [7 * 60, 12 * 60],
  noon: [12 * 60, 16 * 60],
  evening: [18 * 60, 22 * 60],
};

export interface ScheduleOptions {
  db: DB;
  today: string;
  /** Goal id being scheduled — its own existing tasks are excluded from "existing load" (they'll be replaced). */
  goalId: string;
  weeklyMinutes: number | null;
  preferredDays: number[];
  preferredTime: string | null;
  leadDays?: number;
  buffer?: number;
}

export interface ScheduleReport {
  /** No availability info at all → tasks left unscheduled for the user to approve. */
  needsAvailability: boolean;
  overloaded: Array<{ key: string; title: string; deadline: string; date: string }>;
  /** Total minutes the plan needs until the target date vs. what the weekly budget allows. */
  requiredMinutes: number;
  budgetMinutes: number | null;
  alternatives: Array<{ id: "extend" | "reduce" | "hours" | "reconsider"; label: string }>;
  notes: string[];
}

function routineMinutesOnDay(routines: GPRoutine[], d: string): number {
  let m = 0;
  for (const r of routines) {
    if (r.excluded) continue;
    const rule = { freq: r.freq, interval: r.interval, byWeekday: r.byWeekday, byMonthDay: r.byMonthDay ?? undefined, startDate: r.startDate, endDate: r.endDate, count: null, paused: false, exceptions: [], missedPolicy: "carry" as const, backupWeekday: null };
    if (expandRule(rule, d, d).length) m += r.durationMinutes;
  }
  return m;
}

/** Busy intervals on a day: calendar events + timed tasks (other goals), with buffer. */
function busyIntervals(db: DB, d: string, goalId: string, buffer = 15): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const e of eventsInRange(db, d, d)) {
    if (!e.event.startTime) continue;
    const s = timeToMinutes(e.event.startTime);
    out.push([s - buffer, (e.event.endTime ? timeToMinutes(e.event.endTime) : s + 60) + buffer]);
  }
  for (const i of instancesInRange(db, d, d)) {
    if (!i.startTime || !isOpen(i.status) || i.task.goalId === goalId) continue;
    const s = timeToMinutes(i.startTime);
    out.push([s - buffer, s + (i.task.estimatedMinutes || 30) + buffer]);
  }
  return out;
}

export function findSlot(busy: Array<[number, number]>, window: [number, number], duration: number): number | null {
  const sorted = busy.slice().sort((a, b) => a[0] - b[0]);
  for (let s = window[0]; s + duration <= window[1]; s += 15) {
    if (!sorted.some(([a, b]) => s < b && s + duration > a)) return s;
  }
  return null;
}

export function schedulePlan(plan: GoalPlan, o: ScheduleOptions): { plan: GoalPlan; report: ScheduleReport } {
  const { db, today, goalId } = o;
  const settings = db.settings.settings;
  const availability = settings?.availability ?? [null, null, null, null, null, null, null];
  const hasAvailability = availability.some((a) => a != null);
  const buffer = o.buffer ?? 0.8;
  const lead = o.leadDays ?? 10;
  const report: ScheduleReport = { needsAvailability: false, overloaded: [], requiredMinutes: 0, budgetMinutes: null, alternatives: [], notes: [] };
  const timeWindow = o.preferredTime ? TIME_WINDOWS[o.preferredTime] ?? null : null;

  // Existing load from OTHER goals/tasks (this goal's previous tasks will be replaced).
  const existing = (d: string) =>
    instancesInRange(db, d, d)
      .filter((i) => i.task.goalId !== goalId && isOpen(i.status))
      .reduce((s, i) => s + (i.task.estimatedMinutes ?? 0), 0);

  const routines = plan.routines.map((r) => {
    if (r.excluded || r.userEdited || !timeWindow) return r;
    // put routine sessions in the preferred time window, avoiding events on its first occurrence
    const slot = findSlot(busyIntervals(db, r.startDate, goalId), timeWindow, r.durationMinutes);
    return { ...r, startTime: slot != null ? minutesToTime(slot) : null };
  });

  const active = plan.tasks.filter((t) => !t.excluded);
  report.requiredMinutes = active.reduce((s, t) => s + t.durationMinutes, 0);

  if (!hasAvailability && o.weeklyMinutes == null) {
    report.needsAvailability = true;
    report.notes.push("לא הוגדרה זמינות (לא בהגדרות ולא בשיחה) — המשימות מוצעות עם דדליין בלבד, בלי תאריך ביצוע.");
    return { plan: { ...plan, routines, tasks: plan.tasks.map((t) => (t.userEdited ? t : { ...t, date: null, startTime: null })) }, report };
  }

  const weekUsed = new Map<string, number>();
  const dayUsed = new Map<string, number>();
  const weekBudget = (ws: string) => {
    if (o.weeklyMinutes == null) return Infinity;
    let r = 0;
    for (let d = ws; d <= addDays(ws, 6); d = addDays(d, 1)) r += routineMinutesOnDay(routines, d);
    return Math.max(0, o.weeklyMinutes - r);
  };
  const dayCapacity = (d: string) => {
    const a = availability[weekday(d)];
    if (a == null) return hasAvailability ? 0 : Infinity; // day explicitly not available, or unknown everywhere
    return Math.max(0, Math.floor(a * buffer) - existing(d) - routineMinutesOnDay(routines, d));
  };
  const allowedDay = (d: string) => !o.preferredDays.length || o.preferredDays.includes(weekday(d));

  const dateOf = new Map<string, string>();
  for (const t of plan.tasks) if (t.userEdited && t.date) dateOf.set(t.key, t.date);
  const scheduled = new Map<string, GPTask>();
  for (const t of topoSortGeneric(active)) {
    if (t.userEdited && t.date) {
      scheduled.set(t.key, t);
      continue;
    }
    let earliest = today;
    for (const dep of t.dependsOn) {
      const dd = dateOf.get(dep);
      if (dd && dd >= earliest) earliest = addDays(dd, 1);
    }
    const deadline = t.deadline < earliest ? earliest : t.deadline;
    const winStart = addDays(t.deadline, -lead) > earliest ? addDays(t.deadline, -lead) : earliest;
    let chosen: string | null = null;
    for (const strict of [true, false]) {
      for (let d = winStart; d <= deadline && !chosen; d = addDays(d, 1)) {
        if (strict && !allowedDay(d)) continue;
        const ws = startOfWeek(d);
        if ((weekUsed.get(ws) ?? 0) + t.durationMinutes > weekBudget(ws)) continue;
        if ((dayUsed.get(d) ?? 0) + t.durationMinutes > dayCapacity(d)) continue;
        if (!hasAvailability && (dayUsed.get(d) ?? 0) > 0) continue; // unknown daily availability: max one task/day
        chosen = d;
      }
      if (chosen) break;
    }
    const overloaded = !chosen;
    const date = chosen ?? deadline;
    if (overloaded) report.overloaded.push({ key: t.key, title: t.title, deadline: t.deadline, date });
    const ws = startOfWeek(date);
    weekUsed.set(ws, (weekUsed.get(ws) ?? 0) + t.durationMinutes);
    dayUsed.set(date, (dayUsed.get(date) ?? 0) + t.durationMinutes);
    dateOf.set(t.key, date);
    let startTime: string | null = null;
    if (timeWindow) {
      const slot = findSlot(busyIntervals(db, date, goalId), timeWindow, t.durationMinutes);
      startTime = slot != null ? minutesToTime(slot) : null;
    }
    scheduled.set(t.key, { ...t, date, startTime });
  }

  if (o.weeklyMinutes != null) {
    const weeksLeft = Math.max(1, Math.ceil(diffDays(today, plan.targetDate) / 7));
    const routinePerWeek = plan.routines.filter((r) => !r.excluded).reduce((s, r) => s + (r.freq === "weekly" ? r.durationMinutes * r.byWeekday.length : r.freq === "daily" ? r.durationMinutes * 7 : r.durationMinutes / 4), 0);
    report.budgetMinutes = o.weeklyMinutes * weeksLeft;
    if (routinePerWeek > o.weeklyMinutes)
      report.notes.push(`השגרות הקבועות לבדן דורשות כ-${Math.round(routinePerWeek)} דק׳ בשבוע — יותר מ-${o.weeklyMinutes} הדקות שהגדרת.`);
  }
  if (report.overloaded.length) {
    const lowCount = active.filter((t) => t.priority === "low").length;
    report.alternatives = [
      { id: "extend", label: "להאריך את מועד היעד" },
      ...(lowCount ? [{ id: "reduce" as const, label: `להוריד ${lowCount} משימות בעדיפות נמוכה` }] : []),
      { id: "hours", label: "להגדיל את השעות השבועיות למטרה" },
      { id: "reconsider", label: "לחשוב מחדש על היקף המטרה" },
    ];
  }
  const tasks = plan.tasks.map((t) => scheduled.get(t.key) ?? t);
  return { plan: { ...plan, routines, tasks }, report };
}

/** Day-level load check used by the plan page for a selected date. */
export function loadOn(db: DB, d: string) {
  return dayLoad(db, d);
}
