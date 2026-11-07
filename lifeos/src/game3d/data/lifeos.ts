/**
 * Read-only view of LifeOS data for the game layer.
 *
 * Shapes mirror lifeos/src/lib/types.ts (subset) and the six existing regions. The game NEVER writes
 * tasks/goals and never computes Life XP: `lifeXp`/`level` come from the LifeOS server ledger.
 * Phase 1 uses MockLifeOSAdapter only; a real adapter is added after prototype approval.
 */
export const DOMAINS = ["wealth", "health", "knowledge", "career", "social", "mind"] as const;
export type Domain = (typeof DOMAINS)[number];

export interface ProfileView {
  displayName: string;
  /** Life XP from the LifeOS ledger (server-authoritative). */
  lifeXp: number;
  level: number;
  levelFloorXp: number;
  nextLevelXp: number;
}

export interface GoalView {
  id: string;
  title: string;
  region: Domain;
  status: "planning" | "active" | "paused" | "done";
  targetDate: string;
  /** 0..1 as computed by LifeOS */
  progress: number;
}

export interface TaskView {
  id: string;
  title: string;
  goalId: string | null;
  region: Domain | null;
  date: string | null;
  status: "planned" | "done" | "skipped";
}

export interface MilestoneView {
  id: string;
  goalId: string;
  title: string;
  region: Domain;
  done: boolean;
  /** world feature this milestone unlocks (visual only) */
  unlocks: string;
}

/** Game-only progress. Never converted into Life XP. */
export interface WorldProgressView {
  points: number;
  discoveries: string[];
  unlockedBuildings: string[];
  /** 0..1 */
  cityConstruction: number;
  achievements: { id: string; title: string; at: string }[];
}

export interface LifeOSSnapshot {
  profile: ProfileView;
  goals: GoalView[];
  tasks: TaskView[];
  milestones: MilestoneView[];
  domainProgress: Record<Domain, number>;
  world: WorldProgressView;
  source: "mock" | "lifeos";
}

export interface LifeOSReadAdapter {
  readonly kind: "mock" | "lifeos";
  load(): Promise<LifeOSSnapshot>;
}

/** Domain progress = mean progress of that domain's active goals. */
export function domainProgress(goals: GoalView[]): Record<Domain, number> {
  const out = Object.fromEntries(DOMAINS.map((d) => [d, 0])) as Record<Domain, number>;
  for (const d of DOMAINS) {
    const gs = goals.filter((g) => g.region === d && (g.status === "active" || g.status === "done"));
    out[d] = gs.length ? gs.reduce((s, g) => s + (g.status === "done" ? 1 : g.progress), 0) / gs.length : 0;
  }
  return out;
}
export const overallProgress = (p: Record<Domain, number>) => DOMAINS.reduce((s, d) => s + p[d], 0) / DOMAINS.length;

/** Next important goal: nearest target date among active goals that aren't complete. */
export function nextGoal(goals: GoalView[]): GoalView | null {
  return [...goals].filter((g) => g.status === "active" && g.progress < 1).sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0] ?? null;
}
