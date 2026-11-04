/**
 * Read-only bridge: the existing LifeOS store (db) -> the 3D city's LifeOSSnapshot.
 * Uses only data the app already shows (goals, milestones, tasks, the XP ledger via splitProgress).
 * Writes nothing, computes no new XP. Life XP = LifeOS-origin ledger events only; World Progress
 * = game-origin events (same split as /play).
 */
import type { DB } from "@/lib/types";
import { goalProgress } from "@/lib/goals";
import { levelInfo } from "@/lib/game/engine";
import { regionOfGoal } from "@/lib/game/regions";
import { splitProgress, WORLD_KINDS } from "@/game-core/progression/split";
import { domainProgress, type GoalView, type LifeOSSnapshot, type MilestoneView, type TaskView } from "@/game3d/data/lifeos";
import { DISTRICTS } from "@/game3d/city/layout";

const districtName = (id: string) => DISTRICTS.find((d) => d.id === id)?.name ?? "";

export function buildSnapshot(db: DB, today: string): LifeOSSnapshot {
  const ledger = Object.values(db.xpEvents ?? {});
  const split = splitProgress(ledger);
  const lv = levelInfo(split.lifeXp);
  const floor = split.lifeXp - lv.into;

  const goalsById = db.goals ?? {};
  const goals: GoalView[] = Object.values(goalsById)
    .filter((g) => g.status !== "planning")
    .map((g) => ({
      id: g.id,
      title: g.title,
      region: regionOfGoal(g),
      status: g.status,
      targetDate: g.targetDate,
      progress: g.status === "done" ? 1 : (goalProgress(db, g, today).fraction ?? 0),
    }));

  const tasks: TaskView[] = Object.values(db.tasks ?? {})
    .filter((t) => t.status === "planned" && !t.recurrence && t.date !== null && t.date <= today)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 5)
    .map((t) => {
      const g = t.goalId ? goalsById[t.goalId] : undefined;
      return { id: t.id, title: t.title, goalId: t.goalId ?? null, region: g ? regionOfGoal(g) : null, date: t.date, status: "planned" as const };
    });

  const milestones: MilestoneView[] = Object.values(db.milestones ?? {})
    .map((m) => {
      const g = goalsById[m.goalId];
      if (!g) return null;
      const region = regionOfGoal(g);
      return { id: m.id, goalId: m.goalId, title: m.title, region, done: m.status === "done", unlocks: `מבנה חדש ב${districtName(region)}` };
    })
    .filter((m): m is MilestoneView => m !== null)
    .sort((a, b) => Number(a.done) - Number(b.done));

  const worldEvents = ledger.filter((e) => WORLD_KINDS.has(e.kind)).sort((a, b) => b.at.localeCompare(a.at));
  const done = milestones.filter((m) => m.done);
  const name = Object.values(db.settings ?? {})[0]?.displayName || Object.values(db.gameProfile ?? {})[0]?.displayName || "";

  return {
    source: "lifeos",
    profile: { displayName: name, lifeXp: split.lifeXp, level: lv.level, levelFloorXp: floor, nextLevelXp: floor + lv.need },
    goals,
    tasks,
    milestones,
    domainProgress: domainProgress(goals),
    world: {
      points: split.worldProgress,
      discoveries: [],
      unlockedBuildings: done.map((m) => `${m.unlocks} · ${m.title}`),
      cityConstruction: milestones.length ? done.length / milestones.length : 0,
      achievements: worldEvents.slice(0, 8).map((e) => ({ id: e.id, title: e.title, at: e.at })),
    },
  };
}
