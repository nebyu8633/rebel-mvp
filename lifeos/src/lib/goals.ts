import type { DB, Goal, MotorcycleInfo, WeightLog } from "./types";
import { summarizeAccount, motorcycleCost } from "./finance";
import { diffDays } from "./dates";

export interface GoalProgress {
  /** 0..1, or null when it cannot be computed honestly (missing data). */
  fraction: number | null;
  current: number | null;
  target: number | null;
  start: number | null;
  unit: string;
  label: string;
  missing: string[];
  /** Share of the time window already elapsed (0..1). */
  timeElapsed: number;
}

export function latestWeight(logs: WeightLog[]): WeightLog | null {
  return logs.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;
}

export function timeElapsed(goal: Goal, today: string): number {
  const total = diffDays(goal.startDate, goal.targetDate);
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, diffDays(goal.startDate, today) / total));
}

export function goalProgress(db: DB, goal: Goal, today: string): GoalProgress {
  const te = timeElapsed(goal, today);
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  switch (goal.kind) {
    case "weight": {
      const last = latestWeight(Object.values(db.weightLogs));
      const start = goal.startValue;
      const target = goal.targetValue;
      const missing: string[] = [];
      if (start == null) missing.push("משקל התחלתי");
      if (!last) missing.push("שקילה ראשונה");
      if (start == null || target == null || !last)
        return { fraction: null, current: last?.kg ?? null, target, start, unit: "ק״ג", label: "משקל", missing, timeElapsed: te };
      const total = target - start;
      return {
        fraction: total === 0 ? 1 : clamp((last.kg - start) / total),
        current: last.kg,
        target,
        start,
        unit: "ק״ג",
        label: `${(last.kg - start >= 0 ? "+" : "") + (Math.round((last.kg - start) * 10) / 10)} ק״ג מתוך ${Math.round(total * 10) / 10}`,
        missing,
        timeElapsed: te,
      };
    }
    case "portfolio":
    case "purchase":
    case "motorcycle": {
      const acc = goal.financeAccountId ? db.financeAccounts[goal.financeAccountId] : null;
      const entries = acc ? Object.values(db.financeEntries).filter((e) => e.accountId === acc.id) : [];
      const summary = summarizeAccount(entries);
      let target = goal.targetValue;
      const missing: string[] = [];
      if (goal.kind === "purchase") {
        if (target == null) missing.push("מחיר יעד");
      }
      if (goal.kind === "motorcycle") {
        const cost = motorcycleCost((goal.info ?? {}) as Partial<MotorcycleInfo>);
        target = cost.complete || cost.upfront > 0 ? cost.upfront : null;
        missing.push(...cost.missing);
      }
      if (!entries.length) missing.push(goal.kind === "portfolio" ? "שווי תיק נוכחי" : "יתרת חיסכון נוכחית");
      if (target == null || target <= 0 || !entries.length)
        return { fraction: null, current: entries.length ? summary.currentValue : null, target, start: null, unit: "₪", label: "", missing, timeElapsed: te };
      return {
        fraction: clamp(summary.currentValue / target),
        current: summary.currentValue,
        target,
        start: summary.startingValue,
        unit: "₪",
        label: "",
        missing,
        timeElapsed: te,
      };
    }
    default: {
      // measurable outcome: latest manual progress record (or the legacy manual value)
      const rec = Object.values(db.progressRecords ?? {})
        .filter((r) => r.goalId === goal.id && r.metricKey === "main")
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1))[0];
      const c = rec?.value ?? goal.manualValue;
      const { startValue: s, targetValue: t } = goal;
      if (s == null || t == null || c == null || t === s) {
        // No measurable data → no percentage. Milestone/task completion is shown separately, never as goal achievement.
        const missing = t == null ? ["מדד יעד מספרי"] : c == null ? ["עדכון ערך נוכחי"] : ["ערך התחלתי"];
        return { fraction: null, current: c ?? null, target: t, start: s, unit: goal.unit, label: "", missing, timeElapsed: te };
      }
      return { fraction: clamp((c - s) / (t - s)), current: c, target: t, start: s, unit: goal.unit, label: "", missing: [], timeElapsed: te };
    }
  }
}

export function goalTasks(db: DB, goalId: string) {
  return Object.values(db.tasks).filter((t) => t.goalId === goalId);
}

export function milestoneTasks(db: DB, milestoneId: string) {
  return Object.values(db.tasks).filter((t) => t.milestoneId === milestoneId);
}

/** A milestone is done when it has tasks and all non-recurring ones are completed/skipped. */
export function milestoneCompletion(db: DB, milestoneId: string): { total: number; done: number } {
  const ts = milestoneTasks(db, milestoneId).filter((t) => !t.recurrence);
  return { total: ts.length, done: ts.filter((t) => t.status === "completed" || t.status === "skipped").length };
}

/** Data integrity check: tasks must point at existing goals/milestones, and milestone→goal must match. */
export function relationshipProblems(db: DB): string[] {
  const out: string[] = [];
  for (const t of Object.values(db.tasks)) {
    if (t.goalId && !db.goals[t.goalId]) out.push(`task ${t.id}: missing goal`);
    if (t.milestoneId) {
      const m = db.milestones[t.milestoneId];
      if (!m) out.push(`task ${t.id}: missing milestone`);
      else if (t.goalId && m.goalId !== t.goalId) out.push(`task ${t.id}: milestone belongs to another goal`);
    }
    for (const d of t.dependsOn) if (!db.tasks[d]) out.push(`task ${t.id}: missing dependency ${d}`);
  }
  for (const m of Object.values(db.milestones)) if (!db.goals[m.goalId]) out.push(`milestone ${m.id}: missing goal`);
  return out;
}

export const GOAL_COLORS: Record<string, { border: string; bar: string; soft: string; text: string; dot: string }> = {
  teal: { border: "border-s-teal-600", bar: "bg-teal-600", soft: "bg-teal-50 dark:bg-teal-950/40", text: "text-teal-700 dark:text-teal-300", dot: "bg-teal-500" },
  amber: { border: "border-s-amber-500", bar: "bg-amber-500", soft: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  indigo: { border: "border-s-indigo-600", bar: "bg-indigo-600", soft: "bg-indigo-50 dark:bg-indigo-950/40", text: "text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500" },
  rose: { border: "border-s-rose-500", bar: "bg-rose-500", soft: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  slate: { border: "border-s-slate-600", bar: "bg-slate-600", soft: "bg-slate-100 dark:bg-slate-800/60", text: "text-slate-700 dark:text-slate-300", dot: "bg-slate-500" },
};
export const goalColor = (c: string) => GOAL_COLORS[c] ?? GOAL_COLORS.slate;

export const GOAL_STATUS: Record<Goal["status"], { label: string; tone: "amber" | "accent" | "stone" | "indigo" }> = {
  planning: { label: "דורש תכנון", tone: "amber" },
  active: { label: "פעילה", tone: "accent" },
  paused: { label: "מושהית", tone: "stone" },
  done: { label: "הושגה", tone: "indigo" },
};

