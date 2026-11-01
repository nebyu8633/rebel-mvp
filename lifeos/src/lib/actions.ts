"use client";
/**
 * Domain operations. Every mutation goes through the store (validated by Zod, persisted
 * via the active repository). Calendar, task list and dashboard all call these same
 * functions on the same records, so a task is never duplicated between views.
 */
import { useStore, SETTINGS_ID } from "./store/store";
import type {
  CollectionName,
  DB,
  FinanceEntry,
  Habit,
  HabitLog,
  Milestone,
  Objective,
  Occurrence,
  Task,
  TaskStatus,
  GroceryItem,
  MealWeek,
  Goal,
} from "./types";
import { occurrenceId, type TaskInstance } from "./tasks";
import { addDays } from "./dates";
import { aggregateIngredients, mergeGroceryList } from "./grocery";
import type { RecoveryAction } from "./recovery";
import type { PlanProposal } from "./planner/schema";
import { schedulePlanTasks } from "./planner/validate";
import { dayLoad } from "./tasks";

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const nowIso = () => new Date().toISOString();

const S = () => useStore.getState();

export function blankTask(partial: Partial<Task> = {}): Task {
  const n = nowIso();
  return {
    id: uid(),
    title: "",
    notes: "",
    goalId: null,
    milestoneId: null,
    objectiveId: null,
    priority: "medium",
    estimatedMinutes: null,
    date: null,
    startTime: null,
    deadline: null,
    status: "planned",
    recurrence: null,
    reminderMinutes: null,
    rationale: "",
    dependsOn: [],
    routine: null,
    source: "user",
    completedAt: null,
    history: [{ at: n, action: "created" }],
    planVersionId: null,
    createdAt: n,
    updatedAt: n,
    ...partial,
  };
}

/** Create or update a task (whole series for recurring tasks). Records reschedules in history. */
export async function saveTask(task: Task): Promise<boolean> {
  const prev = S().db.tasks[task.id];
  const n = nowIso();
  const history = [...(task.history ?? [])];
  if (prev) {
    const prevSlot = `${prev.date ?? ""} ${prev.startTime ?? ""}`.trim() || null;
    const nextSlot = `${task.date ?? ""} ${task.startTime ?? ""}`.trim() || null;
    if (prevSlot !== nextSlot) history.push({ at: n, action: "rescheduled", from: prevSlot, to: nextSlot });
    if (prev.status !== task.status) history.push({ at: n, action: "status", from: prev.status, to: task.status });
  }
  let next: Task = { ...task, history: history.slice(-50), updatedAt: n };
  if (next.status === "completed" && !next.completedAt) next = { ...next, completedAt: n };
  if (next.status !== "completed") next = { ...next, completedAt: null };
  // milestone must belong to the chosen goal
  if (next.milestoneId) {
    const m = S().db.milestones[next.milestoneId];
    if (!m || (next.goalId && m.goalId !== next.goalId)) next = { ...next, milestoneId: null };
    else if (!next.goalId) next = { ...next, goalId: m.goalId };
  }
  return S().put("tasks", next);
}

function upsertOccurrence(inst: TaskInstance, patch: Partial<Occurrence>): Promise<boolean> {
  const n = nowIso();
  const id = occurrenceId(inst.task.id, inst.originalDate!);
  const existing = S().db.occurrences[id];
  const occ: Occurrence = {
    id,
    taskId: inst.task.id,
    originalDate: inst.originalDate!,
    status: existing?.status ?? "planned",
    date: existing?.date ?? null,
    startTime: existing?.startTime ?? null,
    title: existing?.title ?? null,
    notes: existing?.notes ?? null,
    completedAt: existing?.completedAt ?? null,
    createdAt: existing?.createdAt ?? n,
    ...patch,
    updatedAt: n,
  };
  return S().put("occurrences", occ);
}

export async function setInstanceStatus(inst: TaskInstance, status: TaskStatus): Promise<boolean> {
  const n = nowIso();
  if (inst.recurring) {
    const patch: Partial<Occurrence> = { status, completedAt: status === "completed" ? n : null };
    // pin an auto-moved (backup) occurrence to the date it was actually handled
    if (inst.movedToBackup) patch.date = inst.date;
    return upsertOccurrence(inst, patch);
  }
  return saveTask({ ...inst.task, status });
}

export async function toggleComplete(inst: TaskInstance): Promise<void> {
  const done = inst.status === "completed";
  const ok = await setInstanceStatus(inst, done ? "planned" : "completed");
  if (ok && !done)
    S().toast("סומן כהושלם", "success", { label: "ביטול", run: () => void setInstanceStatus({ ...inst, status: "completed" }, "planned") });
}

/** Move one instance. date=null → back to the inbox (status "postponed"). */
export async function rescheduleInstance(inst: TaskInstance, date: string | null, startTime?: string | null): Promise<boolean> {
  if (inst.recurring) {
    if (!date) return false;
    return upsertOccurrence(inst, {
      date: date === inst.originalDate ? null : date,
      startTime: startTime === undefined ? inst.occurrence?.startTime ?? null : startTime,
      status: inst.status === "postponed" ? "planned" : inst.status,
    });
  }
  const t = inst.task;
  return saveTask({
    ...t,
    date,
    startTime: startTime === undefined ? t.startTime : startTime,
    status: date == null ? "postponed" : t.status === "postponed" ? "planned" : t.status,
  });
}

export async function editOccurrence(inst: TaskInstance, patch: { title?: string; notes?: string; date?: string; startTime?: string | null }) {
  return upsertOccurrence(inst, {
    title: patch.title && patch.title !== inst.task.title ? patch.title : null,
    notes: patch.notes !== undefined && patch.notes !== inst.task.notes ? patch.notes : null,
    date: patch.date && patch.date !== inst.originalDate ? patch.date : null,
    startTime: patch.startTime !== undefined && patch.startTime !== inst.task.startTime ? patch.startTime : null,
  });
}

/** Cancel just this occurrence of a series (adds an exception, history of others untouched). */
export async function cancelOccurrence(inst: TaskInstance) {
  const t = inst.task;
  if (!t.recurrence || !inst.originalDate) return false;
  const exceptions = [...new Set([...(t.recurrence.exceptions ?? []), inst.originalDate])];
  const ok = await saveTask({ ...t, recurrence: { ...t.recurrence, exceptions } });
  const occ = S().db.occurrences[occurrenceId(t.id, inst.originalDate)];
  if (ok && occ && occ.status !== "completed") await S().remove("occurrences", occ.id);
  return ok;
}

/** End a series from `fromDate` on, keeping all past history. */
export async function endSeries(task: Task, fromDate: string) {
  if (!task.recurrence) return false;
  const openFuture = Object.values(S().db.occurrences)
    .filter((o) => o.taskId === task.id && o.originalDate >= fromDate && o.status !== "completed")
    .map((o) => ["occurrences", o.id] as [CollectionName, string]);
  const ok = await saveTask({ ...task, recurrence: { ...task.recurrence, endDate: addDays(fromDate, -1) } });
  if (ok && openFuture.length) await S().removeMany(openFuture);
  return ok;
}

export async function deleteTask(taskId: string) {
  const db = S().db;
  const items: Array<[CollectionName, string]> = [["tasks", taskId]];
  for (const o of Object.values(db.occurrences)) if (o.taskId === taskId) items.push(["occurrences", o.id]);
  for (const r of Object.values(db.reminders)) if (r.taskId === taskId) items.push(["reminders", r.id]);
  // remove dangling dependency references
  const dependents = Object.values(db.tasks).filter((t) => t.dependsOn.includes(taskId));
  for (const d of dependents) await saveTask({ ...d, dependsOn: d.dependsOn.filter((x) => x !== taskId) });
  return S().removeMany(items);
}

/** Find a task instance by its key (task id, or `${taskId}:${originalDate}`). */
export function instanceFromKey(db: DB, key: string): TaskInstance | null {
  if (db.tasks[key]) {
    const t = db.tasks[key];
    return { key, task: t, occurrence: null, recurring: false, originalDate: t.date, date: t.date, startTime: t.startTime, title: t.title, notes: t.notes, status: t.status };
  }
  const original = key.slice(-10);
  const taskId = key.slice(0, -11);
  const t = db.tasks[taskId];
  if (!t) return null;
  const occ = db.occurrences[key] ?? null;
  return {
    key,
    task: t,
    occurrence: occ,
    recurring: true,
    originalDate: original,
    date: occ?.date ?? original,
    startTime: occ?.startTime ?? t.startTime,
    title: occ?.title ?? t.title,
    notes: occ?.notes ?? t.notes,
    status: occ?.status ?? "planned",
  };
}

export async function applyRecovery(actions: RecoveryAction[]) {
  const db = S().db;
  let ok = 0;
  for (const a of actions) {
    const inst = instanceFromKey(db, a.key);
    if (!inst) continue;
    let r = false;
    if (a.action === "move" && a.date) r = await rescheduleInstance(inst, a.date);
    else if (a.action === "skip") r = await setInstanceStatus(inst, "skipped");
    else if (a.action === "unschedule") r = await rescheduleInstance(inst, null);
    if (r) ok++;
  }
  S().toast(`תוכנית ההתאוששות הוחלה (${ok} משימות)`, "success");
}

// ───────────── Habits ─────────────

export async function setHabitLog(habit: Habit, date: string, status: HabitLog["status"] | null) {
  const id = `${habit.id}:${date}`;
  if (status == null) return S().remove("habitLogs", id);
  const n = nowIso();
  const prev = S().db.habitLogs[id];
  return S().put("habitLogs", { id, habitId: habit.id, date, status, createdAt: prev?.createdAt ?? n, updatedAt: n });
}

export async function deleteHabit(habitId: string) {
  const items: Array<[CollectionName, string]> = [["habits", habitId]];
  for (const l of Object.values(S().db.habitLogs)) if (l.habitId === habitId) items.push(["habitLogs", l.id]);
  return S().removeMany(items);
}

// ───────────── Meals & groceries ─────────────

export async function setWeekApproved(weekStart: string, approved: boolean) {
  const n = nowIso();
  const prev = S().db.mealWeeks[weekStart];
  const w: MealWeek = { id: weekStart, weekStart, approved, approvedAt: approved ? n : null, createdAt: prev?.createdAt ?? n, updatedAt: n };
  return S().put("mealWeeks", w);
}

export async function generateGroceryList(weekStart: string) {
  const db = S().db;
  const weekEnd = addDays(weekStart, 6);
  const entries = Object.values(db.mealPlan).filter((e) => e.date >= weekStart && e.date <= weekEnd);
  const agg = aggregateIngredients(entries, db.meals, Object.values(db.pantry));
  const existing = Object.values(db.groceries).filter((g) => g.weekStart === weekStart);
  const { upserts, removeIds } = mergeGroceryList(existing, agg, weekStart, nowIso(), uid);
  if (upserts.length) await S().putMany(upserts.map((u) => ["groceries", u] as [CollectionName, GroceryItem]));
  if (removeIds.length) await S().removeMany(removeIds.map((id) => ["groceries", id] as [CollectionName, string]));
  return { count: upserts.length, removed: removeIds.length, mealsCount: entries.length };
}

export async function deleteMeal(mealId: string) {
  const items: Array<[CollectionName, string]> = [];
  for (const e of Object.values(S().db.mealPlan)) if (e.mealId === mealId) items.push(["mealPlan", e.id]);
  items.push(["meals", mealId]);
  return S().removeMany(items.reverse());
}

// ───────────── Goals ─────────────

/** Delete a goal with its milestones/objectives. Tasks are kept and unlinked — never silently deleted. */
export async function deleteGoal(goalId: string) {
  const db = S().db;
  for (const t of Object.values(db.tasks))
    if (t.goalId === goalId) await saveTask({ ...t, goalId: null, milestoneId: null, objectiveId: null });
  for (const h of Object.values(db.habits)) if (h.goalId === goalId) await S().put("habits", { ...h, goalId: null, updatedAt: nowIso() });
  const items: Array<[CollectionName, string]> = [["goals", goalId]];
  for (const m of Object.values(db.milestones)) if (m.goalId === goalId) items.push(["milestones", m.id]);
  for (const o of Object.values(db.objectives)) if (o.goalId === goalId) items.push(["objectives", o.id]);
  for (const a of Object.values(db.financeAccounts))
    if (a.goalId === goalId) await S().put("financeAccounts", { ...a, goalId: null, updatedAt: nowIso() });
  return S().removeMany(items);
}

export async function deleteMilestone(milestoneId: string) {
  const db = S().db;
  for (const t of Object.values(db.tasks)) if (t.milestoneId === milestoneId) await saveTask({ ...t, milestoneId: null, objectiveId: null });
  const items: Array<[CollectionName, string]> = [["milestones", milestoneId]];
  for (const o of Object.values(db.objectives)) if (o.milestoneId === milestoneId) items.push(["objectives", o.id]);
  return S().removeMany(items);
}

export interface PlanApproval {
  goal: Goal;
  plan: PlanProposal;
  /** Milestone keys the user approved. */
  milestoneKeys: string[];
  /** Task keys the user rejected inside approved milestones. */
  rejectedTaskKeys: string[];
  /** Suggested habits to create (by index). */
  habitIndexes: number[];
  today: string;
}

/**
 * Persist an approved plan: milestones → objectives → tasks (scheduled within availability)
 * → habits. Returns scheduling warnings so the UI can show them.
 */
export async function approvePlan(a: PlanApproval): Promise<{ ok: boolean; warnings: string[]; created: number }> {
  const db = S().db;
  const settings = db.settings[SETTINGS_ID];
  const n = nowIso();
  const approved = a.plan.milestones.filter((m) => a.milestoneKeys.includes(m.key));
  const keyToId = new Map<string, string>();
  const tasksToSchedule = approved.flatMap((m) => m.tasks.filter((t) => !a.rejectedTaskKeys.includes(t.key)));
  for (const t of tasksToSchedule) keyToId.set(t.key, uid());

  const { scheduled, warnings } = schedulePlanTasks(tasksToSchedule, {
    today: a.today,
    availability: settings?.availability ?? [null, null, null, null, null, null, null],
    existingMinutes: (d) => dayLoad(db, d).plannedMinutes,
  });
  const dateOf = new Map(scheduled.map((s) => [s.task.key, s.date]));

  const existingCount = Object.values(db.milestones).filter((m) => m.goalId === a.goal.id).length;
  const items: Array<[CollectionName, unknown]> = [];
  approved.forEach((m, idx) => {
    const milestoneId = uid();
    const ms: Milestone = {
      id: milestoneId,
      goalId: a.goal.id,
      title: m.title,
      description: m.description,
      targetDate: m.targetDate,
      status: idx === 0 && existingCount === 0 ? "active" : "pending",
      order: existingCount + idx,
      planVersionId: null,
      createdAt: n,
      updatedAt: n,
    };
    items.push(["milestones", ms]);
    for (const o of m.monthlyObjectives) {
      const obj: Objective = { id: uid(), goalId: a.goal.id, milestoneId, level: "month", periodStart: o.month, title: o.title, status: "pending", createdAt: n, updatedAt: n };
      items.push(["objectives", obj]);
    }
    for (const o of m.weeklyObjectives) {
      const obj: Objective = { id: uid(), goalId: a.goal.id, milestoneId, level: "week", periodStart: o.weekStart, title: o.title, status: "pending", createdAt: n, updatedAt: n };
      items.push(["objectives", obj]);
    }
    for (const t of m.tasks) {
      if (a.rejectedTaskKeys.includes(t.key)) continue;
      items.push([
        "tasks",
        blankTask({
          id: keyToId.get(t.key)!,
          title: t.title,
          goalId: a.goal.id,
          milestoneId,
          priority: t.priority,
          estimatedMinutes: t.durationMinutes,
          date: dateOf.get(t.key) ?? null,
          deadline: t.deadline,
          rationale: t.rationale,
          dependsOn: t.dependsOn.map((k) => keyToId.get(k)).filter((x): x is string => !!x),
          source: "planner",
        }),
      ]);
    }
  });
  a.habitIndexes.forEach((i, j) => {
    const h = a.plan.habits[i];
    if (!h) return;
    const habit: Habit = {
      id: uid(),
      title: h.title,
      goalId: a.goal.id,
      frequency: h.timesPerWeek >= 7 ? { type: "daily" } : { type: "times_per_week", count: h.timesPerWeek },
      startDate: a.today,
      paused: false,
      reminderTime: null,
      order: Object.keys(db.habits).length + j,
      createdAt: n,
      updatedAt: n,
    };
    items.push(["habits", habit]);
  });
  if (a.goal.status === "planning") items.unshift(["goals", { ...a.goal, status: "active", updatedAt: n }]);
  const ok = await S().putMany(items);
  return { ok, warnings, created: tasksToSchedule.length };
}

// ───────────── Finance & weight ─────────────

export async function addFinanceEntry(e: Omit<FinanceEntry, "id" | "createdAt" | "updatedAt">) {
  const n = nowIso();
  return S().put("financeEntries", { ...e, id: uid(), createdAt: n, updatedAt: n });
}

export async function addWeight(date: string, kg: number, note = "") {
  const n = nowIso();
  return S().put("weightLogs", { id: uid(), date, kg, note, createdAt: n, updatedAt: n });
}

export async function updateSettings(patch: Partial<import("./types").Settings>) {
  const s = S().db.settings[SETTINGS_ID];
  if (!s) return false;
  return S().put("settings", { ...s, ...patch, updatedAt: nowIso() });
}
