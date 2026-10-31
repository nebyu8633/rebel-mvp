import { PlanProposal, type PlanTask } from "./schema";
import { addDays, weekday, parseDate } from "../dates";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (d: string) => DATE_RE.test(d) && !Number.isNaN(parseDate(d).getTime()) && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d);

export const MAX_PLAN_TASKS = 80;

export interface ValidationResult {
  ok: boolean;
  /** Fatal problems — the plan must not be saved. */
  errors: string[];
  /** Automatic corrections applied (shown to the user). */
  fixes: string[];
  plan: PlanProposal | null;
}

/**
 * Validate a proposal (from AI or fallback) against the application's rules and
 * repair what can be safely repaired. Anything unrepairable is reported as an error.
 */
export function validatePlan(raw: unknown, window: { today: string; targetDate: string }): ValidationResult {
  const parsed = PlanProposal.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: ["מבנה התוכנית אינו תקין"], fixes: [], plan: null };
  const plan = structuredClone(parsed.data);
  const errors: string[] = [];
  const fixes: string[] = [];
  const { today, targetDate } = window;

  if (!plan.milestones.length) errors.push("התוכנית אינה כוללת אבני דרך");

  const allKeys = new Set<string>();
  let taskCount = 0;
  for (const m of plan.milestones) {
    if (!m.title.trim()) errors.push("אבן דרך ללא כותרת");
    if (!validDate(m.targetDate)) {
      errors.push(`תאריך לא תקין באבן הדרך "${m.title}"`);
      continue;
    }
    if (m.targetDate > targetDate) {
      fixes.push(`תאריך היעד של "${m.title}" הוזז ליעד המטרה`);
      m.targetDate = targetDate;
    }
    m.monthlyObjectives = m.monthlyObjectives.filter((o) => validDate(o.month) && o.title.trim());
    m.weeklyObjectives = m.weeklyObjectives.filter((o) => validDate(o.weekStart) && o.title.trim());
    for (const t of m.tasks) {
      taskCount++;
      if (!t.title.trim()) errors.push("משימה ללא כותרת");
      if (allKeys.has(t.key)) {
        const nk = `${t.key}_${taskCount}`;
        fixes.push(`מפתח כפול "${t.key}" שונה`);
        t.key = nk;
      }
      allKeys.add(t.key);
      if (!Number.isFinite(t.durationMinutes) || t.durationMinutes < 5) {
        t.durationMinutes = 15;
        fixes.push(`משך המשימה "${t.title}" תוקן ל-15 דקות`);
      } else if (t.durationMinutes > 480) {
        t.durationMinutes = 480;
        fixes.push(`משך המשימה "${t.title}" הוגבל ל-8 שעות — מומלץ לפצל`);
      }
      t.durationMinutes = Math.round(t.durationMinutes);
      if (!validDate(t.deadline)) {
        t.deadline = m.targetDate;
        fixes.push(`למשימה "${t.title}" חסר דדליין תקין — נקבע לפי אבן הדרך`);
      }
      if (t.deadline < today) {
        t.deadline = today;
        fixes.push(`דדליין בעבר של "${t.title}" הועבר להיום`);
      }
      if (t.deadline > targetDate) {
        t.deadline = targetDate;
        fixes.push(`דדליין של "${t.title}" הוגבל לתאריך היעד`);
      }
    }
  }
  if (taskCount > MAX_PLAN_TASKS) errors.push(`התוכנית כוללת ${taskCount} משימות — יותר מהמקסימום (${MAX_PLAN_TASKS}).`);

  // Dependencies: drop unknown references, then reject cycles.
  const tasks = plan.milestones.flatMap((m) => m.tasks);
  for (const t of tasks) {
    const before = t.dependsOn.length;
    t.dependsOn = [...new Set(t.dependsOn.filter((d) => allKeys.has(d) && d !== t.key))];
    if (t.dependsOn.length !== before) fixes.push(`הוסרו תלויות לא קיימות במשימה "${t.title}"`);
  }
  const cycle = findCycle(tasks);
  if (cycle) errors.push(`תלות מעגלית בין משימות: ${cycle.join(" → ")}`);

  for (const h of plan.habits) h.timesPerWeek = Math.min(7, Math.max(1, Math.round(h.timesPerWeek || 1)));

  return { ok: errors.length === 0, errors, fixes, plan };
}

export function findCycle(tasks: PlanTask[]): string[] | null {
  const byKey = new Map(tasks.map((t) => [t.key, t]));
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const visit = (k: string): string[] | null => {
    const s = state.get(k) ?? 0;
    if (s === 2) return null;
    if (s === 1) return [...stack.slice(stack.indexOf(k)), k];
    state.set(k, 1);
    stack.push(k);
    for (const d of byKey.get(k)?.dependsOn ?? []) {
      const c = visit(d);
      if (c) return c;
    }
    stack.pop();
    state.set(k, 2);
    return null;
  };
  for (const t of tasks) {
    const c = visit(t.key);
    if (c) return c.map((k) => byKey.get(k)?.title ?? k);
  }
  return null;
}

/** Topological order (dependencies first), stable by deadline. */
export function topoSort(tasks: PlanTask[]): PlanTask[] {
  const byKey = new Map(tasks.map((t) => [t.key, t]));
  const out: PlanTask[] = [];
  const done = new Set<string>();
  const visit = (t: PlanTask, depth = 0) => {
    if (done.has(t.key) || depth > tasks.length) return;
    for (const d of t.dependsOn) {
      const dt = byKey.get(d);
      if (dt) visit(dt, depth + 1);
    }
    done.add(t.key);
    out.push(t);
  };
  tasks
    .slice()
    .sort((a, b) => (a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0))
    .forEach((t) => visit(t));
  return out;
}

export interface ScheduledPlanTask {
  task: PlanTask;
  date: string;
  overloaded: boolean;
}

/**
 * Assign a day to each approved task: on/after today and after its dependencies,
 * not later than its deadline, within remaining daily capacity.
 * If nothing fits, the task goes on its deadline and is flagged `overloaded` (with a warning) —
 * the user is never silently over-scheduled.
 */
export function schedulePlanTasks(
  tasks: PlanTask[],
  opts: {
    today: string;
    availability: Array<number | null>;
    existingMinutes: (date: string) => number;
    maxPerDayWhenUnknown?: number;
    /** Schedule no earlier than this many days before the deadline (default 10). */
    leadDays?: number;
  },
): { scheduled: ScheduledPlanTask[]; warnings: string[] } {
  const warnings: string[] = [];
  const used = new Map<string, number>();
  const count = new Map<string, number>();
  const dateOf = new Map<string, string>();
  const unknownAvailability = opts.availability.every((a) => a == null);
  if (unknownAvailability)
    warnings.push("לא הוגדרה זמינות יומית בהגדרות, ולכן המשימות פוזרו עד 2 ביום ללא בדיקת עומס בדקות.");
  const scheduled: ScheduledPlanTask[] = [];
  for (const t of topoSort(tasks)) {
    let earliest = opts.today;
    for (const d of t.dependsOn) {
      const dd = dateOf.get(d);
      if (dd && dd >= earliest) earliest = addDays(dd, 1);
    }
    const last = t.deadline < earliest ? earliest : t.deadline;
    // Don't front-load far-future work: look for a slot in the lead window before the deadline.
    const windowStart = addDays(t.deadline, -(opts.leadDays ?? 10));
    const from = windowStart > earliest ? windowStart : earliest;
    let chosen: string | null = null;
    for (let d = from; d <= last; d = addDays(d, 1)) {
      if (unknownAvailability) {
        if ((count.get(d) ?? 0) < (opts.maxPerDayWhenUnknown ?? 2)) {
          chosen = d;
          break;
        }
        continue;
      }
      const avail = opts.availability[weekday(d)];
      if (avail == null) continue;
      const load = opts.existingMinutes(d) + (used.get(d) ?? 0);
      if (load + t.durationMinutes <= avail) {
        chosen = d;
        break;
      }
    }
    const overloaded = chosen == null;
    const date = chosen ?? last;
    if (overloaded) warnings.push(`"${t.title}" לא נכנסת בזמן הפנוי עד ${t.deadline} — שובצה ל-${date} למרות עומס.`);
    if (t.deadline < earliest) warnings.push(`"${t.title}" תלויה במשימות שמסתיימות אחרי הדדליין שלה.`);
    used.set(date, (used.get(date) ?? 0) + t.durationMinutes);
    count.set(date, (count.get(date) ?? 0) + 1);
    dateOf.set(t.key, date);
    scheduled.push({ task: t, date, overloaded });
  }
  return { scheduled, warnings };
}
