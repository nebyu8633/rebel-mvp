import { GoalPlan } from "./schema";
import { findCycleGeneric } from "./util";

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const LIMITS = { tasks: 80, routines: 15, milestones: 12 };

export interface GoalPlanValidation {
  ok: boolean;
  errors: string[];
  fixes: string[];
  plan: GoalPlan | null;
}

/**
 * Validate a plan (AI-generated, template-generated or user-edited) against application rules.
 * Safe repairs are applied and reported; anything else is an error and the plan cannot be saved/approved.
 */
export function validateGoalPlan(raw: unknown, ctx: { today: string }): GoalPlanValidation {
  const parsed = GoalPlan.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: [`מבנה התוכנית אינו תקין (${parsed.error.issues[0]?.path.join(".")})`], fixes: [], plan: null };
  const p = structuredClone(parsed.data);
  const errors: string[] = [];
  const fixes: string[] = [];
  const { today } = ctx;

  if (!DATE.test(p.targetDate)) errors.push("תאריך היעד אינו תקין");
  else if (p.targetDate <= today) errors.push("תאריך היעד חייב להיות בעתיד");
  if (!p.summary.trim()) errors.push("חסר סיכום מטרה");
  if (p.milestones.length > LIMITS.milestones) errors.push(`יותר מדי אבני דרך (${p.milestones.length})`);
  if (p.tasks.length > LIMITS.tasks) errors.push(`יותר מדי משימות (${p.tasks.length}, מקסימום ${LIMITS.tasks})`);
  if (p.routines.length > LIMITS.routines) errors.push(`יותר מדי שגרות (${p.routines.length})`);

  const uniq = (keys: string[], what: string) => {
    const seen = new Set<string>();
    for (const k of keys) {
      if (!k.trim()) errors.push(`${what} ללא מזהה`);
      if (seen.has(k)) errors.push(`מזהה כפול ב${what}: ${k}`);
      seen.add(k);
    }
  };
  uniq(p.milestones.map((m) => m.key), "אבני הדרך");
  uniq([...p.tasks.map((t) => t.key), ...p.routines.map((r) => r.key)], "המשימות");

  const msKeys = new Set(p.milestones.map((m) => m.key));
  for (const m of p.milestones) {
    if (!m.title.trim()) errors.push("אבן דרך ללא כותרת");
    if (!DATE.test(m.targetDate)) {
      fixes.push(`תאריך לא תקין ל"${m.title}" הוחלף בתאריך היעד`);
      m.targetDate = p.targetDate;
    } else if (m.targetDate > p.targetDate) {
      fixes.push(`"${m.title}" הוגבלה לתאריך היעד`);
      m.targetDate = p.targetDate;
    }
    m.monthlyObjectives = m.monthlyObjectives.filter((o) => DATE.test(o.month) && o.title.trim());
    m.weeklyObjectives = m.weeklyObjectives.filter((o) => DATE.test(o.weekStart) && o.title.trim());
  }
  const allKeys = new Set(p.tasks.map((t) => t.key));
  for (const t of p.tasks) {
    if (!t.title.trim()) errors.push("משימה ללא כותרת");
    if (t.milestoneKey && !msKeys.has(t.milestoneKey)) {
      fixes.push(`"${t.title}": אבן הדרך לא קיימת — המשימה שויכה למטרה בלבד`);
      t.milestoneKey = null;
    }
    if (!Number.isFinite(t.durationMinutes) || t.durationMinutes < 5) {
      t.durationMinutes = 15;
      fixes.push(`משך "${t.title}" תוקן ל-15 דק׳`);
    } else if (t.durationMinutes > 480) {
      t.durationMinutes = 480;
      fixes.push(`משך "${t.title}" הוגבל ל-8 שעות`);
    }
    t.durationMinutes = Math.round(t.durationMinutes);
    if (!DATE.test(t.deadline)) {
      t.deadline = p.targetDate;
      fixes.push(`דדליין לא תקין ל"${t.title}"`);
    }
    if (t.deadline < today) {
      t.deadline = today;
      fixes.push(`דדליין בעבר של "${t.title}" הועבר להיום`);
    }
    if (t.deadline > p.targetDate) {
      t.deadline = p.targetDate;
      fixes.push(`דדליין של "${t.title}" הוגבל לתאריך היעד`);
    }
    if (t.date && !DATE.test(t.date)) t.date = null;
    if (t.startTime && !TIME.test(t.startTime)) t.startTime = null;
    if (t.reminderMinutes != null && (t.reminderMinutes < 0 || t.reminderMinutes > 1440)) t.reminderMinutes = null;
    const before = t.dependsOn.length;
    t.dependsOn = [...new Set(t.dependsOn.filter((d) => allKeys.has(d) && d !== t.key))];
    if (before !== t.dependsOn.length) fixes.push(`הוסרו תלויות לא קיימות ב"${t.title}"`);
  }
  const cycle = findCycleGeneric(p.tasks);
  if (cycle) errors.push(`תלות מעגלית: ${cycle.join(" ← ")}`);

  for (const r of p.routines) {
    if (!r.title.trim()) errors.push("שגרה ללא כותרת");
    r.interval = Math.max(1, Math.round(r.interval || 1));
    if (r.freq === "weekly") {
      r.byWeekday = [...new Set(r.byWeekday.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
      if (!r.byWeekday.length) errors.push(`בשגרה "${r.title}" לא נבחרו ימים`);
    }
    if (r.backupWeekday != null && r.byWeekday.includes(r.backupWeekday)) {
      r.backupWeekday = null;
      fixes.push(`יום הגיבוי של "${r.title}" זהה ליום הקבוע — בוטל`);
    }
    if (r.freq === "monthly" && (r.byMonthDay == null || r.byMonthDay < 1 || r.byMonthDay > 31)) r.byMonthDay = 1;
    if (!DATE.test(r.startDate) || r.startDate < today) r.startDate = today;
    if (r.endDate && (!DATE.test(r.endDate) || r.endDate < r.startDate)) r.endDate = p.targetDate;
    if (r.startTime && !TIME.test(r.startTime)) r.startTime = null;
    if (r.durationMinutes < 5 || r.durationMinutes > 480) r.durationMinutes = Math.min(480, Math.max(5, Math.round(r.durationMinutes || 15)));
  }
  p.review.weekday = Math.min(6, Math.max(0, Math.round(p.review.weekday)));
  if (p.review.startTime && !TIME.test(p.review.startTime)) p.review.startTime = null;
  return { ok: errors.length === 0, errors, fixes, plan: p };
}
