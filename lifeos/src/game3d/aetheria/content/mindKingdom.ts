/**
 * Content: the Kingdom of the Mind — the Hall of Reflections (third kingdom). Pure data, essential.
 *   Reached from the Living Grove once the Heart Tree blooms (the Gate of Dreams).
 *   Above the islands hangs an inverted mirror-world; the bridges you need exist only there.
 *   CHANGE on a mirror lantern turns the reflected bridge into a real one (each lantern only after
 *   the previous bridge is real); CONNECTION joins the three lanterns' light and wakes the Sleeping
 *   Mind at the core (only when all three bridges are real).
 */
import type { Action, Condition, SiteDef } from "../core/state";
import type { QuestDef } from "../core/quests";
import { H } from "./healthKingdom";

export const M = { entered: "mind.entered", awake: "mind.awake" } as const;
export const LANTERNS = ["first", "second", "third"] as const;
export type LanternId = (typeof LANTERNS)[number];
export const lanternSite = (l: LanternId) => `lantern_${l}`;
export const CORE_SITE = "sleeping_mind";
const isReal = (l: LanternId): Condition => ({ site: lanternSite(l), is: "real" });

export const MIND_SITES: Record<string, SiteDef> = {
  ...Object.fromEntries(
    LANTERNS.map((l, i) => [
      lanternSite(l),
      {
        id: lanternSite(l),
        title: "פנס המראה",
        initial: "reflected",
        transitions: [{ force: "change" as const, from: "reflected", to: "real", ...(i > 0 ? { when: isReal(LANTERNS[i - 1]) } : {}), then: [{ type: "count", key: "world.bridges_realised" } as Action] }],
      } satisfies SiteDef,
    ]),
  ),
  [CORE_SITE]: {
    id: CORE_SITE,
    title: "התודעה הישנה",
    initial: "asleep",
    transitions: [{ force: "connection", from: "asleep", to: "awake", when: { all: LANTERNS.map(isReal) }, then: [{ type: "setFlag", flag: M.awake }, { type: "discover", id: "sleeping_mind" }, { type: "journal", id: "j.mind_awake" }] }],
  },
};

export const MIND_QUEST: QuestDef = {
  id: "kingdom_mind",
  title: "היכל ההשתקפויות",
  essential: true,
  available: { flag: H.bloomed },
  steps: [
    { id: "enter", text: "עברו בשער החלומות שליד עץ הלב", done: { flag: M.entered } },
    { id: "first", text: "שינוי: הפכו את הגשר המשתקף לאמיתי", done: isReal("first") },
    { id: "second", text: "המשיכו אל האי הבא והפכו גם את הגשר שלו", done: isReal("second") },
    { id: "third", text: "הגשר האחרון מוביל אל הליבה", done: isReal("third") },
    { id: "core", text: "חיבור: חברו את אור הפנסים והעירו את התודעה הישנה", done: { flag: M.awake } },
  ],
};

export const onEnterMind = (): Action[] => [{ type: "setFlag", flag: M.entered }, { type: "discover", id: "kingdom_mind" }, { type: "journal", id: "j.mind" }];

export const MIND_JOURNAL = {
  "j.mind": {
    title: "היכל ההשתקפויות",
    body: "איים לבנים מרחפים, ומעליהם, הפוך, עולם שלם שמשתקף בשמיים. שם יש גשרים. כאן אין. אולי השאלה היא לא איפה הדרך, אלא איזה צד של המראה אמיתי.",
  },
  "j.mind_awake": {
    title: "התודעה התעוררה",
    body: "שלושה אורות התחברו, והעין הגדולה בליבה נפתחה. לרגע ראיתי את שני העולמות בבת אחת, את מה שיש ואת מה שיכול להיות. ואז הבנתי ששניהם שלי.",
  },
};
