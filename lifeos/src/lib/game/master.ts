/**
 * Game Master — deterministic, real-data-only guidance. It reads the plan and the ledger and
 * says what to do next. It NEVER changes anything: every suggestion is an action the player
 * chooses to take (start, move, open the plan).
 */
import type { DB } from "../types";
import { addDays, diffDays, formatDuration, startOfWeek } from "../dates";
import { dayLoad, findConflicts, instancesInRange, isOpen, overdueInstances, timedItemsFor, type TaskInstance } from "../tasks";
import { mainQuestInstance, regionStates, totalXp, levelInfo } from "./engine";
import { challengesFor } from "./challenges";
import { REGION_BY_ID, regionOfGoal } from "./regions";

export interface GmNote {
  id: string;
  tone: "celebrate" | "info" | "warn" | "return";
  text: string;
  /** Optional action the player can choose. */
  action?: { kind: "focus" | "reschedule" | "plan" | "link"; key?: string; href?: string; label: string };
}

export interface GmBriefing {
  greeting: string;
  next: TaskInstance | null;
  nextWhy: string;
  notes: GmNote[];
}

const fmtMin = (m: number) => formatDuration(m) || `${m} דק׳`;

export function lastProgressDate(db: DB): string | null {
  let last: string | null = null;
  for (const e of Object.values(db.xpEvents ?? {})) {
    if (e.kind === "achievement" || e.kind === "challenge" || e.kind === "chest") continue;
    const d = e.at.slice(0, 10);
    if (!last || d > last) last = d;
  }
  return last;
}

export function briefing(db: DB, today: string): GmBriefing {
  const notes: GmNote[] = [];
  const todayList = instancesInRange(db, today, today, today);
  const open = todayList.filter((i) => isOpen(i.status));
  const next = mainQuestInstance(db, today);

  // returning after missed days — never punishing
  const last = lastProgressDate(db);
  const away = last ? diffDays(last, today) : null;
  const hasAnyProgress = last !== null;
  if (away !== null && away >= 3) {
    const small = open.filter((i) => (i.task.estimatedMinutes ?? 99) <= 20)[0] ?? next;
    notes.push({
      id: "return",
      tone: "return",
      text: `עברו ${away} ימים מההתקדמות האחרונה. העולם חיכה לך — נתחיל בצעד קטן.`,
      action: small ? { kind: "focus", key: small.key, label: `להתחיל: ${small.title}` } : undefined,
    });
  }

  // celebrate today's real gains
  const gainedToday = Object.values(db.xpEvents ?? {}).filter((e) => e.at.slice(0, 10) === today);
  const xpToday = gainedToday.reduce((s, e) => s + e.amount, 0);
  if (xpToday > 0) notes.push({ id: "today-xp", tone: "celebrate", text: `היום כבר צברת ${xpToday} XP. כל הכבוד.` });

  // overload
  const load = dayLoad(db, today, todayList);
  if (load.over && load.availableMinutes != null) {
    const extra = load.plannedMinutes - load.availableMinutes;
    const movable = open.filter((i) => i.task.priority === "low" || (!i.task.goalId && !i.task.routine)).sort((a, b) => (b.task.estimatedMinutes ?? 0) - (a.task.estimatedMinutes ?? 0))[0];
    notes.push({
      id: "overload",
      tone: "warn",
      text: `היום מתוכננות ${fmtMin(load.plannedMinutes)}, והזמן הפנוי שהגדרת הוא ${fmtMin(load.availableMinutes)} (${fmtMin(extra)} יותר מדי).`,
      action: movable ? { kind: "reschedule", key: movable.key, label: `להזיז את „${movable.title}”` } : undefined,
    });
  }

  // conflicts today
  const conflicts = findConflicts(timedItemsFor(db, today, today));
  if (conflicts.length) {
    const [a, b] = conflicts[0];
    const inst = open.find((i) => i.key === b.key) ?? open.find((i) => i.key === a.key);
    notes.push({
      id: "conflict",
      tone: "warn",
      text: `התנגשות בזמנים: „${a.title}” ו„${b.title}”.`,
      action: inst ? { kind: "reschedule", key: inst.key, label: "לבחור זמן אחר" } : undefined,
    });
  }

  // overdue work, gently
  const overdue = overdueInstances(db, today);
  if (overdue.length >= 2 && !(away !== null && away >= 3)) {
    notes.push({ id: "overdue", tone: "info", text: `${overdue.length} משימות מחכות מימים קודמים. אפשר לבחור אחת ולהמשיך.`, action: { kind: "link", href: "/today", label: "לראות" } });
  }

  // region close to a new landmark
  const rs = regionStates(Object.values(db.xpEvents ?? {}));
  const close = Object.values(rs)
    .filter((r) => r.next && r.next - r.xp <= 30 && r.xp > 0)
    .sort((a, b) => b.fraction - a.fraction)[0];
  if (close) {
    const def = REGION_BY_ID[close.id];
    notes.push({ id: "near-building", tone: "info", text: `עוד ${close.next! - close.xp} XP ב${def.name} והציון הבא — ${def.stages[close.stage].building} — ייבנה.` });
  }

  // no plan at all
  if (!Object.keys(db.goals).length) notes.push({ id: "no-goals", tone: "info", text: "עדיין אין מסעות. כדאי להתחיל ממטרה אחת.", action: { kind: "link", href: "/goals/new", label: "מטרה חדשה" } });

  const greeting = !hasAnyProgress ? "ברוך הבא, חוקר. העולם שלך מחכה לצעד הראשון." : away !== null && away >= 3 ? "ברוך שובך, חוקר." : "ברוך שובך, חוקר.";
  const nextWhy = next
    ? next.date && next.date < today
      ? "מחכה מיום קודם"
      : next.task.priority === "high"
        ? "בעדיפות גבוהה היום"
        : next.task.goalId
          ? "מקדם מטרה פעילה"
          : "המשימה הבאה היום"
    : "";
  return { greeting, next, nextWhy, notes };
}

export interface Report {
  title: string;
  rows: Array<{ label: string; value: string }>;
  lines: string[];
}

export function dailyReport(db: DB, today: string): Report {
  const list = instancesInRange(db, today, today, today);
  const done = list.filter((i) => i.status === "completed").length;
  const evs = Object.values(db.xpEvents ?? {}).filter((e) => e.at.slice(0, 10) === today);
  const xp = evs.reduce((s, e) => s + e.amount, 0);
  const lines: string[] = [];
  const open = list.filter((i) => isOpen(i.status));
  if (open.length) lines.push(`נשארו ${open.length} משימות להיום. אפשר להעביר מה שלא ייכנס — בלי עונש.`);
  else if (list.length) lines.push("כל המשימות של היום הושלמו.");
  const pending = Object.values(db.evidence ?? {}).filter((e) => e.status === "submitted" || e.status === "review" || e.status === "more");
  if (pending.length) lines.push(`${pending.length} הוכחות מחכות לאישור שלך.`);
  return {
    title: "דוח יומי",
    rows: [
      { label: "משימות שהושלמו", value: `${done}/${list.length}` },
      { label: "XP היום", value: String(xp) },
      { label: "הישגים חדשים", value: String(evs.filter((e) => e.kind === "achievement").length) },
    ],
    lines,
  };
}

export function weeklyReport(db: DB, today: string): Report {
  const ws = startOfWeek(today);
  const we = addDays(ws, 6);
  const list = instancesInRange(db, ws, we, today);
  const done = list.filter((i) => i.status === "completed").length;
  const evs = Object.values(db.xpEvents ?? {}).filter((e) => e.at.slice(0, 10) >= ws && e.at.slice(0, 10) <= we);
  const xp = evs.reduce((s, e) => s + e.amount, 0);
  const byRegion = new Map<string, number>();
  for (const e of evs) if (e.region) byRegion.set(e.region, (byRegion.get(e.region) ?? 0) + e.amount);
  const best = [...byRegion.entries()].sort((a, b) => b[1] - a[1])[0];
  const challenges = challengesFor(db, today).filter((c) => c.period === "weekly");
  const lines: string[] = [];
  if (best) lines.push(`האזור החזק השבוע: ${REGION_BY_ID[best[0] as keyof typeof REGION_BY_ID].name} (${best[1]} XP).`);
  const quiet = Object.values(db.goals)
    .filter((g) => g.status === "active")
    .map((g) => regionOfGoal(g))
    .filter((r) => !byRegion.has(r));
  if (quiet.length) lines.push(`בלי התקדמות השבוע: ${[...new Set(quiet)].map((r) => REGION_BY_ID[r].name).join(", ")}.`);
  const missed = list.filter((i) => isOpen(i.status) && i.date! < today).length;
  if (missed) lines.push(`${missed} משימות לא בוצעו בזמן. אפשר להעביר אותן לשבוע הבא מתוך „היום שלי”.`);
  return {
    title: "דוח שבועי",
    rows: [
      { label: "משימות שהושלמו", value: `${done}/${list.length}` },
      { label: "XP השבוע", value: String(xp) },
      { label: "אבני דרך", value: String(evs.filter((e) => e.kind === "milestone").length) },
      { label: "אתגרים שבועיים", value: `${challenges.filter((c) => c.done).length}/${challenges.length}` },
      { label: "רמה", value: String(levelInfo(totalXp(db)).level) },
    ],
    lines,
  };
}

/** Compact, real-data context for the AI Game Master persona (no private notes, no evidence files). */
export function aiGameContext(db: DB, today: string): string {
  const b = briefing(db, today);
  const lvl = levelInfo(totalXp(db));
  const rs = regionStates(Object.values(db.xpEvents ?? {}));
  const regions = Object.values(rs)
    .map((r) => `${REGION_BY_ID[r.id].name}: שלב ${r.stage}/5, ${r.xp} XP`)
    .join("; ");
  const ch = challengesFor(db, today)
    .map((c) => `${c.title} (${c.progress}/${c.target})`)
    .join("; ");
  return [
    `רמה ${lvl.level} (${lvl.xp} XP).`,
    `אזורים: ${regions}.`,
    b.next ? `המשימה הבאה המומלצת: ${b.next.title}.` : "אין משימה פתוחה היום.",
    ch ? `אתגרים פעילים: ${ch}.` : "",
    ...b.notes.map((n) => n.text),
  ]
    .filter(Boolean)
    .join("\n");
}
