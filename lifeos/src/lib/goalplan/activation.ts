/**
 * Turns an approved plan version into real app records (milestones, objectives, tasks,
 * recurring tasks, reminders) as ONE atomic batch. Pure: it only computes operations.
 *
 * Idempotent: record ids are derived from (goal, plan key), so re-running activation —
 * e.g. after a failed attempt — updates the same records instead of duplicating them.
 * Revisions preserve history: completed/skipped tasks are never modified or removed, and
 * recurring series keep their completed occurrences.
 */
import type { BatchOp } from "../store/repo";
import type { DB, Goal, Milestone, Objective, PlanVersion, Reminder, Task, RecurrenceRule, FinanceEntry, WeightLog, FinanceAccount } from "../types";
import type { GoalPlan, GPRoutine, GPTask } from "./schema";
import type { Facts } from "./interview";
import { addDays } from "../dates";
import { isOpen } from "../tasks";

export const ids = {
  milestone: (g: string, k: string) => `ms:${g}:${k}`,
  objective: (g: string, k: string) => `ob:${g}:${k}`,
  task: (g: string, k: string) => `pt:${g}:${k}`,
  routine: (g: string, k: string) => `rt:${g}:${k}`,
  review: (g: string) => `rv:${g}`,
  reminder: (taskId: string) => `rm:${taskId}`,
  account: (g: string) => `acct:${g}`,
};

const isGoalRecord = (g: string, id: string) => id.startsWith(`pt:${g}:`) || id.startsWith(`rt:${g}:`) || id === ids.review(g);

export interface ActivationSummary {
  created: string[];
  updated: Array<{ title: string; changes: string[] }>;
  keptCompleted: string[];
  removed: string[];
  endedSeries: string[];
}

export interface ActivationResult {
  ops: BatchOp[];
  summary: ActivationSummary;
}

function baseTask(id: string, now: string): Task {
  return {
    id, title: "", notes: "", goalId: null, milestoneId: null, objectiveId: null, priority: "medium", estimatedMinutes: null,
    date: null, startTime: null, deadline: null, status: "planned", recurrence: null, reminderMinutes: null, rationale: "",
    dependsOn: [], routine: null, source: "planner", completedAt: null, history: [{ at: now, action: "created" }],
    planVersionId: null, createdAt: now, updatedAt: now,
  };
}

function changesOf(prev: Task, next: Task): string[] {
  const c: string[] = [];
  if (prev.title !== next.title) c.push("כותרת");
  if (prev.date !== next.date || prev.startTime !== next.startTime) c.push("מועד");
  if (prev.deadline !== next.deadline) c.push("דדליין");
  if (prev.estimatedMinutes !== next.estimatedMinutes) c.push("משך");
  if (prev.priority !== next.priority) c.push("עדיפות");
  if (JSON.stringify(prev.recurrence?.byWeekday) !== JSON.stringify(next.recurrence?.byWeekday) || prev.recurrence?.freq !== next.recurrence?.freq) c.push("ימי חזרה");
  if (prev.milestoneId !== next.milestoneId) c.push("אבן דרך");
  return c;
}

function routineRule(r: GPRoutine, prev: RecurrenceRule | null): RecurrenceRule {
  return {
    freq: r.freq,
    interval: r.interval,
    byWeekday: r.freq === "weekly" ? r.byWeekday : undefined,
    byMonthDay: r.freq === "monthly" ? r.byMonthDay ?? undefined : undefined,
    startDate: prev && prev.startDate < r.startDate ? prev.startDate : r.startDate, // keep the series' history window
    endDate: r.endDate,
    count: null,
    paused: prev?.paused ?? false,
    exceptions: prev?.exceptions ?? [],
    // alternatives, not duplicates: a backup day moves a missed session; otherwise skip to the next one
    missedPolicy: r.backupWeekday != null ? "backup" : "skip",
    backupWeekday: r.backupWeekday,
  };
}

export function buildActivation(args: {
  db: DB;
  goal: Goal;
  version: PlanVersion;
  facts: Facts;
  today: string;
  now: string;
}): ActivationResult {
  const { db, goal, version, facts, today, now } = args;
  const plan: GoalPlan = version.plan;
  const g = goal.id;
  const ops: BatchOp[] = [];
  const summary: ActivationSummary = { created: [], updated: [], keptCompleted: [], removed: [], endedSeries: [] };
  const put = <E extends { id: string }>(collection: Parameters<typeof makePut>[0], entity: E) => ops.push(makePut(collection, entity));

  // goal
  const outcome = plan.metrics.find((m) => m.type === "outcome");
  const goalNext: Goal = {
    ...goal,
    status: goal.status === "planning" || goal.status === "paused" ? "active" : goal.status,
    targetDate: plan.targetDate,
    startConfirmed: true,
    unit: goal.unit || outcome?.unit || "",
    startValue: goal.kind === "weight" || goal.kind === "custom" || goal.kind === "income" || goal.kind === "learning" ? outcome?.baseline ?? goal.startValue : goal.startValue,
    targetValue: outcome?.target ?? goal.targetValue,
    updatedAt: now,
  };
  if (goal.kind === "weight" && typeof facts.targetChange?.value === "number") goalNext.info = { ...goal.info, targetGain: facts.targetChange.value };
  // purchase goals track savings in their own account (separate from investments)
  if ((goal.kind === "purchase" || goal.kind === "motorcycle") && !goal.financeAccountId) {
    const acc: FinanceAccount = { id: ids.account(g), name: `חיסכון: ${goal.title}`, kind: "savings", goalId: g, target: outcome?.target ?? null, createdAt: now, updatedAt: now };
    if (!db.financeAccounts[acc.id]) put("financeAccounts", acc);
    goalNext.financeAccountId = acc.id;
  }
  put("goals", goalNext);

  // confirmed baselines flow into the trackers — only if the tracker has no data yet (never overwrite history)
  const confirmedNum = (k: string) => (facts[k]?.kind === "confirmed" && typeof facts[k].value === "number" ? (facts[k].value as number) : null);
  const accId = goalNext.financeAccountId;
  const accHasData = accId ? Object.values(db.financeEntries).some((e) => e.accountId === accId) : true;
  const baselineAmount = goal.kind === "portfolio" ? confirmedNum("currentValue") : confirmedNum("savedSoFar");
  if (accId && !accHasData && baselineAmount != null) {
    const e: FinanceEntry = { id: `fe:${g}:baseline`, accountId: accId, date: today, kind: "valuation", amount: baselineAmount, note: "ערך התחלתי מתוך שיחת התכנון", createdAt: now, updatedAt: now };
    put("financeEntries", e);
  }
  if (goal.kind === "weight" && confirmedNum("currentWeight") != null && Object.keys(db.weightLogs).length === 0) {
    const w: WeightLog = { id: `wl:${g}:baseline`, date: today, kg: confirmedNum("currentWeight")!, note: "משקל התחלתי מתוך שיחת התכנון", createdAt: now, updatedAt: now };
    put("weightLogs", w);
  }

  // plan versions: this one becomes the immutable approved snapshot; the previous approved one is superseded
  for (const v of Object.values(db.planVersions))
    if (v.goalId === g && v.status === "approved" && v.id !== version.id) put("planVersions", { ...v, status: "superseded", updatedAt: now });
  put("planVersions", { ...version, status: "approved", approvedAt: now, updatedAt: now });

  // milestones
  const includedMs = plan.milestones.filter((m) => !m.excluded);
  const msIds = new Set<string>();
  includedMs.forEach((m, i) => {
    const id = ids.milestone(g, m.key);
    msIds.add(id);
    const prev = db.milestones[id];
    const next: Milestone = {
      id, goalId: g, title: m.title, description: m.description, targetDate: m.targetDate,
      status: prev?.status ?? (i === 0 ? "active" : "pending"), order: i, planVersionId: version.id,
      createdAt: prev?.createdAt ?? now, updatedAt: now,
    };
    put("milestones", next);
    for (const o of m.monthlyObjectives) {
      const oid = ids.objective(g, o.key);
      const obj: Objective = { id: oid, goalId: g, milestoneId: id, level: "month", periodStart: o.month, title: o.title, status: db.objectives[oid]?.status ?? "pending", createdAt: db.objectives[oid]?.createdAt ?? now, updatedAt: now };
      put("objectives", obj);
    }
    for (const o of m.weeklyObjectives) {
      const oid = ids.objective(g, o.key);
      const obj: Objective = { id: oid, goalId: g, milestoneId: id, level: "week", periodStart: o.weekStart, title: o.title, status: db.objectives[oid]?.status ?? "pending", createdAt: db.objectives[oid]?.createdAt ?? now, updatedAt: now };
      put("objectives", obj);
    }
  });
  const excludedMs = new Set(plan.milestones.filter((m) => m.excluded).map((m) => m.key));
  const keepObjectives = new Set(includedMs.flatMap((m) => [...m.monthlyObjectives, ...m.weeklyObjectives].map((o) => ids.objective(g, o.key))));

  // tasks
  const activeTasks = plan.tasks.filter((t) => !t.excluded && !(t.milestoneKey && excludedMs.has(t.milestoneKey)));
  const taskIdByKey = new Map(activeTasks.map((t) => [t.key, ids.task(g, t.key)]));
  const wanted = new Set<string>();
  const reminderFor = (taskId: string, minutes: number | null, hasTime: boolean) => {
    const rid = ids.reminder(taskId);
    if (minutes != null && hasTime) {
      const r: Reminder = { id: rid, taskId, kind: "before_start", minutes, date: null, time: null, enabled: db.reminders[rid]?.enabled ?? true, createdAt: db.reminders[rid]?.createdAt ?? now, updatedAt: now };
      put("reminders", r);
    } else if (db.reminders[rid]) ops.push({ op: "remove", collection: "reminders", id: rid });
  };

  for (const t of activeTasks) {
    const id = taskIdByKey.get(t.key)!;
    wanted.add(id);
    const prev = db.tasks[id];
    if (prev && !isOpen(prev.status)) {
      summary.keptCompleted.push(prev.title);
      continue;
    }
    const next = taskFromPlan(prev ?? baseTask(id, now), t, { g, version, now, milestoneId: t.milestoneKey && !excludedMs.has(t.milestoneKey) ? ids.milestone(g, t.milestoneKey) : null, depIds: t.dependsOn.map((k) => taskIdByKey.get(k)).filter((x): x is string => !!x) });
    if (prev) {
      const ch = changesOf(prev, next);
      if (ch.length) summary.updated.push({ title: next.title, changes: ch });
    } else summary.created.push(next.title);
    put("tasks", next);
    reminderFor(id, t.reminderMinutes, !!next.startTime);
  }

  // routines → recurring tasks
  const routines: Array<{ id: string; r: GPRoutine; review?: boolean }> = plan.routines.filter((r) => !r.excluded).map((r) => ({ id: ids.routine(g, r.key), r }));
  routines.push({
    id: ids.review(g),
    review: true,
    r: {
      key: "review", milestoneKey: null, title: `בדיקת התקדמות: ${goal.title}`, rationale: "רגע קצר לעדכן מדדים, לראות מה נתקע ולתקן כיוון",
      freq: plan.review.freq === "monthly" ? "monthly" : "weekly", interval: 1, byWeekday: [plan.review.weekday], backupWeekday: null, byMonthDay: plan.review.freq === "monthly" ? 1 : null,
      startDate: addDays(today, (plan.review.weekday - new Date(today + "T00:00:00Z").getUTCDay() + 7) % 7), endDate: plan.targetDate,
      durationMinutes: 15, startTime: plan.review.startTime, reminderMinutes: plan.review.startTime ? 15 : null, excluded: false, userEdited: false,
    },
  });
  for (const { id, r } of routines) {
    wanted.add(id);
    const prev = db.tasks[id];
    const base = prev ?? baseTask(id, now);
    const next: Task = {
      ...base,
      title: r.title,
      goalId: g,
      milestoneId: r.milestoneKey && !excludedMs.has(r.milestoneKey) ? ids.milestone(g, r.milestoneKey) : null,
      estimatedMinutes: r.durationMinutes,
      startTime: r.startTime,
      date: null,
      rationale: r.rationale,
      recurrence: routineRule(r, prev?.recurrence ?? null),
      source: "planner",
      planVersionId: version.id,
      status: "planned",
      history: prev ? [...prev.history, { at: now, action: "edited" as const }].slice(-50) : base.history,
      updatedAt: now,
    };
    if (prev) {
      const ch = changesOf(prev, next);
      if (ch.length) summary.updated.push({ title: next.title, changes: ch });
    } else summary.created.push(`↻ ${next.title}`);
    put("tasks", next);
    reminderFor(id, r.reminderMinutes, !!r.startTime);
  }

  // records from a previous version that are no longer in the plan
  for (const t of Object.values(db.tasks)) {
    if (t.goalId !== g || !isGoalRecord(g, t.id) || wanted.has(t.id)) continue;
    if (t.recurrence) {
      const hasHistory = Object.values(db.occurrences).some((o) => o.taskId === t.id && !isOpen(o.status));
      if (hasHistory) {
        // end the series but keep completed occurrences
        if (!t.recurrence.endDate || t.recurrence.endDate >= today) {
          put("tasks", { ...t, recurrence: { ...t.recurrence, endDate: addDays(today, -1) }, updatedAt: now });
          summary.endedSeries.push(t.title);
        }
        continue;
      }
    } else if (!isOpen(t.status)) {
      summary.keptCompleted.push(t.title);
      continue;
    }
    summary.removed.push(t.title);
    for (const o of Object.values(db.occurrences)) if (o.taskId === t.id) ops.push({ op: "remove", collection: "occurrences", id: o.id });
    if (db.reminders[ids.reminder(t.id)]) ops.push({ op: "remove", collection: "reminders", id: ids.reminder(t.id) });
    ops.push({ op: "remove", collection: "tasks", id: t.id });
  }
  for (const o of Object.values(db.objectives))
    if (o.goalId === g && o.id.startsWith(`ob:${g}:`) && !keepObjectives.has(o.id)) ops.push({ op: "remove", collection: "objectives", id: o.id });
  for (const m of Object.values(db.milestones)) {
    if (m.goalId !== g || !m.id.startsWith(`ms:${g}:`) || msIds.has(m.id)) continue;
    const referenced = Object.values(db.tasks).some((t) => t.milestoneId === m.id && !isOpen(t.status));
    if (!referenced) ops.push({ op: "remove", collection: "milestones", id: m.id });
  }

  // conversation → active
  const conv = db.conversations[g];
  if (conv) put("conversations", { ...conv, phase: "active", stage: 8, pending: null, updatedAt: now });

  // children must be deleted before parents; puts are already parent-first
  const removes = ops.filter((o) => o.op === "remove");
  const puts = ops.filter((o) => o.op === "put");
  const order = ["reminders", "occurrences", "tasks", "objectives", "milestones"];
  removes.sort((a, b) => order.indexOf(a.collection) - order.indexOf(b.collection));
  return { ops: [...puts, ...removes], summary };
}

function makePut(collection: "goals" | "milestones" | "objectives" | "tasks" | "reminders" | "planVersions" | "conversations" | "financeAccounts" | "financeEntries" | "weightLogs", entity: { id: string }): BatchOp {
  return { op: "put", collection, entity: entity as { id: string } & Record<string, unknown> };
}

function taskFromPlan(base: Task, t: GPTask, x: { g: string; version: PlanVersion; now: string; milestoneId: string | null; depIds: string[] }): Task {
  const moved = base.date !== t.date || base.startTime !== t.startTime;
  return {
    ...base,
    title: t.title,
    notes: t.notes || base.notes,
    goalId: x.g,
    milestoneId: x.milestoneId,
    priority: t.priority,
    estimatedMinutes: t.durationMinutes,
    date: t.date,
    startTime: t.startTime,
    deadline: t.deadline,
    rationale: t.rationale,
    dependsOn: x.depIds,
    reminderMinutes: null, // reminders live in the reminders collection
    status: base.status === "postponed" && t.date ? "planned" : base.status,
    planVersionId: x.version.id,
    history:
      base.createdAt === x.now
        ? base.history
        : [...base.history, { at: x.now, action: moved ? ("rescheduled" as const) : ("edited" as const), from: moved ? base.date : undefined, to: moved ? t.date : undefined }].slice(-50),
    updatedAt: x.now,
  };
}
