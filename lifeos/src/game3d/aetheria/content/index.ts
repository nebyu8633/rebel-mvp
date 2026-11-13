/** Content registry: all quests (in story order) and all journal entries. */
import type { QuestDef } from "../core/quests";
import { FIRST_RESONANCE, JOURNAL as J1, type JournalText } from "./firstResonance";
import { ECHO_AWAKENING, ECHO_JOURNAL } from "./echoAwakening";
import { GATE_JOURNAL, GATE_SITES, SLEEPING_GATE } from "./sleepingGate";
import { BRIDGE_QUEST, DEPTH_JOURNAL, DEPTH_SITES, MEMORY_QUEST } from "./worldDepth";
import { KNOWLEDGE_JOURNAL, KNOWLEDGE_QUEST, KNOWLEDGE_SITES } from "./knowledgeKingdom";
import { HEALTH_JOURNAL, HEALTH_QUEST, HEALTH_SITES } from "./healthKingdom";
import { questStatus } from "../core/quests";
import type { Rules, WorldState } from "../core/state";

export const QUESTS: QuestDef[] = [FIRST_RESONANCE, ECHO_AWAKENING, SLEEPING_GATE, BRIDGE_QUEST, KNOWLEDGE_QUEST, HEALTH_QUEST, MEMORY_QUEST];
export const JOURNAL: Record<string, JournalText> = { ...J1, ...ECHO_JOURNAL, ...GATE_JOURNAL, ...DEPTH_JOURNAL, ...KNOWLEDGE_JOURNAL, ...HEALTH_JOURNAL };
/** World rules the engine validates against (resonance sites). */
export const RULES: Rules = { sites: { ...GATE_SITES, ...DEPTH_SITES, ...KNOWLEDGE_SITES, ...HEALTH_SITES } };

/** The quest to show in the tracker: the first visible, unfinished one (or the last completed). */
export function currentQuest(s: WorldState): QuestDef {
  for (const q of QUESTS) {
    const st = questStatus(q, s);
    if (st.state === "active") return q;
  }
  const done = QUESTS.filter((q) => questStatus(q, s).state === "complete");
  return done[done.length - 1] ?? QUESTS[0];
}
