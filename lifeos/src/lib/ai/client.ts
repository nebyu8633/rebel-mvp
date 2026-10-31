"use client";
import type { DB } from "../types";
import type { AIContext } from "./provider";
import type { PlanInput, PlanProposal } from "../planner/schema";
import { addDays, startOfWeek, formatDuration } from "../dates";
import { instancesInRange, overdueInstances, weekStats } from "../tasks";
import { goalProgress } from "../goals";
import { WEEKDAYS_HE } from "../dates";

let statusCache: Promise<boolean> | null = null;
export function aiConfigured(): Promise<boolean> {
  if (!statusCache)
    statusCache = fetch("/api/ai/status")
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((j) => Boolean(j.configured))
      .catch(() => false);
  return statusCache;
}

export class AIRequestError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new AIRequestError("אין חיבור לשרת.", "network");
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new AIRequestError(j.error ?? `שגיאה (${res.status})`, j.code ?? "unavailable");
  return j as T;
}

export function requestAIPlan(input: PlanInput, today: string) {
  return post<{ plan: PlanProposal; fixes: string[]; source: string }>("/api/ai/plan", { input, today });
}

export function requestAIAnswer(question: string, context: AIContext) {
  return post<{ answer: string; source: string }>("/api/ai/ask", { question, context });
}

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** A compact, bounded snapshot of the current user's own data for the assistant. */
export function buildContext(db: DB, today: string): AIContext {
  const settings = db.settings.settings;
  const describe = (i: ReturnType<typeof instancesInRange>[number]) =>
    cut(
      `${i.date} ${i.startTime ?? ""} | ${i.title} | עדיפות ${i.task.priority} | ${i.task.estimatedMinutes ?? "?"} דק׳ | ${i.status}${i.task.goalId && db.goals[i.task.goalId] ? ` | מטרה: ${db.goals[i.task.goalId].title}` : ""}${i.task.deadline ? ` | דדליין ${i.task.deadline}` : ""}`,
      300,
    );
  const ws = startOfWeek(today);
  const st = weekStats(db, ws, today);
  return {
    today,
    timezone: settings?.timezone ?? "Asia/Jerusalem",
    goals: Object.values(db.goals)
      .slice(0, 20)
      .map((g) => {
        const p = goalProgress(db, g, today);
        return {
          title: cut(g.title, 200),
          kind: g.kind,
          targetDate: g.targetDate,
          progress: cut(
            p.fraction != null
              ? `${Math.round(p.fraction * 100)}% (נוכחי ${p.current} ${p.unit}, יעד ${p.target} ${p.unit}); עבר ${Math.round(p.timeElapsed * 100)}% מהזמן`
              : `לא ניתן לחשב — חסר: ${p.missing.join(", ") || "נתונים"}`,
            300,
          ),
          milestones: Object.values(db.milestones)
            .filter((m) => m.goalId === g.id)
            .slice(0, 20)
            .map((m) => cut(`${m.title} (${m.status}${m.targetDate ? `, עד ${m.targetDate}` : ""})`, 250)),
        };
      }),
    today_tasks: instancesInRange(db, today, today, today).slice(0, 60).map(describe),
    overdue: overdueInstances(db, today).slice(0, 60).map(describe),
    upcoming_week: instancesInRange(db, addDays(today, 1), addDays(today, 7), today).slice(0, 120).map(describe),
    week_stats: `השבוע: ${st.completed} הושלמו מתוך ${st.planned} מתוכננות, ${st.missed} פוספסו, ${st.skipped} דולגו`,
    availability: settings
      ? settings.availability.map((m, i) => `${WEEKDAYS_HE[i]}: ${m == null ? "לא הוגדר" : formatDuration(m) || "0"}`).join(", ")
      : "לא הוגדר",
    meal_plan: Object.values(db.mealPlan)
      .filter((e) => e.date >= ws && e.date <= addDays(ws, 13))
      .slice(0, 60)
      .map((e) => cut(`${e.date} ${e.slot}: ${db.meals[e.mealId]?.name ?? "?"} x${e.portions}`, 300)),
    grocery: Object.values(db.groceries)
      .filter((g) => g.weekStart === ws)
      .slice(0, 150)
      .map((g) => cut(`${g.name} ${g.quantity ?? ""} ${g.unit}${g.purchased ? " (נקנה)" : ""}`, 200)),
  };
}
