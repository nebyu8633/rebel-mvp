/**
 * Built-in (non-AI) assistant: answers the common planning questions from the user's
 * own data with deterministic rules. Clearly labelled in the UI as the basic engine.
 */
import type { DB } from "./types";
import { addDays, formatDuration, relativeDayLabel, startOfWeek } from "./dates";
import { dayLoad, instancesInRange, isOpen, mostImportant, overdueInstances, weekStats } from "./tasks";
import { goalProgress } from "./goals";
import { buildRecoveryPlan } from "./recovery";

export type Intent = "focus" | "breakdown" | "recover" | "grocery" | "progress" | "unknown";

export interface BasicAnswer {
  intent: Intent;
  text: string;
  /** Suggested in-app actions the UI renders as buttons. */
  actions: Array<{ kind: "recovery" | "groceries" | "planner" | "progress" | "tasks"; label: string }>;
}

export function detectIntent(q: string): Intent {
  const s = q.replace(/\s+/g, " ");
  if (/(פספס|פיספס|החמצ|לא הספק|לסדר מחדש|לארגן מחדש|reorgan|missed)/.test(s)) return "recover";
  if (/(קניות|מצרכ|רשימת קנ|grocery)/.test(s)) return "grocery";
  if (/(לפרק|פירוק|צעדים שבועיים|שלבים|break)/.test(s)) return "breakdown";
  if (/(התקדמ|מתקדם|איפה אני עומד|progress)/.test(s)) return "progress";
  if (/(להתמקד|היום|מה לעשות|focus|עדיפות)/.test(s)) return "focus";
  return "unknown";
}

export function basicAnswer(db: DB, q: string, today: string): BasicAnswer {
  const intent = detectIntent(q);
  switch (intent) {
    case "focus": {
      const todayList = instancesInRange(db, today, today, today);
      const overdue = overdueInstances(db, today);
      const top = mostImportant(db, [...overdue, ...todayList], today);
      const load = dayLoad(db, today, todayList);
      const open = [...overdue, ...todayList].filter((i) => isOpen(i.status));
      if (!open.length) return { intent, text: "אין משימות פתוחות היום.", actions: [{ kind: "tasks", label: "לרשימת המשימות" }] };
      const lines = [`**${top!.title}**${top!.task.goalId && db.goals[top!.task.goalId] ? ` · ${db.goals[top!.task.goalId].title}` : ""}`];
      const rest = open.filter((i) => i.key !== top!.key).slice(0, 3);
      if (rest.length) lines.push(`אחר כך: ${rest.map((i) => i.title).join(" · ")}`);
      if (load.availableMinutes != null)
        lines.push(load.over ? `⚠ ${formatDuration(load.plannedMinutes)} מתוך ${formatDuration(load.availableMinutes)} — כדאי לדחות משהו.` : `עומס: ${formatDuration(load.plannedMinutes) || "קל"} / ${formatDuration(load.availableMinutes)}`);
      if (overdue.length) lines.push(`${overdue.length} באיחור.`);
      return { intent, text: lines.join("\n"), actions: overdue.length ? [{ kind: "recovery", label: "תוכנית התאוששות" }] : [] };
    }
    case "recover": {
      const plan = buildRecoveryPlan(db, today);
      if (!plan.actions.length) return { intent, text: "אין משימות שפוספסו.", actions: [] };
      const lines = plan.actions.slice(0, 8).map((a) => `• ${a.title} — ${a.action === "move" ? relativeDayLabel(a.date!, today) : a.action === "skip" ? "דילוג (חוזרת)" : "ללא תאריך"}`);
      return { intent, text: `פריסה מוצעת:\n${lines.join("\n")}${plan.warnings.length ? `\n\n${plan.warnings.join("\n")}` : ""}`, actions: [{ kind: "recovery", label: "לבדוק ולהחיל" }] };
    }
    case "grocery": {
      const ws = startOfWeek(today);
      const entries = Object.values(db.mealPlan).filter((e) => e.date >= ws && e.date <= addDays(ws, 6));
      const approved = db.mealWeeks[ws]?.approved;
      if (!entries.length) return { intent, text: "אין תפריט לשבוע. בונים ומאשרים — והרשימה נוצרת לבד.", actions: [{ kind: "groceries", label: "לתפריט השבועי" }] };
      return {
        intent,
        text: approved ? `תפריט מאושר (${entries.length} ארוחות).` : `${entries.length} ארוחות בתפריט — עוד לא אושר.`,
        actions: [{ kind: "groceries", label: "לרשימת הקניות" }],
      };
    }
    case "progress": {
      const lines = Object.values(db.goals).map((g) => {
        const p = goalProgress(db, g, today);
        return `• ${g.title}: ${p.fraction != null ? `${Math.round(p.fraction * 100)}% (עבר ${Math.round(p.timeElapsed * 100)}% מהזמן)` : `חסר: ${p.missing.join(", ")}`}`;
      });
      const st = weekStats(db, startOfWeek(today), today);
      lines.push(`\nהשבוע: ${st.completed} מתוך ${st.planned} משימות הושלמו${st.missed ? `, ${st.missed} פוספסו` : ""}.`);
      return { intent, text: lines.join("\n"), actions: [{ kind: "progress", label: "למסך ההתקדמות" }] };
    }
    case "breakdown":
      return { intent, text: "מתחילים שיחת תכנון קצרה — והתוכנית מוצגת לאישור.", actions: [{ kind: "planner", label: "לפתוח את המתכנן" }] };
    default:
      return { intent, text: "אפשר לשאול על: מיקוד היום, סידור מחדש, קניות, התקדמות, פירוק מטרה. (שאלות חופשיות — עם AI.)", actions: [] };
  }
}
