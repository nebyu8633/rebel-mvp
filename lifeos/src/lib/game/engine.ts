/**
 * Game engine — pure functions that derive the whole game state from REAL data.
 *
 * XP is never stored as a free-floating counter. Instead `computeEarned` lists every reward
 * the user has earned (verified task, milestone, habit, achievement…) with a DETERMINISTIC id,
 * and `reconcile` turns that into ledger writes: new ids are added once, nothing is ever
 * awarded twice, and un-completing a task revokes its XP. Opening the app earns nothing.
 */
import type { DB, Evidence, GameProfile, Goal, Milestone, RegionId, Task, XpEvent } from "../types";
import { REGION_IDS } from "../types";
import { ATTRIBUTES, REGION_BY_ID, REGIONS, STAGE_THRESHOLDS, regionOfGoal, type Attribute } from "./regions";
import { VERIFIED } from "./evidence";
import { addDays, diffDays, startOfWeek } from "../dates";
import { instancesInRange, isOpen } from "../tasks";

export type EarnedEvent = Omit<XpEvent, "createdAt" | "updatedAt">;

export const DEFAULT_XP = { small: 10, medium: 25, major: 50, milestone: 100, goal: 250 };
const HABIT_XP = 5;
const ACHIEVEMENT_XP = 50;
const CHEST_XP = 20;

export function defaultProfile(today: string, now: string): GameProfile {
  return {
    id: "profile",
    displayName: "",
    avatar: { skin: 2, outfit: 0, accent: 0, emblem: 0 },
    xp: { ...DEFAULT_XP },
    seasonStart: today,
    lastIntroDate: null,
    chestsOpened: [],
    notify: {
      sound: "chime",
      quietStart: null,
      quietEnd: null,
      prepMinutes: 15,
      followUpMinutes: 15,
      prepAndFollowUp: true,
      categories: { standard: true, high: true, repeat: true, challenge: true, achievement: true, milestone: true },
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function profileOf(db: DB): GameProfile | null {
  return db.gameProfile?.profile ?? null;
}

// ───────── Tasks, regions, verification ─────────

export function taskRegion(db: DB, task: Task): RegionId | null {
  const goal = task.goalId ? db.goals[task.goalId] : null;
  if (goal) return regionOfGoal(goal);
  if (task.routine === "grocery" || task.routine === "meal_prep") return "health";
  if (task.routine === "weekly_review") return "mind";
  return null;
}

export function attributeOf(region: RegionId | null): Attribute {
  return region ? REGION_BY_ID[region].attribute : "discipline";
}

export function taskSize(task: Task): "small" | "medium" | "major" {
  if (task.xpSize !== "auto") return task.xpSize;
  const m = task.estimatedMinutes ?? 0;
  if (task.priority === "high" || m > 60) return "major";
  if (m > 20) return "medium";
  return "small";
}

export function taskXp(task: Task, profile: GameProfile | null): number {
  const x = profile?.xp ?? DEFAULT_XP;
  return x[taskSize(task)];
}

export function latestEvidence(db: DB, instanceKey: string): Evidence | null {
  let best: Evidence | null = null;
  for (const e of Object.values(db.evidence ?? {})) if (e.instanceKey === instanceKey && (!best || e.updatedAt > best.updatedAt)) best = e;
  return best;
}

/** A completed task counts only if it needs no proof, or its proof was accepted / confirmed. */
export function isVerified(db: DB, task: Task, instanceKey: string): boolean {
  if (task.evidence === "none") return true;
  const e = latestEvidence(db, instanceKey);
  return !!e && VERIFIED.has(e.status);
}

// ───────── Quests (goals → milestones → tasks) ─────────

export type QuestState = "locked" | "available" | "active" | "pending" | "completed";

export interface MilestoneQuest {
  milestone: Milestone;
  state: QuestState;
  tasks: Task[];
  done: number;
  total: number;
}

export interface Quest {
  goal: Goal;
  region: RegionId;
  state: QuestState;
  milestones: MilestoneQuest[];
  progress: number; // 0..1 milestone/task completion (not goal achievement)
}

function orderedMilestones(db: DB, goalId: string) {
  return Object.values(db.milestones)
    .filter((m) => m.goalId === goalId)
    .sort((a, b) => a.order - b.order || ((a.targetDate ?? "9") < (b.targetDate ?? "9") ? -1 : 1));
}

export function questFor(db: DB, goal: Goal): Quest {
  const ms = orderedMilestones(db, goal.id);
  let prevDone = true;
  const milestones: MilestoneQuest[] = ms.map((m) => {
    const tasks = Object.values(db.tasks).filter((t) => t.milestoneId === m.id && !t.recurrence);
    const done = tasks.filter((t) => t.status === "completed" && isVerified(db, t, t.id)).length;
    const pending = tasks.some((t) => {
      const e = latestEvidence(db, t.id);
      return e && (e.status === "submitted" || e.status === "review");
    });
    let state: QuestState;
    if (m.status === "done") state = "completed";
    else if (!prevDone) state = "locked";
    else if (pending) state = "pending";
    else if (m.status === "active" || tasks.some((t) => t.status === "completed" || t.status === "in_progress")) state = "active";
    else state = "available";
    prevDone = m.status === "done";
    return { milestone: m, state, tasks, done, total: tasks.length };
  });
  const all = milestones.flatMap((m) => m.tasks);
  const doneTasks = milestones.reduce((s, m) => s + m.done, 0);
  const progress = milestones.length ? milestones.filter((m) => m.state === "completed").length / milestones.length : all.length ? doneTasks / all.length : 0;
  const state: QuestState =
    goal.status === "done"
      ? "completed"
      : milestones.some((m) => m.state === "pending")
        ? "pending"
        : milestones.some((m) => m.state === "active" || m.state === "completed")
          ? "active"
          : "available";
  return { goal, region: regionOfGoal(goal), state, milestones, progress };
}

export function quests(db: DB): Quest[] {
  return Object.values(db.goals)
    .sort((a, b) => a.order - b.order)
    .map((g) => questFor(db, g));
}

/**
 * Milestone status sync: a milestone completes when all its tasks are done & verified AND
 * every earlier milestone is done (a locked milestone can't complete). Reopening a task
 * reopens its milestone. Milestones without tasks are left to the user.
 */
export function milestoneSync(db: DB, now: string): Milestone[] {
  const out: Milestone[] = [];
  for (const goal of Object.values(db.goals)) {
    let prevDone = true;
    for (const m of orderedMilestones(db, goal.id)) {
      const tasks = Object.values(db.tasks).filter((t) => t.milestoneId === m.id && !t.recurrence);
      if (tasks.length) {
        const allDone = tasks.every((t) => (t.status === "completed" && isVerified(db, t, t.id)) || t.status === "skipped") && tasks.some((t) => t.status === "completed");
        if (allDone && prevDone && m.status !== "done") out.push({ ...m, status: "done", updatedAt: now });
        else if (!allDone && m.status === "done") out.push({ ...m, status: "active", updatedAt: now });
      }
      prevDone = (out.find((x) => x.id === m.id)?.status ?? m.status) === "done";
    }
  }
  return out;
}

// ───────── Earned rewards ─────────

export function computeEarned(db: DB, profile: GameProfile | null, today: string): EarnedEvent[] {
  const x = profile?.xp ?? DEFAULT_XP;
  const out: EarnedEvent[] = [];
  for (const t of Object.values(db.tasks)) {
    if (t.recurrence || t.status !== "completed" || !isVerified(db, t, t.id)) continue;
    const region = taskRegion(db, t);
    out.push({ id: `task:${t.id}`, kind: "task", refId: t.id, title: t.title, amount: taskXp(t, profile), region, attribute: attributeOf(region), at: t.completedAt ?? t.updatedAt });
  }
  for (const o of Object.values(db.occurrences)) {
    const t = db.tasks[o.taskId];
    if (!t || o.status !== "completed" || !isVerified(db, t, o.id)) continue;
    const region = taskRegion(db, t);
    out.push({ id: `occ:${o.id}`, kind: "occurrence", refId: o.id, title: o.title ?? t.title, amount: taskXp(t, profile), region, attribute: region ? attributeOf(region) : "discipline", at: o.completedAt ?? o.updatedAt });
  }
  for (const m of Object.values(db.milestones)) {
    if (m.status !== "done") continue;
    const g = db.goals[m.goalId];
    const region = g ? regionOfGoal(g) : null;
    out.push({ id: `ms:${m.id}`, kind: "milestone", refId: m.id, title: m.title, amount: x.milestone, region, attribute: attributeOf(region), at: m.updatedAt });
  }
  for (const g of Object.values(db.goals)) {
    if (g.status !== "done") continue;
    const region = regionOfGoal(g);
    out.push({ id: `goal:${g.id}`, kind: "goal", refId: g.id, title: g.title, amount: x.goal, region, attribute: attributeOf(region), at: g.updatedAt });
  }
  for (const l of Object.values(db.habitLogs)) {
    if (l.status !== "done") continue;
    const h = db.habits[l.habitId];
    if (!h) continue;
    const g = h.goalId ? db.goals[h.goalId] : null;
    const region = g ? regionOfGoal(g) : "mind";
    out.push({ id: `habit:${l.id}`, kind: "habit", refId: l.id, title: h.title, amount: HABIT_XP, region, attribute: "discipline", at: l.updatedAt });
  }
  for (const msId of profile?.chestsOpened ?? []) {
    const m = db.milestones[msId];
    if (!m || m.status !== "done") continue;
    out.push({ id: `chest:${msId}`, kind: "chest", refId: msId, title: `תיבת אוצר: ${m.title}`, amount: CHEST_XP, region: null, attribute: "discipline", at: m.updatedAt });
  }
  // achievements derive from the above (never from opening the app)
  for (const a of achievementsEarned(db, out, today)) out.push(a);
  return out;
}

// ───────── Achievements ─────────

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  decoration?: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-quest", title: "המסע הראשון", description: "השלמת משימה מאומתת ראשונה", icon: "🗝️", decoration: "lantern" },
  { id: "seven-days", title: "שבעה ימי התקדמות", description: "התקדמות ב-7 ימים שונים", icon: "📅", decoration: "banner" },
  { id: "three-milestones", title: "שלוש אבני דרך", description: "השלמת 3 אבני דרך", icon: "🏔️", decoration: "statue" },
  { id: "explorer", title: "חוקר", description: "התקדמות ב-3 אזורים שונים", icon: "🧭", decoration: "compass" },
  { id: "consistency", title: "אמן העקביות", description: "התקדמות ב-4 שבועות רצופים", icon: "🔥", decoration: "beacon" },
  { id: "goal-achiever", title: "משיג המטרות", description: "השגת מטרה שלמה", icon: "🏆", decoration: "fountain" },
  { id: "world-builder", title: "בונה העולמות", description: "ציון דרך שלישי בשלושה אזורים", icon: "🏰", decoration: "citadel" },
];

function achievementsEarned(db: DB, base: EarnedEvent[], today: string): EarnedEvent[] {
  // sticky: once unlocked (stored in the ledger) an achievement stays
  const have = new Set(Object.keys(db.xpEvents ?? {}).filter((k) => k.startsWith("ach:")));
  const progress = base.filter((e) => e.kind === "task" || e.kind === "occurrence" || e.kind === "milestone" || e.kind === "habit");
  const sorted = progress.slice().sort((a, b) => (a.at < b.at ? -1 : 1));
  const days = [...new Set(sorted.map((e) => e.at.slice(0, 10)))];
  const regionsTouched = new Set(sorted.map((e) => e.region).filter(Boolean));
  const milestones = base.filter((e) => e.kind === "milestone").sort((a, b) => (a.at < b.at ? -1 : 1));
  const goals = base.filter((e) => e.kind === "goal").sort((a, b) => (a.at < b.at ? -1 : 1));
  const regionXp = regionXpOf(base);
  const thirdStageRegions = REGION_IDS.filter((r) => (regionXp[r] ?? 0) >= STAGE_THRESHOLDS[2]).length;
  const weeks = new Set(days.map((d) => startOfWeek(d)));
  let streak = 0;
  for (let w = startOfWeek(today), i = 0; i < 60; i++, w = addDays(w, -7)) {
    if (weeks.has(w)) streak++;
    else if (i > 0) break;
  }
  const unlocked: Array<[string, string | undefined]> = [
    ["first-quest", sorted[0]?.at],
    ["seven-days", days.length >= 7 ? days[6] + "T12:00:00.000Z" : undefined],
    ["three-milestones", milestones[2]?.at],
    ["explorer", regionsTouched.size >= 3 ? sorted[sorted.length - 1]?.at : undefined],
    ["consistency", streak >= 4 ? sorted[sorted.length - 1]?.at : undefined],
    ["goal-achiever", goals[0]?.at],
    ["world-builder", thirdStageRegions >= 3 ? sorted[sorted.length - 1]?.at : undefined],
  ];
  const out: EarnedEvent[] = [];
  for (const [id, at] of unlocked) {
    const key = `ach:${id}`;
    if (!at && !have.has(key)) continue;
    const def = ACHIEVEMENTS.find((a) => a.id === id)!;
    const stored = db.xpEvents?.[key];
    out.push({ id: key, kind: "achievement", refId: id, title: def.title, amount: ACHIEVEMENT_XP, region: null, attribute: "discipline", at: stored?.at ?? at! });
  }
  return out;
}

// ───────── Levels, regions, attributes ─────────

export function levelInfo(totalXp: number) {
  let level = 1;
  let floor = 0;
  let need = 100;
  while (totalXp >= floor + need && level < 200) {
    floor += need;
    level++;
    need = Math.round(100 * Math.pow(level, 1.35));
  }
  return { level, xp: totalXp, into: totalXp - floor, need, fraction: (totalXp - floor) / need };
}

function regionXpOf(events: Array<Pick<XpEvent, "region" | "amount">>): Partial<Record<RegionId, number>> {
  const r: Partial<Record<RegionId, number>> = {};
  for (const e of events) if (e.region) r[e.region] = (r[e.region] ?? 0) + e.amount;
  return r;
}

export interface RegionState {
  id: RegionId;
  xp: number;
  stage: number; // 0..5 landmarks built
  next: number | null; // XP needed for the next landmark
  fraction: number; // progress to next landmark
  unlocks: Array<{ stage: number; event: XpEvent | null }>; // which real achievement crossed each threshold
}

export function regionStates(ledger: XpEvent[]): Record<RegionId, RegionState> {
  const out = {} as Record<RegionId, RegionState>;
  for (const r of REGIONS) {
    const evs = ledger.filter((e) => e.region === r.id).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1));
    let sum = 0;
    const unlocks: RegionState["unlocks"] = [];
    let t = 0;
    for (const e of evs) {
      sum += e.amount;
      while (t < STAGE_THRESHOLDS.length && sum >= STAGE_THRESHOLDS[t]) {
        unlocks.push({ stage: t + 1, event: e });
        t++;
      }
    }
    const stage = unlocks.length;
    const prev = stage ? STAGE_THRESHOLDS[stage - 1] : 0;
    const next = stage < STAGE_THRESHOLDS.length ? STAGE_THRESHOLDS[stage] : null;
    out[r.id] = { id: r.id, xp: sum, stage, next, fraction: next ? (sum - prev) / (next - prev) : 1, unlocks };
  }
  return out;
}

export function attributes(ledger: XpEvent[]) {
  return ATTRIBUTES.map((a) => {
    const xp = ledger.filter((e) => e.attribute === a.id).reduce((s, e) => s + e.amount, 0);
    const lvl = levelInfo(xp * 2); // attributes level faster than the overall level
    return { ...a, xp, level: lvl.level, fraction: lvl.fraction };
  });
}

// ───────── Reconcile ─────────

export interface ReconcileResult {
  put: XpEvent[];
  remove: string[];
  /** Newly earned items (for celebrations / notifications). */
  gained: XpEvent[];
}

const STICKY = new Set<XpEvent["kind"]>(["achievement", "challenge", "chest"]);

export function reconcile(db: DB, earned: EarnedEvent[], now: string): ReconcileResult {
  const existing = db.xpEvents ?? {};
  const put: XpEvent[] = [];
  const gained: XpEvent[] = [];
  const seen = new Set<string>();
  for (const e of earned) {
    seen.add(e.id);
    const prev = existing[e.id];
    if (!prev) {
      const ev: XpEvent = { ...e, at: e.at || now, createdAt: now, updatedAt: now };
      put.push(ev);
      gained.push(ev);
    } else if (prev.amount !== e.amount || prev.title !== e.title || prev.region !== e.region) {
      put.push({ ...prev, amount: e.amount, title: e.title, region: e.region, attribute: e.attribute, updatedAt: now });
    }
  }
  const remove = Object.values(existing)
    .filter((e) => !seen.has(e.id) && !STICKY.has(e.kind))
    .map((e) => e.id);
  return { put, remove, gained };
}

export function totalXp(db: DB): number {
  return Object.values(db.xpEvents ?? {}).reduce((s, e) => s + e.amount, 0);
}

// ───────── Seasons ─────────

export const SEASON_THEMES = ["עונת היסודות", "עונת הצמיחה", "עונת המיקוד", "עונת השיא"];

export function seasonOf(profile: GameProfile | null, today: string) {
  const start0 = profile?.seasonStart ?? today;
  const idx = Math.max(0, Math.floor(diffDays(start0, today) / 90));
  const start = addDays(start0, idx * 90);
  const end = addDays(start, 89);
  return { index: idx + 1, theme: SEASON_THEMES[idx % SEASON_THEMES.length], start, end, day: diffDays(start, today) + 1, fraction: (diffDays(start, today) + 1) / 90 };
}

export function seasonSummary(db: DB, start: string, end: string) {
  const evs = Object.values(db.xpEvents ?? {}).filter((e) => e.at.slice(0, 10) >= start && e.at.slice(0, 10) <= end);
  const byRegion = regionXpOf(evs);
  return {
    xp: evs.reduce((s, e) => s + e.amount, 0),
    goals: evs.filter((e) => e.kind === "goal"),
    milestones: evs.filter((e) => e.kind === "milestone"),
    achievements: evs.filter((e) => e.kind === "achievement"),
    tasks: evs.filter((e) => e.kind === "task" || e.kind === "occurrence").length,
    byRegion,
    needsAttention: REGIONS.filter((r) => Object.values(db.goals).some((g) => g.status !== "done" && regionOfGoal(g) === r.id) && !(byRegion[r.id] ?? 0)).map((r) => r.id),
  };
}

// ───────── Daily main quest ─────────

/** The single most important open task today (or overdue), for the daily mission / START QUEST. */
export function mainQuestInstance(db: DB, today: string) {
  const list = [...instancesInRange(db, addDays(today, -7), today, today)].filter((i) => isOpen(i.status));
  const score = (i: (typeof list)[number]) =>
    (i.task.priority === "high" ? 30 : i.task.priority === "medium" ? 20 : 10) + (i.task.goalId ? 8 : 0) + (i.date! < today ? 5 : 0) - (i.task.routine ? 3 : 0);
  return list.sort((a, b) => score(b) - score(a))[0] ?? null;
}
