"use client";
/**
 * Orchestrates the goal-planning conversation on top of the shared store.
 * Every step is persisted atomically (messages + profile + conversation state in one batch),
 * so the user can leave and resume at any point. AI failures never produce fake assistant
 * messages: the error is returned to the UI and nothing but the user's own message is saved.
 */
import { useStore } from "../store/store";
import type { BatchOp } from "../store/repo";
import type { CollectionName, ConversationMessage, DB, Goal, GoalConversation, GoalKind, GoalProfile, PlanVersion } from "../types";
import type { GoalPlan, ProfileFact, Question } from "./schema";
import {
  acknowledge,
  contradictions,
  detectKind,
  extractFacts,
  KIND_LABEL,
  LABELS,
  makeFact,
  missingCritical,
  nextQuestion,
  normalizeAnswer,
  opening,
  progressStage,
  questionFor,
  suggestTitle,
  type Answer,
  type Facts,
} from "./interview";
import { buildGoalPlan, regenerate, SCHEDULE_ONLY_KEYS } from "./builder";
import { schedulePlan, type ScheduleReport } from "./scheduler";
import { validateGoalPlan } from "./validate";
import { buildActivation, type ActivationSummary } from "./activation";
import { addMonths, formatHebDate, WEEKDAYS_HE } from "../dates";
import { formatDuration } from "../dates";
import { uid, nowIso } from "../actions";
import { AIRequestError } from "../ai/client";
import type { GoalTurnOutput, GoalTurnInput, GoalPlanInput } from "./ai-schema";
import { isOpen } from "../tasks";
import { summarizeAccount } from "../finance";

const S = () => useStore.getState();

export const BUILD_KEY = "__build";
export const SPLIT_KEY = "__split";
export const REVISE_KEY = "__revise";

const buildQuestion = (label: string): Question => ({
  key: BUILD_KEY, stage: 6, text: "", help: "", input: "single", options: [{ value: "build", label }], allowCustom: false, unit: "", critical: false, skippable: false,
});

const reviseQuestion: Question = {
  key: REVISE_KEY, stage: 8, text: "מה תרצה/י לשנות בתוכנית?", help: "", input: "single", allowCustom: true, unit: "", critical: false, skippable: false,
  options: [
    { value: "targetDate", label: "תאריך היעד" },
    { value: "weeklyHours", label: "שעות בשבוע" },
    { value: "preferredDays", label: "ימים מועדפים" },
    { value: "preferredTime", label: "שעה ביום" },
    { value: "rebuild", label: "לבנות את הטיוטה מחדש" },
  ],
};

function msg(goalId: string, role: ConversationMessage["role"], text: string, extra: Partial<ConversationMessage> = {}): ConversationMessage {
  const n = nowIso();
  return { id: uid(), goalId, role, text, question: null, answerKey: null, source: "basic", createdAt: n, updatedAt: n, ...extra };
}
const put = <E extends { id: string }>(collection: CollectionName, entity: E): BatchOp => ({ op: "put", collection, entity: entity as unknown as { id: string } & Record<string, unknown> });

export function factsOf(db: DB, goalId: string): Facts {
  return db.profiles[goalId]?.facts ?? {};
}

export function goalKind(goal: Goal): GoalKind {
  return goal.kind;
}

function latestVersion(db: DB, goalId: string, status?: PlanVersion["status"]): PlanVersion | null {
  return (
    Object.values(db.planVersions)
      .filter((v) => v.goalId === goalId && (!status || v.status === status))
      .sort((a, b) => b.version - a.version)[0] ?? null
  );
}
export const draftOf = (db: DB, goalId: string) => latestVersion(db, goalId, "draft");
export const approvedOf = (db: DB, goalId: string) => latestVersion(db, goalId, "approved");

// ───────── Start ─────────

export interface NewGoalResult {
  goalIds: string[];
}

/** Create one goal (with its own conversation) per description. */
export async function createGoals(descriptions: string[], opts: { today: string; mode: "basic" | "ai" }): Promise<NewGoalResult | { error: string }> {
  const ops: BatchOp[] = [];
  const goalIds: string[] = [];
  const db = S().db;
  const n = nowIso();
  descriptions.forEach((text, i) => {
    const kind = detectKind(text);
    const facts = extractFacts(text, kind, opts.today, n);
    const id = uid();
    goalIds.push(id);
    const goal: Goal = {
      id, title: suggestTitle(text, kind), description: text.slice(0, 2000), why: "", kind, status: "planning",
      startDate: opts.today, startConfirmed: false, targetDate: (facts.targetDate?.value as string) ?? addMonths(opts.today, 12),
      unit: "", startValue: null, targetValue: null, manualValue: null, financeAccountId: null, info: {},
      color: ["teal", "indigo", "amber", "rose", "slate"][(Object.keys(db.goals).length + i) % 5], order: Object.keys(db.goals).length + i, createdAt: n, updatedAt: n,
    };
    const q = nextQuestion(kind, facts, []);
    const conv: GoalConversation = { id, goalId: id, mode: opts.mode, phase: "discovery", stage: q?.stage ?? 8, pending: opts.mode === "basic" ? q : null, skipped: [], createdAt: n, updatedAt: n };
    const profile: GoalProfile = { id, goalId: id, facts, unresolved: [], createdAt: n, updatedAt: n };
    ops.push(put("goals", goal), put("conversations", conv), put("profiles", profile), put("messages", msg(id, "user", text)));
    if (opts.mode === "basic") ops.push(put("messages", msg(id, "assistant", opening(kind, facts) + (q ? `\n\n${q.text}` : ""), { question: q })));
  });
  const r = await S().applyBatch(ops);
  return r.ok ? { goalIds } : { error: r.error ?? "שמירה נכשלה" };
}

/** Start a conversation for an existing goal (e.g. the seeded goals), pre-filled with what the app already knows. */
export async function ensureConversation(goal: Goal, today: string, mode: "basic" | "ai"): Promise<boolean> {
  const db = S().db;
  if (db.conversations[goal.id]) return true;
  const n = nowIso();
  const facts = prefillFacts(db, goal, today, n);
  const q = nextQuestion(goal.kind, facts, []);
  const conv: GoalConversation = { id: goal.id, goalId: goal.id, mode, phase: approvedOf(db, goal.id) ? "active" : "discovery", stage: q?.stage ?? 8, pending: mode === "basic" ? q : null, skipped: [], createdAt: n, updatedAt: n };
  const profile: GoalProfile = { id: goal.id, goalId: goal.id, facts, unresolved: [], createdAt: n, updatedAt: n };
  const known = Object.values(facts);
  const text = `בוא/י נתכנן את "${goal.title}". ${known.length ? `מה שכבר רשום אצלך: ${known.map((f) => `${f.label}: ${f.display}`).join(" · ")}.` : ""} אשאל רק את מה שחסר.`;
  const ops = [put("conversations", conv), put("profiles", profile), put("messages", msg(goal.id, "assistant", text + (q && mode === "basic" ? `\n\n${q.text}` : ""), { question: mode === "basic" ? q : null }))];
  return (await S().applyBatch(ops)).ok;
}

function prefillFacts(db: DB, goal: Goal, today: string, now: string): Facts {
  const f: Facts = {};
  const add = (key: string, value: ProfileFact["value"], display: string, label?: string) => {
    const q = questionFor(key);
    f[key] = { key, label: label ?? q?.text ?? key, value, display, kind: "confirmed", source: "app", updatedAt: now };
  };
  const L = (k: string) => LABELS[k];
  if (goal.startConfirmed) add("targetDate", goal.targetDate, formatHebDate(goal.targetDate, { year: true }), L("targetDate"));
  if (goal.kind === "weight") {
    const w = Object.values(db.weightLogs).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    if (w) add("currentWeight", w.kg, `${w.kg} ק״ג`, L("currentWeight"));
    const g = (goal.info as { targetGain?: number }).targetGain;
    if (g != null) add("targetChange", g, `+${g} ק״ג`, L("targetChange"));
  }
  const accEntries = goal.financeAccountId ? Object.values(db.financeEntries).filter((e) => e.accountId === goal.financeAccountId) : [];
  if (goal.kind === "portfolio") {
    if (goal.targetValue) add("targetValue", goal.targetValue, `₪${goal.targetValue.toLocaleString("he-IL")}`, L("targetValue"));
    if (accEntries.length) {
      const v = summarizeAccount(accEntries).currentValue;
      add("currentValue", v, `₪${v.toLocaleString("he-IL")}`, L("currentValue"));
    }
  }
  if (goal.kind === "motorcycle") {
    const info = goal.info as Record<string, unknown>;
    if (info.model) add("model", String(info.model), String(info.model), L("model"));
    if (typeof info.price === "number") add("price", info.price, `₪${info.price.toLocaleString("he-IL")}`, L("price"));
    if (typeof info.monthlySavingCapacity === "number") add("monthlySaving", info.monthlySavingCapacity, `₪${info.monthlySavingCapacity.toLocaleString("he-IL")}`, L("monthlySaving"));
    if (accEntries.length) {
      const v = summarizeAccount(accEntries).currentValue;
      add("savedSoFar", v, `₪${v.toLocaleString("he-IL")}`, L("savedSoFar"));
    }
  }
  void today;
  return f;
}

// ───────── Basic engine turns ─────────

export type TurnResult = { ok: true } | { ok: false; error: string; retryable?: boolean };

function afterFactsOps(db: DB, goal: Goal, conv: GoalConversation, facts: Facts, changedKey: string | null, ack: string, now: string): BatchOp[] {
  const ops: BatchOp[] = [];
  const contr = contradictions(goal.kind, facts, now.slice(0, 10));
  const q = nextQuestion(goal.kind, facts, conv.skipped);
  const hasPlan = !!(draftOf(db, goal.id) || approvedOf(db, goal.id));
  let text = ack;
  if (contr.length) text += `\n\nשים/י לב: ${contr.join(" ")} אפשר לעדכן תשובה בסיכום שבצד.`;
  let question: Question | null = q;
  if (q) text += `\n\n${q.text}`;
  else {
    const missing = missingCritical(goal.kind, facts);
    question = buildQuestion(hasPlan ? "עדכון טיוטת התוכנית" : "בניית טיוטת תוכנית");
    text += missing.length
      ? `\n\nחסר עדיין מידע קריטי: ${missing.join(", ")}.`
      : hasPlan
        ? changedKey && SCHEDULE_ONLY_KEYS.has(changedKey)
          ? "\n\nהשינוי משפיע רק על לוח הזמנים — אעדכן את השיבוץ בלי לשנות את תוכן התוכנית."
          : "\n\nאפשר לעדכן את הטיוטה לפי התשובות החדשות. פריטים שערכת ידנית יישמרו."
        : "\n\nיש לי מספיק מידע כדי לבנות טיוטת תוכנית. היא תוצג לבדיקה ולעריכה — שום דבר לא ייכנס ללוח לפני אישורך.";
  }
  ops.push(
    put("conversations", { ...conv, pending: question, stage: q ? q.stage : 6, updatedAt: now }),
    put("messages", msg(goal.id, "assistant", text, { question })),
  );
  return ops;
}

export async function answerPending(goalId: string, raw: Answer["value"], opts: { estimate?: boolean; today: string }): Promise<TurnResult> {
  const db = S().db;
  const goal = db.goals[goalId];
  const conv = db.conversations[goalId];
  const q = conv?.pending;
  if (!goal || !conv || !q) return { ok: false, error: "אין שאלה פתוחה" };
  const now = nowIso();
  if (q.key === BUILD_KEY) return buildDraft(goalId, { today: opts.today });
  if (q.key === REVISE_KEY) return reviseIntent(goalId, String(raw ?? ""), opts.today);
  const norm = normalizeAnswer(q, raw, opts.today);
  if (norm.error) return { ok: false, error: norm.error };
  const fact = makeFact(q, norm.value, now, opts.estimate);
  const facts = { ...factsOf(db, goalId), [q.key]: fact };
  const profile: GoalProfile = { ...(db.profiles[goalId] ?? { id: goalId, goalId, facts: {}, unresolved: [], createdAt: now }), facts, unresolved: (db.profiles[goalId]?.unresolved ?? []).filter((u) => u !== fact.label), updatedAt: now };
  const ops: BatchOp[] = [
    put("profiles", profile),
    put("messages", msg(goalId, "user", fact.display + (fact.kind === "estimate" ? " (הערכה)" : ""), { answerKey: q.key })),
    ...afterFactsOps(db, goal, { ...conv, skipped: conv.skipped.filter((k) => k !== q.key) }, facts, q.key, acknowledge(q, fact), now),
  ];
  if (q.key === "targetDate") ops.push(put("goals", { ...goal, targetDate: String(norm.value), updatedAt: now }));
  const r = await S().applyBatch(ops);
  return r.ok ? { ok: true } : { ok: false, error: r.error ?? "שמירה נכשלה" };
}

export async function skipPending(goalId: string): Promise<TurnResult> {
  const db = S().db;
  const goal = db.goals[goalId];
  const conv = db.conversations[goalId];
  const q = conv?.pending;
  if (!goal || !conv || !q || !q.skippable) return { ok: false, error: "אי אפשר לדלג על שאלה זו" };
  const now = nowIso();
  const label = questionFor(q.key)?.text ?? q.key;
  const profile = db.profiles[goalId];
  const unresolved = [...new Set([...(profile?.unresolved ?? []), LABELS[q.key] ?? label])];
  const conv2 = { ...conv, skipped: [...new Set([...conv.skipped, q.key])] };
  const ops: BatchOp[] = [
    put("profiles", { ...(profile ?? { id: goalId, goalId, facts: {}, createdAt: now }), unresolved, updatedAt: now }),
    put("messages", msg(goalId, "user", "לא יודע/ת — לדלג", { answerKey: q.key })),
    ...afterFactsOps(db, goal, conv2, factsOf(db, goalId), q.key, "בסדר — אסמן את זה כשאלה פתוחה, והתוכנית תתייחס לזה כהנחה או כמשימת בירור.", now),
  ];
  const r = await S().applyBatch(ops);
  return r.ok ? { ok: true } : { ok: false, error: r.error ?? "שמירה נכשלה" };
}

/** Re-open a previous answer for editing. */
export async function editFact(goalId: string, key: string): Promise<TurnResult> {
  const db = S().db;
  const conv = db.conversations[goalId];
  const q = questionFor(key);
  if (!conv || !q) return { ok: false, error: "לא ניתן לערוך שדה זה" };
  const prev = factsOf(db, goalId)[key];
  const now = nowIso();
  const r = await S().applyBatch([
    put("conversations", { ...conv, pending: q, mode: "basic", updatedAt: now }),
    put("messages", msg(goalId, "assistant", `בוא/י נעדכן: ${q.text}${prev ? `\n(כרגע: ${prev.display})` : ""}`, { question: q })),
  ]);
  return r.ok ? { ok: true } : { ok: false, error: r.error ?? "" };
}

/** Confirm a fact that was recorded as an assumption/estimate. */
export async function confirmFact(goalId: string, key: string) {
  const db = S().db;
  const p = db.profiles[goalId];
  if (!p?.facts[key]) return;
  const now = nowIso();
  await S().put("profiles", { ...p, facts: { ...p.facts, [key]: { ...p.facts[key], kind: "confirmed", source: "user", updatedAt: now } }, updatedAt: now });
}

/** Free text from the composer (basic engine). */
export async function freeText(goalId: string, text: string, today: string): Promise<TurnResult> {
  const db = S().db;
  const conv = db.conversations[goalId];
  if (!conv) return { ok: false, error: "שיחה לא נמצאה" };
  if (conv.pending && conv.pending.key !== BUILD_KEY) return answerPending(goalId, text, { today });
  return reviseIntent(goalId, text, today);
}

const INTENTS: Array<[RegExp, string]> = [
  [/(תאריך|להאריך|לדחות|מוקדם|מאוחר|עד מתי|deadline)/, "targetDate"],
  [/(שעות|זמן בשבוע|פחות זמן|יותר זמן)/, "weeklyHours"],
  [/(ימים|יום ראשון|יום שני|שלישי|רביעי|חמישי|שישי|שבת)/, "preferredDays"],
  [/(בוקר|ערב|צהריים|שעה ביום)/, "preferredTime"],
];

async function reviseIntent(goalId: string, text: string, today: string): Promise<TurnResult> {
  const db = S().db;
  const conv = db.conversations[goalId]!;
  const now = nowIso();
  if (text === "rebuild") return buildDraft(goalId, { today });
  let key: string | null = questionFor(text) ? text : null;
  if (!key) for (const [re, k] of INTENTS) if (re.test(text)) key = k;
  const ops: BatchOp[] = [];
  if (!questionFor(text)) ops.push(put("messages", msg(goalId, "user", text)));
  if (key) {
    const q = questionFor(key)!;
    const prev = factsOf(db, goalId)[key];
    ops.push(put("conversations", { ...conv, pending: q, updatedAt: now }), put("messages", msg(goalId, "assistant", `${q.text}${prev ? `\n(כרגע: ${prev.display})` : ""}`, { question: q })));
  } else {
    ops.push(
      put("conversations", { ...conv, pending: reviseQuestion, updatedAt: now }),
      put("messages", msg(goalId, "assistant", "המנוע הבסיסי יכול לעדכן את התוכנית לפי שינוי בנתונים. מה לשנות? (לשינויים חופשיים יותר — חברו מפתח AI, או ערכו ישירות בעמוד התוכנית.)", { question: reviseQuestion })),
    );
  }
  const r = await S().applyBatch(ops);
  return r.ok ? { ok: true } : { ok: false, error: r.error ?? "" };
}

// ───────── Plan drafts ─────────

export function scheduleOptions(db: DB, goalId: string, today: string) {
  const f = factsOf(db, goalId);
  const hours = typeof f.weeklyHours?.value === "number" ? (f.weeklyHours.value as number) : null;
  return {
    db,
    today,
    goalId,
    weeklyMinutes: hours != null ? Math.round(hours * 60) : null,
    preferredDays: Array.isArray(f.preferredDays?.value) ? (f.preferredDays.value as string[]).map(Number) : [],
    preferredTime: typeof f.preferredTime?.value === "string" && f.preferredTime.value !== "flexible" ? (f.preferredTime.value as string) : null,
  };
}

export function reschedule(db: DB, goalId: string, plan: GoalPlan, today: string): { plan: GoalPlan; report: ScheduleReport } {
  return schedulePlan(plan, scheduleOptions(db, goalId, today));
}

/** Build (or rebuild) the draft plan version from the profile. Uses AI when the conversation is in AI mode. */
export async function buildDraft(goalId: string, opts: { today: string; ai?: { changeRequest: string | null } }): Promise<TurnResult> {
  const db = S().db;
  const goal = db.goals[goalId];
  const conv = db.conversations[goalId];
  if (!goal || !conv) return { ok: false, error: "מטרה לא נמצאה" };
  const facts = factsOf(db, goalId);
  const missing = missingCritical(goal.kind, facts);
  if (missing.length && !opts.ai) {
    const q = nextQuestion(goal.kind, facts, []);
    await S().applyBatch([
      put("conversations", { ...conv, pending: q, updatedAt: nowIso() }),
      put("messages", msg(goalId, "assistant", `לפני שאבנה תוכנית חסר מידע קריטי: ${missing.join(", ")}.${q ? `\n\n${q.text}` : ""}`, { question: q })),
    ]);
    return { ok: true };
  }
  const draft = draftOf(db, goalId);
  const approved = approvedOf(db, goalId);
  let fresh: GoalPlan;
  let fixes: string[] = [];
  if (conv.mode === "ai" || opts.ai) {
    try {
      const { requestGoalPlan } = await import("../ai/client");
      const base = draft?.plan ?? approved?.plan ?? null;
      const completedKeys = base ? base.tasks.filter((t) => db.tasks[`pt:${goalId}:${t.key}`] && !isOpen(db.tasks[`pt:${goalId}:${t.key}`].status)).map((t) => t.key) : [];
      const input: GoalPlanInput = {
        today: opts.today,
        goal: { title: goal.title, kind: goal.kind },
        facts: Object.values(facts).map((f) => ({ key: f.key, label: f.label, display: f.display, kind: f.kind })),
        unresolved: db.profiles[goalId]?.unresolved ?? [],
        currentPlan: opts.ai?.changeRequest ? base : null,
        changeRequest: opts.ai?.changeRequest ?? null,
        completedKeys,
      };
      const r = await requestGoalPlan(input);
      fresh = r.plan;
      fixes = r.fixes;
    } catch (e) {
      return { ok: false, error: e instanceof AIRequestError ? `יצירת התוכנית עם AI נכשלה: ${e.message}` : "יצירת התוכנית נכשלה", retryable: true };
    }
  } else fresh = buildGoalPlan({ kind: goal.kind, title: goal.title, facts, today: opts.today, startDate: goal.startDate });

  const merged = draft ? regenerate(draft.plan, fresh) : fresh;
  const { plan: scheduled, report } = reschedule(db, goalId, merged, opts.today);
  const v = validateGoalPlan(scheduled, { today: opts.today });
  if (!v.ok || !v.plan) return { ok: false, error: `התוכנית לא עברה בדיקת תקינות: ${v.errors.join("; ")}` };
  const now = nowIso();
  const maxV = Math.max(0, ...Object.values(db.planVersions).filter((x) => x.goalId === goalId).map((x) => x.version));
  const version: PlanVersion = draft
    ? { ...draft, plan: v.plan, updatedAt: now }
    : { id: uid(), goalId, version: maxV + 1, status: "draft", plan: v.plan, basedOnVersionId: approved?.id ?? null, approvedAt: null, createdAt: now, updatedAt: now };
  const notes = [
    ...(report.needsAvailability ? ["לא ידועה הזמינות שלך, אז המשימות מוצעות בלי תאריך ביצוע — אפשר להגדיר זמינות בהגדרות או לקבוע תאריכים בעמוד התוכנית."] : []),
    ...(report.overloaded.length ? [`${report.overloaded.length} משימות לא נכנסות בזמן הפנוי — בעמוד התוכנית יוצעו חלופות.`] : []),
    ...fixes.map((f) => `תיקון אוטומטי: ${f}`),
  ];
  const text = `${draft ? "עדכנתי את טיוטת התוכנית" : `הכנתי טיוטת תוכנית (גרסה ${version.version})`}: ${v.plan.milestones.filter((m) => !m.excluded).length} אבני דרך, ${v.plan.tasks.filter((t) => !t.excluded).length} משימות ו-${v.plan.routines.filter((r) => !r.excluded).length} שגרות.${notes.length ? `\n${notes.join("\n")}` : ""}\n\nהיא עדיין טיוטה — אפשר לערוך כל פרט בעמוד התוכנית, ושום דבר לא נכנס ללוח השנה לפני אישור.`;
  const r = await S().applyBatch([
    put("planVersions", version),
    put("conversations", { ...conv, phase: approved ? "revising" : "plan_draft", stage: 8, pending: null, updatedAt: now }),
    put("messages", msg(goalId, "assistant", text, { source: conv.mode === "ai" ? "ai" : "basic" })),
  ]);
  return r.ok ? { ok: true } : { ok: false, error: r.error ?? "שמירה נכשלה" };
}

/** Edit the draft directly (plan page). Validates before saving. */
export async function saveDraftPlan(versionId: string, plan: GoalPlan, today: string): Promise<{ ok: boolean; error?: string }> {
  const db = S().db;
  const v = db.planVersions[versionId];
  if (!v || v.status !== "draft") return { ok: false, error: "אפשר לערוך רק טיוטה" };
  const val = validateGoalPlan(plan, { today });
  if (!val.ok || !val.plan) return { ok: false, error: val.errors.join("; ") };
  const ok = await S().put("planVersions", { ...v, plan: val.plan, updatedAt: nowIso() });
  return { ok };
}

/** Start revising an approved plan: a new draft cloned from the approved snapshot. */
export async function startRevision(goalId: string): Promise<PlanVersion | null> {
  const db = S().db;
  const existing = draftOf(db, goalId);
  if (existing) return existing;
  const approved = approvedOf(db, goalId);
  if (!approved) return null;
  const now = nowIso();
  const maxV = Math.max(0, ...Object.values(db.planVersions).filter((x) => x.goalId === goalId).map((x) => x.version));
  const draft: PlanVersion = { id: uid(), goalId, version: maxV + 1, status: "draft", plan: structuredClone(approved.plan), basedOnVersionId: approved.id, approvedAt: null, createdAt: now, updatedAt: now };
  const conv = db.conversations[goalId];
  const ops: BatchOp[] = [put("planVersions", draft)];
  if (conv) ops.push(put("conversations", { ...conv, phase: "revising", updatedAt: now }));
  return (await S().applyBatch(ops)).ok ? draft : null;
}

export async function discardDraft(versionId: string): Promise<boolean> {
  const db = S().db;
  const v = db.planVersions[versionId];
  if (!v || v.status !== "draft") return false;
  const conv = db.conversations[v.goalId];
  const ops: BatchOp[] = [put("planVersions", { ...v, status: "discarded", updatedAt: nowIso() })];
  if (conv) ops.push(put("conversations", { ...conv, phase: approvedOf(db, v.goalId) ? "active" : "discovery", updatedAt: nowIso() }));
  return (await S().applyBatch(ops)).ok;
}

/** Dry-run of activation for the preview (what will be created/changed/removed). */
export function previewActivation(goalId: string, versionId: string, today: string): ActivationSummary | null {
  const db = S().db;
  const goal = db.goals[goalId];
  const v = db.planVersions[versionId];
  if (!goal || !v) return null;
  return buildActivation({ db, goal, version: v, facts: factsOf(db, goalId), today, now: nowIso() }).summary;
}

/** Validate → snapshot → milestones/tasks/recurrences/reminders, all in one atomic batch. */
export async function approveAndActivate(goalId: string, versionId: string, today: string): Promise<{ ok: true; summary: ActivationSummary } | { ok: false; error: string }> {
  const db = S().db;
  const goal = db.goals[goalId];
  const v = db.planVersions[versionId];
  if (!goal || !v) return { ok: false, error: "התוכנית לא נמצאה" };
  if (v.status !== "draft" && v.status !== "approved") return { ok: false, error: "גרסה זו אינה ניתנת לאישור" };
  const val = validateGoalPlan(v.plan, { today });
  if (!val.ok || !val.plan) return { ok: false, error: `התוכנית לא עברה בדיקת תקינות: ${val.errors.join("; ")}` };
  const { ops, summary } = buildActivation({ db, goal, version: { ...v, plan: val.plan }, facts: factsOf(db, goalId), today, now: nowIso() });
  const conv = db.conversations[goalId];
  if (conv) ops.push(put("messages", msg(goalId, "system", `התוכנית (גרסה ${v.version}) אושרה והופעלה: ${summary.created.length} נוצרו, ${summary.updated.length} עודכנו${summary.removed.length ? `, ${summary.removed.length} הוסרו` : ""}${summary.keptCompleted.length ? `, ${summary.keptCompleted.length} שהושלמו נשמרו` : ""}.`, { source: "app" })));
  const r = await S().applyBatch(ops, { silent: true });
  return r.ok ? { ok: true, summary } : { ok: false, error: r.error ?? "ההפעלה נכשלה" };
}

// ───────── AI turns ─────────

export async function aiTurn(goalId: string, userText: string, today: string, opts: { persistUser?: boolean } = { persistUser: true }): Promise<TurnResult> {
  const db = S().db;
  const goal = db.goals[goalId];
  const conv = db.conversations[goalId];
  if (!goal || !conv) return { ok: false, error: "שיחה לא נמצאה" };
  if (opts.persistUser && userText) {
    const ok = await S().put("messages", msg(goalId, "user", userText));
    if (!ok) return { ok: false, error: "שמירת ההודעה נכשלה" };
  }
  const facts = factsOf(db, goalId);
  const history = Object.values(S().db.messages)
    .filter((m) => m.goalId === goalId && m.role !== "system")
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    .slice(-20)
    .map((m) => ({ role: m.role as "user" | "assistant", text: m.text.slice(0, 4000) }));
  const settings = db.settings.settings;
  const input: GoalTurnInput = {
    today,
    goal: { title: goal.title, kind: goal.kind },
    phase: conv.phase,
    facts: Object.values(facts).map((f) => ({ key: f.key, label: f.label, display: f.display, kind: f.kind })),
    skipped: conv.skipped,
    messages: history,
    userMessage: userText,
    availability: settings ? settings.availability.map((m, i) => `${WEEKDAYS_HE[i]}: ${m == null ? "?" : formatDuration(m) || "0"}`).join(", ") : "לא הוגדר",
  };
  let turn: GoalTurnOutput;
  try {
    const { requestGoalTurn } = await import("../ai/client");
    turn = (await requestGoalTurn(input)).turn;
  } catch (e) {
    return { ok: false, error: e instanceof AIRequestError ? e.message : "שירות ה-AI לא זמין", retryable: true };
  }
  const now = nowIso();
  const nextFacts: Facts = { ...facts };
  for (const u of turn.factUpdates) {
    const value = u.valueType === "number" ? Number(u.value.replace(/[^\d.-]/g, "")) : u.valueType === "list" ? u.value.split(",").map((s) => s.trim()).filter(Boolean) : u.value;
    if (u.valueType === "number" && !Number.isFinite(value as number)) continue;
    nextFacts[u.key] = { key: u.key, label: u.label, value, display: u.display, kind: u.kind, source: u.kind === "confirmed" ? "user" : "ai", updatedAt: now };
  }
  let text = turn.reply;
  if (turn.contradictions.length) text += `\n\nשים/י לב: ${turn.contradictions.join(" ")}`;
  let question: Question | null = turn.question;
  if (turn.separateGoals.length >= 2) {
    question = splitQuestion(turn.separateGoals.map((g) => ({ title: g.title, description: `${g.title}. ${g.description}` })));
    text += `\n\nזיהיתי כמה מטרות שונות. כדאי לתכנן כל אחת בנפרד (הן ישתפו את אותו לוח שנה ואותה מגבלת זמן).`;
  } else if (turn.readyForPlan && !question) question = buildQuestion(draftOf(db, goalId) || approvedOf(db, goalId) ? "עדכון טיוטת התוכנית" : "בניית טיוטת תוכנית");
  else if (question) text += `\n\n${question.text}`;
  const ops: BatchOp[] = [
    put("profiles", { ...(db.profiles[goalId] ?? { id: goalId, goalId, unresolved: [], createdAt: now }), facts: nextFacts, updatedAt: now }),
    put("conversations", { ...conv, pending: question, stage: turn.stage, updatedAt: now }),
    put("messages", msg(goalId, "assistant", text, { question, source: "ai" })),
  ];
  const r = await S().applyBatch(ops);
  return r.ok ? { ok: true } : { ok: false, error: r.error ?? "שמירה נכשלה" };
}

export function splitQuestion(goals: Array<{ title: string; description: string }>): Question {
  return {
    key: SPLIT_KEY, stage: 1, text: "אילו מטרות ליצור בנפרד?", help: "כל מטרה תקבל שיחה ותוכנית משלה", input: "multi",
    options: goals.map((g) => ({ value: g.description, label: g.title })), allowCustom: false, unit: "", critical: false, skippable: true,
  };
}

/** User chose which separate goals to create from a combined description. */
export async function handleSplit(goalId: string, selected: string[], today: string): Promise<TurnResult & { goalIds?: string[] }> {
  const db = S().db;
  const conv = db.conversations[goalId];
  if (!conv) return { ok: false, error: "שיחה לא נמצאה" };
  const res = await createGoals(selected, { today, mode: conv.mode });
  if ("error" in res) return { ok: false, error: res.error };
  const now = nowIso();
  const titles = res.goalIds.map((id) => S().db.goals[id]?.title).filter(Boolean);
  await S().applyBatch([
    put("conversations", { ...conv, pending: null, updatedAt: now }),
    put("messages", msg(goalId, "system", `נוצרו ${titles.length} מטרות נפרדות: ${titles.join(" · ")}. כל אחת עם שיחת תכנון משלה.`, { source: "app" })),
  ]);
  return { ok: true, goalIds: res.goalIds };
}

export function currentStage(db: DB, goalId: string): number {
  const goal = db.goals[goalId];
  const conv = db.conversations[goalId];
  if (!goal || !conv) return 1;
  if (conv.phase !== "discovery") return 8;
  if (conv.mode === "ai") return conv.stage;
  return progressStage(goal.kind, factsOf(db, goalId), conv.skipped);
}

export { KIND_LABEL };

/** Continue the conversation with the built-in engine (e.g. when AI is unavailable). Nothing is lost. */
export async function switchToBasic(goalId: string): Promise<boolean> {
  const db = S().db;
  const goal = db.goals[goalId];
  const conv = db.conversations[goalId];
  if (!goal || !conv) return false;
  const facts = factsOf(db, goalId);
  const q = conv.phase === "discovery" ? nextQuestion(goal.kind, facts, conv.skipped) : null;
  const now = nowIso();
  const question = q ?? (conv.phase === "discovery" ? buildQuestion("בניית טיוטת תוכנית") : null);
  return (
    await S().applyBatch([
      put("conversations", { ...conv, mode: "basic", pending: question, updatedAt: now }),
      put("messages", msg(goalId, "assistant", `ממשיכים עם מנוע התכנון הבסיסי. כל התשובות נשמרו.${q ? `\n\n${q.text}` : ""}`, { question })),
    ])
  ).ok;
}

export async function switchToAI(goalId: string): Promise<boolean> {
  const conv = S().db.conversations[goalId];
  if (!conv) return false;
  return S().put("conversations", { ...conv, mode: "ai", pending: null, updatedAt: nowIso() });
}
