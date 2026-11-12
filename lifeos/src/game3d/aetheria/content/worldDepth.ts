/**
 * Content: World Depth (Phase 5) — what lies around and beyond the Sleeping Gate.
 *   "הגשר אל הממלכה" (essential): cross the awakened light bridge to the floating isle and find
 *     the sealed threshold of the first kingdom.
 *   "רסיסי זיכרון" (optional): three hidden memory shards tell how creation fractured. The third
 *     only appears when the cracked star lens on the gallery is made whole with CHANGE — a small
 *     environmental puzzle that reuses the engine-validated resonance sites.
 * Pure data. Nothing here depends on real-life activity.
 */
import type { Action, Condition, SiteDef, WorldState } from "../core/state";
import type { QuestDef } from "../core/quests";
import { F as F1 } from "./firstResonance";
import { G } from "./sleepingGate";

export const D = {
  bridge: "bridge.crossed",
  isle: "isle.reached",
  threshold: "threshold.found",
  lens: "lens.whole",
} as const;
export const MEMORIES = ["memory_colonnade", "memory_south_rim", "memory_star_chart"] as const;
export type MemoryId = (typeof MEMORIES)[number];
export const LENS_SITE = "star_lens";

export const DEPTH_SITES: Record<string, SiteDef> = {
  [LENS_SITE]: {
    id: LENS_SITE,
    title: "עדשת הכוכבים הסדוקה",
    initial: "cracked",
    transitions: [{ force: "change", from: "cracked", to: "whole", then: [{ type: "setFlag", flag: D.lens }, { type: "journal", id: "j.lens" }] }],
  },
};

export const BRIDGE_QUEST: QuestDef = {
  id: "bridge_to_kingdom",
  title: "הגשר אל הממלכה",
  essential: true,
  available: { flag: G.awake },
  steps: [
    { id: "cross", text: "חצו את גשר האור אל האי הצף", done: { flag: D.isle } },
    { id: "threshold", text: "מצאו את מה שמחכה באי", done: { flag: D.threshold } },
  ],
};

const found = (m: MemoryId): Condition => ({ discovered: m });
const [a, b, c] = MEMORIES.map(found);
export const MEMORY_QUEST: QuestDef = {
  id: "memory_shards",
  title: "רסיסי זיכרון",
  essential: false,
  available: { flag: F1.kingdoms },
  steps: [
    { id: "one", text: "רסיסי זיכרון מפוזרים במקדש. מצאו את הראשון", done: { any: [a, b, c] } },
    { id: "two", text: "מצאו רסיס זיכרון נוסף", done: { any: [{ all: [a, b] }, { all: [a, c] }, { all: [b, c] }] } },
    { id: "three", text: "הרסיס האחרון מסתתר באור הכוכבים", done: { all: [a, b, c] } },
  ],
};

export const memoriesFound = (s: WorldState) => MEMORIES.filter((m) => s.discoveries.includes(m)).length;
/** The third shard only exists once the lens focuses starlight onto the star chart. */
export const memoryVisible = (s: WorldState, m: MemoryId) => m !== "memory_star_chart" || s.flags.includes(D.lens);
export const onMemory = (s: WorldState, m: MemoryId): Action[] => (memoryVisible(s, m) ? [{ type: "discover", id: m }, { type: "journal", id: `j.${m}` }] : []);
export const onIsle = (): Action[] => [{ type: "setFlag", flag: D.isle }, { type: "discover", id: "floating_isle" }, { type: "journal", id: "j.isle" }];
export const onThreshold = (): Action[] => [{ type: "setFlag", flag: D.threshold }, { type: "discover", id: "first_threshold" }, { type: "journal", id: "j.threshold" }];

export const DEPTH_JOURNAL = {
  "j.memory_colonnade": {
    title: "זיכרון: לפני השבר",
    body: "ברסיס ראיתי את השדרה שלמה. אנשים הלכו בה אל המצפה, ונשאו איתם שאלות על העתיד. אף אחד לא ידע שזו השאלה האחרונה שהבריאה תשמע שלמה.",
  },
  "j.memory_south_rim": {
    title: "זיכרון: השבר הראשון",
    body: "הרסיס הראה את השמיים נסדקים. האור לא נעלם, הוא נשבר לשישה. כל רסיס נפל למקום אחר, ושם צמחה ממלכה.",
  },
  "j.memory_star_chart": {
    title: "זיכרון: השומר האחרון",
    body: "מי שבנה את המצפה השאיר את העדשה מכוונת אל מפת הכוכבים. הוא ידע שמישהו יחזור, ושיצטרך לשנות את מה שנשבר כדי לראות.",
  },
  "j.lens": {
    title: "העדשה השלמה",
    body: "השינוי עבר בזכוכית הסדוקה והיא התאחתה. אור הכוכבים התכנס דרכה ונפל על מפת הכוכבים ברצפה. משהו מחכה שם.",
  },
  "j.isle": {
    title: "האי הצף",
    body: "הלכתי על האור עצמו, מעל ים העננים. האי קטן ושקט, ובמרכזו עומד משהו שנבנה לפני הרבה זמן.",
  },
  "j.threshold": {
    title: "סף הממלכה הראשונה",
    body: "קשת חתומה באור כחול, עם סמל של עין פקוחה. ממלכת הידע. היא עוד לא נפתחת, אבל היא שומעת אותי. הדרך הבאה מתחילה כאן.",
  },
};
