/**
 * Reward allocation with anti-exploit rules. Pure and deterministic: the server runs exactly this
 * code to write the XP ledger in cloud mode, so XP values sent by a client are never used.
 *
 * Rules (none of them punish missed tasks — they only stop farming):
 * - Duplicates: near-identical tasks for the same goal on the same day are rewarded once.
 * - Repeats: the same activity several times in one day → 100% / 50% / 25% / 0%.
 *   (Across days it's always full: getting experienced never lowers the reward.)
 * - Parent/child: a parent and all its sub-tasks share one budget = 120% of the parent's XP,
 *   so splitting a task into many pieces can't multiply its reward.
 * - Splitting without a parent: after 12 small (level 1–2) rewarded tasks in a day, further small
 *   ones give half; after 24, nothing.
 * - Milestones are evaluated separately (tiers) and unlock rewards once per milestone.
 */
import type { DB, Milestone, Task } from "../types";
import { effectiveEvaluation, findDuplicate, similarity, EVALUATION_VERSION } from "./difficulty";
import { isVerified, milestoneLocked } from "./engine";
import { REGION_BY_ID, regionOfGoal } from "./regions";

export const REPEAT_MULTIPLIERS = [1, 0.5, 0.25, 0];
export const PARENT_BUDGET = 1.2;
export const SMALL_DAILY_FULL = 12;
export const SMALL_DAILY_HALF = 24;

export interface TaskReward {
  /** Ledger id: task:<id> or occ:<occurrenceId>. */
  id: string;
  task: Task;
  refId: string;
  at: string;
  base: number;
  amount: number;
  level: number;
  detail: string;
}

interface Done {
  id: string;
  task: Task;
  refId: string;
  at: string;
  day: string;
  instanceKey: string;
}

function completedInstances(db: DB): Done[] {
  const out: Done[] = [];
  for (const t of Object.values(db.tasks)) {
    if (t.recurrence || t.status !== "completed" || !isVerified(db, t, t.id)) continue;
    const at = t.completedAt ?? t.updatedAt;
    out.push({ id: `task:${t.id}`, task: t, refId: t.id, at, day: at.slice(0, 10), instanceKey: t.id });
  }
  for (const o of Object.values(db.occurrences)) {
    const t = db.tasks[o.taskId];
    if (!t || o.status !== "completed" || !isVerified(db, t, o.id)) continue;
    const at = o.completedAt ?? o.updatedAt;
    out.push({ id: `occ:${o.id}`, task: { ...t, title: o.title ?? t.title }, refId: o.id, at, day: at.slice(0, 10), instanceKey: o.id });
  }
  return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1));
}

function dupRoot(db: DB, task: Task): string {
  let cur = task;
  for (let i = 0; i < 10; i++) {
    const d = findDuplicate(db, cur);
    if (!d) break;
    cur = d;
  }
  return cur.id;
}

/** XP for every completed & verified task instance, after the anti-exploit rules. */
export function taskRewards(db: DB): TaskReward[] {
  const out: TaskReward[] = [];
  const dupSeen = new Map<string, string>(); // root+day → title of the rewarded one
  const repeats = new Map<string, number>(); // repeatKey+day → count
  const smallPerDay = new Map<string, number>();
  const budget = new Map<string, number>(); // family root id → remaining
  for (const d of completedInstances(db)) {
    const { ev } = effectiveEvaluation(db, d.task);
    const parts = [`רמה ${ev.difficulty}`];
    let amount = ev.xp;
    // duplicates (same day, same goal, near-identical)
    if (!d.task.recurrence) {
      const root = dupRoot(db, d.task);
      const k = `${root}|${d.day}`;
      if (dupSeen.has(k)) {
        amount = 0;
        parts.push(`כפילות של „${dupSeen.get(k)}”`);
      } else dupSeen.set(k, d.task.title);
    }
    // repeats within a day
    if (amount > 0) {
      const rk = `${ev.repeatKey}|${d.day}`;
      const n = repeats.get(rk) ?? 0;
      repeats.set(rk, n + 1);
      const m = REPEAT_MULTIPLIERS[Math.min(n, REPEAT_MULTIPLIERS.length - 1)];
      if (m < 1) {
        amount = Math.round(amount * m);
        parts.push(`חזרה ${n + 1} היום (${Math.round(m * 100)}%)`);
      }
    }
    // parent / sub-task shared budget
    const parentId = d.task.parentTaskId && db.tasks[d.task.parentTaskId] ? d.task.parentTaskId : null;
    const hasChildren = Object.values(db.tasks).some((t) => t.parentTaskId === d.task.id);
    const family = parentId ?? (hasChildren ? d.task.id : null);
    if (family && amount > 0) {
      if (!budget.has(family)) budget.set(family, Math.round(effectiveEvaluation(db, db.tasks[family]).ev.xp * PARENT_BUDGET));
      const left = budget.get(family)!;
      if (amount > left) {
        amount = left;
        parts.push(parentId ? "תקציב משימת האב מוצה" : "חלק מה-XP כבר ניתן לתתי־המשימות");
      }
      budget.set(family, left - amount);
    }
    // splitting into many tiny tasks
    if (amount > 0 && ev.difficulty <= 2) {
      const n = (smallPerDay.get(d.day) ?? 0) + 1;
      smallPerDay.set(d.day, n);
      if (n > SMALL_DAILY_HALF) {
        amount = 0;
        parts.push("מעבר למכסת המשימות הקטנות היומית");
      } else if (n > SMALL_DAILY_FULL) {
        amount = Math.round(amount / 2);
        parts.push("הרבה משימות קטנות היום (50%)");
      }
    }
    out.push({ id: d.id, task: d.task, refId: d.refId, at: d.at, base: ev.xp, amount, level: ev.difficulty, detail: parts.join(" · ") });
  }
  return out;
}

// ───────── Milestones & goals (evaluated separately) ─────────

export type MilestoneTier = "minor" | "rare" | "epic" | "epic_plus";
export const MILESTONE_XP: Record<MilestoneTier, number> = { minor: 50, rare: 100, epic: 150, epic_plus: 200 };
export const GOAL_XP = 250;
export const GOAL_XP_TRIVIAL = 50;
const TIER_LABEL: Record<MilestoneTier, string> = { minor: "אבן דרך קטנה", rare: "אבן דרך משמעותית", epic: "אבן דרך גדולה", epic_plus: "אבן דרך מרכזית" };

export interface Unlock {
  id: string;
  refId: string;
  title: string;
  kind: "hero" | "ability" | "area" | "story";
  rarity?: "rare" | "epic" | "legendary";
}

export interface MilestoneEval {
  tier: MilestoneTier;
  xp: number;
  /** Sum of the (anti-exploit adjusted) XP of the milestone's completed tasks. */
  workXp: number;
  tasks: number;
  unlocks: Unlock[];
  reason: string;
  eligible: boolean;
}

export function milestoneEvaluation(db: DB, m: Milestone, rewards?: TaskReward[]): MilestoneEval {
  const rs = rewards ?? taskRewards(db);
  const tasks = Object.values(db.tasks).filter((t) => t.milestoneId === m.id && !t.recurrence && t.status !== "skipped");
  const workXp = rs.filter((r) => r.task.milestoneId === m.id && !r.task.recurrence).reduce((s, r) => s + r.amount, 0);
  const goal = db.goals[m.goalId];
  const region = goal ? regionOfGoal(goal) : "mind";
  const regionName = REGION_BY_ID[region].name;
  const tier: MilestoneTier = workXp >= 450 ? "epic_plus" : workXp >= 200 ? "epic" : workXp >= 60 ? "rare" : "minor";
  const unlocks: Unlock[] = [];
  if (tier !== "minor") {
    const rarity = tier === "rare" ? "rare" : "epic";
    unlocks.push({ id: `unlock:ms:${m.id}:hero`, refId: `hero:${region}:${rarity}`, title: `גיבור ${rarity === "rare" ? "נדיר" : "אפי"} — ${regionName}`, kind: "hero", rarity });
  }
  if (tier === "epic" || tier === "epic_plus") unlocks.push({ id: `unlock:ms:${m.id}:ability`, refId: `ability:${region}`, title: `יכולת מיוחדת — ${regionName}`, kind: "ability" });
  if (tier === "epic_plus") unlocks.push({ id: `unlock:ms:${m.id}:area`, refId: `area:${region}:${m.id}`, title: `אזור חדש ב${regionName}`, kind: "area" });
  // the same achievement can't be rewarded twice: an earlier done milestone of the same goal with
  // (almost) the same title takes the reward
  const twin = Object.values(db.milestones).find((x) => x.id !== m.id && x.goalId === m.goalId && x.status === "done" && (x.updatedAt < m.updatedAt || (x.updatedAt === m.updatedAt && x.id < m.id)) && similarity(x.title, m.title) >= 0.8);
  const locked = milestoneLocked(db, m);
  const eligible = m.status === "done" && !locked && !twin;
  const reason = twin ? `זהה לאבן הדרך „${twin.title}” שכבר תוגמלה` : locked ? "אבן הדרך הקודמת עוד לא הושלמה" : `${TIER_LABEL[tier]}: ${tasks.length} משימות, ${workXp} XP של עבודה`;
  return { tier, xp: eligible ? MILESTONE_XP[tier] : 0, workXp, tasks: tasks.length, unlocks: eligible ? unlocks : [], reason, eligible };
}

export interface GoalEval {
  xp: number;
  unlocks: Unlock[];
  reason: string;
  eligible: boolean;
}
/** A completed goal is "major" only when real work stands behind it (a completed milestone or ≥5 rewarded tasks). */
export function goalEvaluation(db: DB, goalId: string, rewards?: TaskReward[]): GoalEval {
  const g = db.goals[goalId];
  if (!g || g.status !== "done") return { xp: 0, unlocks: [], reason: "", eligible: false };
  const rs = rewards ?? taskRewards(db);
  const msDone = Object.values(db.milestones).filter((m) => m.goalId === goalId && m.status === "done").length;
  const tasksDone = rs.filter((r) => r.task.goalId === goalId && r.amount > 0).length;
  const major = msDone >= 1 || tasksDone >= 5;
  const region = regionOfGoal(g);
  const name = REGION_BY_ID[region].name;
  const unlocks: Unlock[] = major
    ? [
        { id: `unlock:goal:${goalId}:hero`, refId: `hero:${region}:legendary`, title: `גיבור אגדי — ${name}`, kind: "hero", rarity: "legendary" },
        { id: `unlock:goal:${goalId}:area`, refId: `area:${region}:${goalId}`, title: `אזור חדש ב${name}`, kind: "area" },
        { id: `unlock:goal:${goalId}:story`, refId: `story:${goalId}`, title: `פרק בסיפור: ${g.title}`, kind: "story" },
      ]
    : [];
  return { xp: major ? GOAL_XP : GOAL_XP_TRIVIAL, unlocks, reason: major ? `${msDone} אבני דרך, ${tasksDone} משימות` : "מטרה בלי אבני דרך או עבודה מתועדת — XP בסיסי בלבד", eligible: true };
}

/** For UI: what this task is worth if completed now (no same-day context). */
export function previewXp(db: DB, task: Task): { xp: number; level: number; stale: boolean; source: "ai" | "rules" } {
  const { ev, stale } = effectiveEvaluation(db, task);
  return { xp: ev.xp, level: ev.difficulty, stale, source: ev.source };
}

export { EVALUATION_VERSION };
