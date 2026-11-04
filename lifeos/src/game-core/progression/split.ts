/**
 * Read-only split of the EXISTING ledger into the two progressions decided for the new game layer:
 *   Life XP        — only from LifeOS-origin events (tasks, occurrences, habits, milestones, goals)
 *   World Progress — game-origin items (achievements, challenges, chests, unlock markers)
 * Phase 1 only DISPLAYS this split; the existing islands keep their current rules unchanged.
 */
import type { Domain } from "../contracts/events";

export interface LedgerRow {
  id: string;
  kind: string;
  amount: number;
  region: string | null;
  at: string;
}

export const LIFE_KINDS = new Set(["task", "occurrence", "habit", "milestone", "goal"]);
export const WORLD_KINDS = new Set(["achievement", "challenge", "chest", "unlock"]);

export interface ProgressSplit {
  lifeXp: number;
  worldProgress: number;
  lifeByDomain: Record<Domain, number>;
  lifeEvents: number;
  worldEvents: number;
}

export function splitProgress(ledger: LedgerRow[]): ProgressSplit {
  const lifeByDomain: Record<Domain, number> = { wealth: 0, health: 0, knowledge: 0, career: 0, social: 0, mind: 0 };
  let lifeXp = 0;
  let worldProgress = 0;
  let lifeEvents = 0;
  let worldEvents = 0;
  for (const e of ledger) {
    if (LIFE_KINDS.has(e.kind)) {
      lifeXp += e.amount;
      lifeEvents++;
      if (e.region && e.region in lifeByDomain) lifeByDomain[e.region as Domain] += e.amount;
    } else if (WORLD_KINDS.has(e.kind)) {
      worldProgress += e.amount;
      worldEvents++;
    }
  }
  return { lifeXp, worldProgress, lifeByDomain, lifeEvents, worldEvents };
}
