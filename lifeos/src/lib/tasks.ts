import type { DB, Occurrence, Priority, Task, TaskStatus, CalendarEvent, Habit } from "./types";
import { addDays, timeToMinutes, weekday, startOfWeek, diffDays } from "./dates";
import { backupDateFor, expandRule, isOccurrence } from "./recurrence";

/**
 * A concrete appearance of a task on a day. Non-recurring tasks have exactly one
 * instance (key = task.id). Recurring tasks have one per occurrence
 * (key = `${task.id}:${originalDate}`), backed by an optional Occurrence record.
 */
export interface TaskInstance {
  key: string;
  task: Task;
  occurrence: Occurrence | null;
  recurring: boolean;
  originalDate: string | null;
  date: string | null;
  startTime: string | null;
  title: string;
  notes: string;
  status: TaskStatus;
  /** For recurring occurrences moved automatically to a backup day. */
  movedToBackup?: boolean;
}

export const occurrenceId = (taskId: string, originalDate: string) => `${taskId}:${originalDate}`;

export const DONE_STATUSES: TaskStatus[] = ["completed", "skipped"];
export const isOpen = (s: TaskStatus) => !DONE_STATUSES.includes(s);

export const PRIORITY_WEIGHT: Record<Priority, number> = { high: 3, medium: 2, low: 1 };

function makeRecurringInstance(task: Task, originalDate: string, occ: Occurrence | null): TaskInstance {
  return {
    key: occurrenceId(task.id, originalDate),
    task,
    occurrence: occ,
    recurring: true,
    originalDate,
    date: occ?.date ?? originalDate,
    startTime: occ?.startTime ?? task.startTime,
    title: occ?.title ?? task.title,
    notes: occ?.notes ?? task.notes,
    status: occ?.status ?? "planned",
  };
}

function occurrencesByTask(db: DB): Map<string, Occurrence[]> {
  const m = new Map<string, Occurrence[]>();
  for (const o of Object.values(db.occurrences)) {
    const arr = m.get(o.taskId) ?? [];
    arr.push(o);
    m.set(o.taskId, arr);
  }
  return m;
}

/**
 * All instances of a recurring task whose effective date is within [from, to].
 * - Stored occurrences are always honoured for completed/skipped history,
 *   even if the series was later edited.
 * - An occurrence moved by the user ("this occurrence only") appears on its new date.
 */
export function recurringInstances(
  task: Task,
  occs: Occurrence[],
  from: string,
  to: string,
  today?: string,
): TaskInstance[] {
  const rule = task.recurrence!;
  const byOriginal = new Map(occs.map((o) => [o.originalDate, o]));
  const result = new Map<string, TaskInstance>();

  // Look back a little so backup-day moves from earlier in the week can land in range.
  const lookback = rule.missedPolicy === "backup" ? 7 : 0;
  for (const d of expandRule(rule, addDays(from, -lookback), to)) {
    const inst = makeRecurringInstance(task, d, byOriginal.get(d) ?? null);
    // Backup policy: an untouched past occurrence moves to its backup day.
    if (today && !inst.occurrence && d < today) {
      const b = backupDateFor(rule, d);
      if (b && b >= today) {
        inst.date = b;
        inst.movedToBackup = true;
      }
    }
    result.set(d, inst);
  }
  for (const o of occs) {
    if (result.has(o.originalDate)) continue;
    const keep = !isOpen(o.status) || isOccurrence({ ...rule, exceptions: [] }, o.originalDate);
    if (!keep) continue;
    if (rule.exceptions?.includes(o.originalDate) && isOpen(o.status)) continue;
    result.set(o.originalDate, makeRecurringInstance(task, o.originalDate, o));
  }
  return [...result.values()].filter((i) => i.date! >= from && i.date! <= to);
}

export function singleInstance(task: Task): TaskInstance {
  return {
    key: task.id,
    task,
    occurrence: null,
    recurring: false,
    originalDate: task.date,
    date: task.date,
    startTime: task.startTime,
    title: task.title,
    notes: task.notes,
    status: task.status,
  };
}

/** Every task instance with an effective date in [from, to]. */
export function instancesInRange(db: DB, from: string, to: string, today?: string): TaskInstance[] {
  const occMap = occurrencesByTask(db);
  const out: TaskInstance[] = [];
  for (const t of Object.values(db.tasks)) {
    if (t.recurrence) out.push(...recurringInstances(t, occMap.get(t.id) ?? [], from, to, today));
    else if (t.date && t.date >= from && t.date <= to) out.push(singleInstance(t));
  }
  return sortInstances(out);
}

/**
 * Open instances scheduled before today.
 * Recurring series honour their missed-occurrence policy:
 *  carry → stays overdue (limited look-back so a daily series can't flood the list),
 *  skip → silently treated as missed, backup → handled by moving (see recurringInstances).
 */
export function overdueInstances(db: DB, today: string, recurringLookbackDays = 7): TaskInstance[] {
  const occMap = occurrencesByTask(db);
  const out: TaskInstance[] = [];
  const yesterday = addDays(today, -1);
  for (const t of Object.values(db.tasks)) {
    if (t.recurrence) {
      if (t.recurrence.missedPolicy !== "carry") continue;
      const insts = recurringInstances(t, occMap.get(t.id) ?? [], addDays(today, -recurringLookbackDays), yesterday, today);
      out.push(...insts.filter((i) => isOpen(i.status)));
    } else if (t.date && t.date < today && isOpen(t.status)) {
      out.push(singleInstance(t));
    }
  }
  return sortInstances(out);
}

/** Missed recurring occurrences (any policy) in a window — used for weekly review and recovery. */
export function missedInstances(db: DB, from: string, to: string, today: string): TaskInstance[] {
  return instancesInRange(db, from, to, today).filter((i) => i.date! < today && isOpen(i.status));
}

export function unscheduledTasks(db: DB): Task[] {
  return Object.values(db.tasks).filter((t) => !t.recurrence && !t.date && isOpen(t.status));
}

export function sortInstances(list: TaskInstance[]): TaskInstance[] {
  return list.sort((a, b) => {
    if (a.date !== b.date) return (a.date ?? "9999") < (b.date ?? "9999") ? -1 : 1;
    const ta = a.startTime ? timeToMinutes(a.startTime) : 24 * 60;
    const tb = b.startTime ? timeToMinutes(b.startTime) : 24 * 60;
    if (ta !== tb) return ta - tb;
    return PRIORITY_WEIGHT[b.task.priority] - PRIORITY_WEIGHT[a.task.priority];
  });
}

/** Unfinished dependencies of a task (non-recurring tasks only can be dependencies). */
export function blockingDependencies(db: DB, task: Task): Task[] {
  return task.dependsOn.map((id) => db.tasks[id]).filter((t): t is Task => !!t && isOpen(t.status));
}

/**
 * Score used to choose "the most important action" for today.
 * Combines priority, deadline proximity, goal linkage, and being overdue. Blocked tasks lose.
 */
export function importanceScore(db: DB, inst: TaskInstance, today: string): number {
  const t = inst.task;
  let s = PRIORITY_WEIGHT[t.priority] * 10;
  if (t.goalId) s += 6;
  if (t.deadline) {
    const left = diffDays(today, t.deadline);
    if (left <= 0) s += 15;
    else if (left <= 3) s += 10;
    else if (left <= 7) s += 5;
  }
  if (inst.date && inst.date < today) s += 4;
  if (t.routine) s -= 2;
  if (blockingDependencies(db, t).length) s -= 40;
  return s;
}

export function mostImportant(db: DB, list: TaskInstance[], today: string): TaskInstance | null {
  const open = list.filter((i) => isOpen(i.status));
  if (!open.length) return null;
  return open.slice().sort((a, b) => importanceScore(db, b, today) - importanceScore(db, a, today))[0];
}

// ───────────── Capacity ─────────────

export interface DayLoad {
  date: string;
  plannedMinutes: number;
  availableMinutes: number | null;
  unestimated: number;
  over: boolean;
}

export function dayLoad(db: DB, date: string, instances?: TaskInstance[]): DayLoad {
  const settings = Object.values(db.settings)[0];
  const list = instances ?? instancesInRange(db, date, date);
  const open = list.filter((i) => i.date === date && i.status !== "skipped");
  const planned = open.reduce((s, i) => s + (i.task.estimatedMinutes ?? 0), 0);
  const unestimated = open.filter((i) => !i.task.estimatedMinutes).length;
  const available = settings?.availability?.[weekday(date)] ?? null;
  return {
    date,
    plannedMinutes: planned,
    availableMinutes: available,
    unestimated,
    over: available != null && planned > available,
  };
}

export function weekLoads(db: DB, weekStartDate: string): DayLoad[] {
  const to = addDays(weekStartDate, 6);
  const list = instancesInRange(db, weekStartDate, to);
  const out: DayLoad[] = [];
  for (let d = weekStartDate; d <= to; d = addDays(d, 1)) out.push(dayLoad(db, d, list));
  return out;
}

// ───────────── Events & habits on a day ─────────────

export interface EventInstance {
  key: string;
  event: CalendarEvent;
  date: string;
}

export function eventsInRange(db: DB, from: string, to: string): EventInstance[] {
  const out: EventInstance[] = [];
  for (const e of Object.values(db.events)) {
    if (e.recurrence) {
      for (const d of expandRule(e.recurrence, from, to)) out.push({ key: `${e.id}:${d}`, event: e, date: d });
    } else if (e.date >= from && e.date <= to) out.push({ key: e.id, event: e, date: e.date });
  }
  return out.sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.event.startTime ?? "99") < (b.event.startTime ?? "99") ? -1 : 1,
  );
}

export function habitDueOn(h: Habit, date: string): boolean {
  if (h.paused || date < h.startDate) return false;
  switch (h.frequency.type) {
    case "daily":
      return true;
    case "weekdays":
      return h.frequency.days.includes(weekday(date));
    case "times_per_week":
      return true; // flexible: can be done any day; target is per week
  }
}

/** Conflicts: timed items on the same day whose intervals overlap. */
export interface TimedItem {
  key: string;
  title: string;
  date: string;
  start: number;
  end: number;
}

export function findConflicts(items: TimedItem[]): Array<[TimedItem, TimedItem]> {
  const out: Array<[TimedItem, TimedItem]> = [];
  const byDay = new Map<string, TimedItem[]>();
  for (const it of items) {
    const arr = byDay.get(it.date) ?? [];
    arr.push(it);
    byDay.set(it.date, arr);
  }
  for (const arr of byDay.values()) {
    arr.sort((a, b) => a.start - b.start);
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length && arr[j].start < arr[i].end; j++) out.push([arr[i], arr[j]]);
  }
  return out;
}

export function timedItemsFor(db: DB, from: string, to: string): TimedItem[] {
  const items: TimedItem[] = [];
  for (const i of instancesInRange(db, from, to)) {
    if (!i.startTime || i.status === "skipped") continue;
    const s = timeToMinutes(i.startTime);
    items.push({ key: i.key, title: i.title, date: i.date!, start: s, end: s + (i.task.estimatedMinutes || 30) });
  }
  for (const e of eventsInRange(db, from, to)) {
    if (!e.event.startTime) continue;
    const s = timeToMinutes(e.event.startTime);
    const end = e.event.endTime ? timeToMinutes(e.event.endTime) : s + 60;
    items.push({ key: e.key, title: e.event.title, date: e.date, start: s, end: Math.max(end, s + 1) });
  }
  return items;
}

/** Weekly completion stats used by progress & weekly review. */
export function weekStats(db: DB, weekStartDate: string, today: string) {
  const to = addDays(weekStartDate, 6);
  const list = instancesInRange(db, weekStartDate, to, today);
  const planned = list.length;
  const completed = list.filter((i) => i.status === "completed").length;
  const skipped = list.filter((i) => i.status === "skipped").length;
  const missed = list.filter((i) => isOpen(i.status) && i.date! < today).length;
  return { weekStart: weekStartDate, planned, completed, skipped, missed };
}

export function currentWeekStart(today: string, weekStartsOn = 0) {
  return startOfWeek(today, weekStartsOn);
}
