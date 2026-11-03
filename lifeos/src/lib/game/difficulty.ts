/**
 * Dynamic quest difficulty & XP evaluation — the deterministic half.
 *
 * The AI (server) rates five dimensions of a task from its real description. Everything after
 * that is plain, transparent code that runs identically on the server and in the browser:
 *   weighted score → difficulty level 1..5 → XP inside the level's range,
 * plus anti-exploit rules applied when rewards are granted (duplicates, repeats, sub-task budgets,
 * splitting). The player can clarify the scope; they can never choose the XP.
 */
import type { DB, EvalDims, Task, TaskEvaluation } from "../types";

export const EVALUATION_VERSION = 1;

/** XP range per difficulty level. Tuned by the balance tests in __tests__/difficulty.test.ts. */
export const XP_TABLE: Record<1 | 2 | 3 | 4 | 5, [number, number]> = {
  1: [5, 10],
  2: [15, 20],
  3: [25, 40],
  4: [50, 75],
  5: [100, 150],
};

/**
 * Weights of the scoring model. Goal significance is deliberately small and additionally capped
 * (see SIGNIFICANCE_MAX_LIFT): an important goal does not make a small task hard.
 */
export const WEIGHTS: Record<keyof EvalDims, number> = { time: 0.3, complexity: 0.25, effort: 0.2, scope: 0.2, significance: 0.05 };
export const SIGNIFICANCE_MAX_LIFT = 0.15;
/** Without an AI evaluation the level is capped: self-reported minutes alone can't reach the top levels. */
export const RULES_MAX_LEVEL = 3;

export const DIM_LABEL: Record<keyof EvalDims, string> = { time: "זמן", complexity: "מורכבות", effort: "מאמץ וריכוז", scope: "היקף התוצאה", significance: "קשר למטרה" };
export const LEVEL_LABEL = ["", "קלה", "קלה־בינונית", "בינונית", "קשה", "אפית"];

export function timeScore(minutes: number): number {
  if (minutes <= 10) return 1;
  if (minutes <= 25) return 1.5 + (minutes - 10) / 30; // 1.5..2
  if (minutes <= 60) return 2 + (minutes - 25) / 35; // 2..3
  if (minutes <= 150) return 3 + (minutes - 60) / 90; // 3..4
  if (minutes <= 360) return 4 + (minutes - 150) / 210; // 4..5
  return 5;
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export interface Scored {
  score: number;
  level: 1 | 2 | 3 | 4 | 5;
  xp: number;
  contributions: Record<keyof EvalDims, number>;
}

/** Transparent weighted model. */
export function scoreDims(dims: EvalDims, opts: { maxLevel?: number } = {}): Scored {
  const d = Object.fromEntries(Object.entries(dims).map(([k, v]) => [k, clamp(v, 1, 5)])) as EvalDims;
  const base = (d.time * WEIGHTS.time + d.complexity * WEIGHTS.complexity + d.effort * WEIGHTS.effort + d.scope * WEIGHTS.scope) / (1 - WEIGHTS.significance);
  // significance can only nudge, never dominate
  const lift = clamp((d.significance - 3) * WEIGHTS.significance, -SIGNIFICANCE_MAX_LIFT, SIGNIFICANCE_MAX_LIFT);
  const score = clamp(base + lift, 1, 5);
  const level = clamp(Math.round(score), 1, opts.maxLevel ?? 5) as Scored["level"];
  // position inside the level's band → XP inside its range
  const frac = level === Math.round(score) ? clamp(score - (level - 0.5), 0, 1) : 1;
  const [lo, hi] = XP_TABLE[level];
  const contributions = {
    time: d.time * WEIGHTS.time,
    complexity: d.complexity * WEIGHTS.complexity,
    effort: d.effort * WEIGHTS.effort,
    scope: d.scope * WEIGHTS.scope,
    significance: lift,
  };
  return { score: Math.round(score * 100) / 100, level, xp: Math.round(lo + (hi - lo) * frac), contributions };
}

// ───────── text helpers (Hebrew-aware, no external libs) ─────────

const STOP = new Set(["של", "את", "עם", "על", "אל", "גם", "או", "לא", "זה", "זו", "the", "a", "an", "to", "and", "of", "for"]);
export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[והבכלמש](?=\p{L}{3,})/u, "")) // strip one common Hebrew prefix letter
    .filter((w) => w.length > 1 && !STOP.has(w));
}
export function similarity(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
/** Same activity → same key (numbers/dates are ignored, so "קריאה פרק 3" ≈ "קריאה פרק 4"). */
export function repeatKeyOf(task: Pick<Task, "id" | "title" | "recurrence">): string {
  if (task.recurrence) return `rec:${task.id}`;
  return "t:" + [...new Set(tokens(task.title))].sort().join(" ").slice(0, 180);
}

/** FNV-1a over the fields that define the scope. Any change → re-evaluation. */
export function contentHash(task: Pick<Task, "title" | "notes" | "estimatedMinutes" | "parentTaskId" | "goalId" | "milestoneId">, clarified = ""): string {
  const s = [task.title.trim(), task.notes.trim(), task.estimatedMinutes ?? "", task.parentTaskId ?? "", task.goalId ?? "", task.milestoneId ?? "", clarified.trim()].join("␟");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function countSteps(notes: string): number {
  const lines = notes.split("\n").filter((l) => /^\s*([-*•]|\[ ?\]|\d+[.)])\s+\S/.test(l));
  return Math.max(1, lines.length);
}

// ───────── personal calibration ─────────

export interface Familiarity {
  level: TaskEvaluation["familiarity"];
  similarDone: number;
}
/** How familiar the player is with this kind of task (from completed history). Informational. */
export function familiarityOf(db: DB, task: Task): Familiarity {
  const done = Object.values(db.tasks).filter((t) => t.id !== task.id && t.status === "completed" && similarity(t.title, task.title) >= 0.5).length;
  const occ = task.recurrence ? Object.values(db.occurrences).filter((o) => o.taskId === task.id && o.status === "completed").length : 0;
  const n = done + occ;
  return { level: n >= 6 ? "experienced" : n >= 2 ? "some" : "new", similarDone: n };
}

/**
 * The player's pace: median of actual/estimated minutes over recent tasks that have both.
 * Used for the personal duration estimate only — XP is based on the task's scope, so getting
 * faster at something never lowers its reward.
 */
export function paceRatio(db: DB): { ratio: number; samples: number } {
  const ratios = Object.values(db.tasks)
    .filter((t) => t.status === "completed" && t.actualMinutes && t.estimatedMinutes)
    .sort((a, b) => ((a.completedAt ?? "") < (b.completedAt ?? "") ? 1 : -1))
    .slice(0, 30)
    .map((t) => t.actualMinutes! / t.estimatedMinutes!)
    .sort((a, b) => a - b);
  if (ratios.length < 3) return { ratio: 1, samples: ratios.length };
  const m = ratios[Math.floor(ratios.length / 2)];
  return { ratio: clamp(m, 0.5, 2), samples: ratios.length };
}

// ───────── duplicates ─────────

/** An earlier, still-relevant task that is essentially the same one (same goal, very similar title). */
export function findDuplicate(db: DB, task: Task): Task | null {
  if (task.recurrence) return null;
  let best: Task | null = null;
  for (const t of Object.values(db.tasks)) {
    if (t.id === task.id || t.recurrence || t.parentTaskId === task.id || task.parentTaskId === t.id) continue;
    if ((t.goalId ?? null) !== (task.goalId ?? null)) continue;
    if (t.createdAt > task.createdAt) continue; // only earlier tasks can be the original
    if (similarity(t.title, task.title) < 0.8) continue;
    const sameDay = (t.date ?? t.createdAt.slice(0, 10)) === (task.date ?? task.createdAt.slice(0, 10));
    if (!sameDay && t.status === "completed") continue; // doing it again another day is a repeat, not a duplicate
    if (!best || t.createdAt < best.createdAt) best = t;
  }
  return best;
}

// ───────── rule-based fallback (no AI) ─────────

/** Conservative heuristic dims from the structured fields only. Capped at level RULES_MAX_LEVEL. */
export function ruleDims(db: DB, task: Task): { dims: EvalDims; minutes: number; steps: number } {
  const steps = countSteps(task.notes);
  const minutes = clamp(task.estimatedMinutes ?? 20, 5, 240);
  const t = timeScore(minutes);
  const goal = task.goalId ? db.goals[task.goalId] : null;
  return {
    minutes,
    steps,
    dims: {
      time: t,
      complexity: clamp(1 + (steps - 1) * 0.4 + (task.notes.length > 300 ? 0.5 : 0), 1, 4),
      effort: clamp(t - 0.5, 1, 4),
      scope: clamp(1 + (steps - 1) * 0.5, 1, 4),
      significance: goal ? (task.milestoneId ? 4 : 3) : 2,
    },
  };
}

export interface EvalContext {
  db: DB;
  task: Task;
  clarifiedScope?: string;
  answers?: TaskEvaluation["answers"];
  now: string;
}

/** Builds a full evaluation record from dimension ratings (AI or rules). Deterministic. */
export function buildEvaluation(
  ctx: EvalContext,
  input: { dims: EvalDims; estimatedMinutes: number; steps: number; source: "ai" | "rules"; rationale?: string; questions?: TaskEvaluation["questions"] },
): TaskEvaluation {
  const { db, task, now } = ctx;
  const prev = db.evaluations?.[task.id] ?? null;
  const clarified = ctx.clarifiedScope ?? prev?.clarifiedScope ?? "";
  const s = scoreDims(input.dims, { maxLevel: input.source === "rules" ? RULES_MAX_LEVEL : 5 });
  const fam = familiarityOf(db, task);
  const pace = paceRatio(db);
  const dup = findDuplicate(db, task);
  const top = (Object.keys(s.contributions) as Array<keyof EvalDims>).filter((k) => k !== "significance").sort((a, b) => s.contributions[b] - s.contributions[a]);
  const reasons = [
    `${DIM_LABEL[top[0]]} ו${DIM_LABEL[top[1]]} הם שקבעו בעיקר את הרמה`,
    input.dims.significance >= 4 ? "קשורה למטרה חשובה — משפיע מעט בלבד על הקושי" : null,
    input.source === "rules" ? `הערכה בסיסית בלי AI (עד רמה ${RULES_MAX_LEVEL})` : null,
    dup ? `נראית כמו „${dup.title}” — רק אחת מהן תקבל XP` : null,
    task.parentTaskId ? "תת־משימה: חולקת את תקציב ה-XP של משימת האב" : null,
  ].filter((x): x is string => !!x);
  const minutes = Math.round(clamp(input.estimatedMinutes, 1, 24 * 60));
  return {
    id: task.id,
    taskId: task.id,
    originalDescription: [task.title, task.notes].filter(Boolean).join("\n").slice(0, 4500),
    clarifiedScope: clarified.slice(0, 1500),
    answers: (ctx.answers ?? prev?.answers ?? []).slice(-6),
    questions: (input.questions ?? []).slice(0, 2),
    dims: input.dims,
    score: s.score,
    difficulty: s.level,
    estimatedMinutes: minutes,
    steps: clamp(Math.round(input.steps), 1, 100),
    personalMinutes: pace.samples >= 3 ? Math.round(minutes * pace.ratio) : null,
    familiarity: fam.level,
    xp: s.xp,
    explanation: (input.rationale?.trim() || `רמה ${s.level} (${LEVEL_LABEL[s.level]}): כ-${minutes} דק׳, ${input.steps === 1 ? "שלב אחד" : `${input.steps} שלבים`}.`).slice(0, 600),
    reasons,
    source: input.source,
    repeatKey: repeatKeyOf(task),
    duplicateOf: dup?.id ?? null,
    parentTaskId: task.parentTaskId,
    contentHash: contentHash(task, clarified),
    evaluationVersion: EVALUATION_VERSION,
    lockedAt: prev?.lockedAt ?? null,
    previous: prev && prev.contentHash !== contentHash(task, clarified) ? [...prev.previous, { at: prev.updatedAt, difficulty: prev.difficulty, xp: prev.xp, contentHash: prev.contentHash }].slice(-10) : (prev?.previous ?? []),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
}

export function ruleEvaluation(db: DB, task: Task, now: string): TaskEvaluation {
  const r = ruleDims(db, task);
  return buildEvaluation({ db, task, now }, { dims: r.dims, estimatedMinutes: r.minutes, steps: r.steps, source: "rules" });
}

/**
 * The evaluation that counts for a task right now:
 * - completed task with an evaluation made before completion → frozen (later edits can't change it);
 * - stored and up to date → it;
 * - stored but the scope changed since → the lower of the stored XP and a fresh rules evaluation,
 *   until the AI re-evaluates (editing never inflates a reward);
 * - none → rules evaluation.
 */
export function effectiveEvaluation(db: DB, task: Task, now = task.updatedAt): { ev: TaskEvaluation; stale: boolean } {
  const stored = db.evaluations?.[task.id];
  if (stored) {
    if (task.status === "completed" && task.completedAt && stored.updatedAt <= task.completedAt) return { ev: stored, stale: false };
    if (stored.contentHash === contentHash(task, stored.clarifiedScope)) return { ev: stored, stale: false };
    const rules = ruleEvaluation(db, task, now);
    return { ev: rules.xp <= stored.xp ? { ...rules, clarifiedScope: stored.clarifiedScope } : { ...stored, xp: stored.xp }, stale: true };
  }
  return { ev: ruleEvaluation(db, task, now), stale: false };
}

// ───────── AI assessment → evaluation ─────────

export interface AssessInput {
  title: string;
  notes: string;
  userMinutes: number | null;
  goal: string | null;
  milestone: string | null;
  parent: string | null;
  recurring: boolean;
  clarifiedScope: string;
  answers: TaskEvaluation["answers"];
  similarDone: string[];
  familiarity: TaskEvaluation["familiarity"];
}
export interface Assessment {
  estimatedMinutes: number;
  steps: number;
  complexity: number;
  effort: number;
  scope: number;
  significance: number;
  sufficient: boolean;
  questions: Array<{ q: string; options: string[] }>;
  rationale: string;
}

/** Minimal context for the AI: this task, its goal/milestone/parent titles and similar finished titles. No private notes of other tasks. */
export function assessInputFor(db: DB, task: Task, clarifiedScope: string, answers: TaskEvaluation["answers"]): AssessInput {
  const similarDone = Object.values(db.tasks)
    .filter((t) => t.id !== task.id && t.status === "completed" && similarity(t.title, task.title) >= 0.4)
    .slice(0, 8)
    .map((t) => t.title.slice(0, 200));
  return {
    title: task.title.slice(0, 200),
    notes: task.notes.slice(0, 4000),
    userMinutes: task.estimatedMinutes,
    goal: task.goalId ? (db.goals[task.goalId]?.title ?? null) : null,
    milestone: task.milestoneId ? (db.milestones[task.milestoneId]?.title ?? null) : null,
    parent: task.parentTaskId ? (db.tasks[task.parentTaskId]?.title ?? null) : null,
    recurring: !!task.recurrence,
    clarifiedScope: clarifiedScope.slice(0, 1500),
    answers: answers.slice(-6),
    similarDone,
    familiarity: familiarityOf(db, task).level,
  };
}

/**
 * Turns the AI's ratings into an evaluation. The time dimension uses the user's minutes only when
 * they are plausible for the described scope (within ½×–2× of the AI's estimate) — typing a big
 * number doesn't make a task harder.
 */
export function evaluationFromAssessment(ctx: EvalContext, a: Assessment): TaskEvaluation {
  const user = ctx.task.estimatedMinutes;
  const plausible = user != null && user >= a.estimatedMinutes * 0.5 && user <= a.estimatedMinutes * 2;
  const minutes = plausible ? user! : a.estimatedMinutes;
  const answered = (ctx.answers ?? []).length;
  const ev = buildEvaluation(ctx, {
    dims: { time: timeScore(minutes), complexity: a.complexity, effort: a.effort, scope: a.scope, significance: a.significance },
    estimatedMinutes: minutes,
    steps: a.steps,
    source: "ai",
    rationale: a.rationale,
    // ask at most two rounds of questions
    questions: a.sufficient || answered >= 4 ? [] : a.questions.slice(0, 2).map((q) => ({ q: q.q, options: q.options })),
  });
  if (user != null && !plausible) ev.reasons.push(`המשך שהוזן (${user} דק׳) לא תואם את ההיקף — חושב לפי ${a.estimatedMinutes} דק׳`);
  return ev;
}

/**
 * Completed (non-recurring) tasks that have no stored evaluation get one frozen at completion time,
 * so editing a finished task later can't change its reward.
 */
export function evaluationsToFreeze(db: DB, now: string): TaskEvaluation[] {
  const out: TaskEvaluation[] = [];
  for (const t of Object.values(db.tasks)) {
    if (t.recurrence || t.status !== "completed" || db.evaluations?.[t.id]) continue;
    const at = t.completedAt ?? now;
    out.push({ ...ruleEvaluation(db, t, at), createdAt: at, updatedAt: at, lockedAt: at });
  }
  return out;
}
