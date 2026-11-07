/**
 * Quests: ordered steps, each completed when its condition holds in the world state.
 * Accessibility rule (product decision): essential quests — main narrative and core gameplay —
 * may NEVER depend on real-life activity. validateQuest() rejects any essential quest whose
 * conditions reference `life:` flags. Optional quests may (enrichment paths).
 */
import { isLifeFlag } from "./model";
import { check, referencedFlags, type Condition, type WorldState } from "./state";

export interface QuestStep {
  id: string;
  text: string;
  done: Condition;
}
export interface QuestDef {
  id: string;
  title: string;
  /** main story / core gameplay — must be completable without real-life activity */
  essential: boolean;
  /** when the quest becomes visible (default: always) */
  available?: Condition;
  steps: QuestStep[];
}

export function validateQuest(q: QuestDef): string[] {
  const errors: string[] = [];
  if (!q.steps.length) errors.push(`${q.id}: no steps`);
  const ids = new Set<string>();
  for (const s of q.steps) {
    if (ids.has(s.id)) errors.push(`${q.id}: duplicate step ${s.id}`);
    ids.add(s.id);
  }
  if (q.essential) {
    const conds = [...(q.available ? [q.available] : []), ...q.steps.map((s) => s.done)];
    const life = conds.flatMap(referencedFlags).filter(isLifeFlag);
    if (life.length) errors.push(`${q.id}: essential quest depends on real-life flags (${life.join(", ")})`);
  }
  return errors;
}

export type QuestStatus = { state: "hidden" } | { state: "active"; step: QuestStep; index: number } | { state: "complete" };

export function questStatus(q: QuestDef, s: WorldState): QuestStatus {
  if (q.available && !check(s, q.available)) return { state: "hidden" };
  const i = q.steps.findIndex((st) => !check(s, st.done));
  return i < 0 ? { state: "complete" } : { state: "active", step: q.steps[i], index: i };
}
