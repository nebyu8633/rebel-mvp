/** Content registry: all quests (in story order) and all journal entries. */
import type { QuestDef } from "../core/quests";
import { FIRST_RESONANCE, JOURNAL as J1, type JournalText } from "./firstResonance";
import { ECHO_AWAKENING, ECHO_JOURNAL } from "./echoAwakening";
import { questStatus } from "../core/quests";
import type { WorldState } from "../core/state";

export const QUESTS: QuestDef[] = [FIRST_RESONANCE, ECHO_AWAKENING];
export const JOURNAL: Record<string, JournalText> = { ...J1, ...ECHO_JOURNAL };

/** The quest to show in the tracker: the first visible, unfinished one (or the last completed). */
export function currentQuest(s: WorldState): QuestDef {
  for (const q of QUESTS) {
    const st = questStatus(q, s);
    if (st.state === "active") return q;
  }
  const done = QUESTS.filter((q) => questStatus(q, s).state === "complete");
  return done[done.length - 1] ?? QUESTS[0];
}
