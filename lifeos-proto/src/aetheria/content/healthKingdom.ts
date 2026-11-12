/**
 * Content: the Kingdom of Health — the Living Grove (second kingdom). Pure data, essential.
 *   Reached from the Hall of Patterns once the codex is open.
 *   The Withered Grove: three dried springs around a withered Heart Tree.
 *     CHANGE turns each spring's dry earth into running water;
 *     CONNECTION channels the water along the roots to the tree;
 *     FORM — only when all three are channelled — makes the Heart Tree bloom.
 */
import type { Action, Condition, SiteDef } from "../core/state";
import type { QuestDef } from "../core/quests";
import { K } from "./knowledgeKingdom";

export const H = { entered: "health.entered", bloomed: "health.bloomed" } as const;
export const SPRINGS = ["west", "north", "east"] as const;
export type SpringId = (typeof SPRINGS)[number];
export const springSite = (s: SpringId) => `spring_${s}`;
export const HEART_SITE = "heart_tree";

const springDef = (s: SpringId): SiteDef => ({
  id: springSite(s),
  title: "מעיין יבש",
  initial: "dry",
  transitions: [
    { force: "change", from: "dry", to: "flowing", then: [{ type: "count", key: "world.springs_revived" }] },
    { force: "connection", from: "flowing", to: "channelled" },
  ],
});
const allAt = (state: string): Condition => ({ all: SPRINGS.map((s) => ({ site: springSite(s), is: state })) });
const atLeast = (states: string[]): Condition => ({ all: SPRINGS.map((s) => ({ any: states.map((st) => ({ site: springSite(s), is: st })) })) });
export const springsChannelled = allAt("channelled");

export const HEALTH_SITES: Record<string, SiteDef> = {
  ...Object.fromEntries(SPRINGS.map((s) => [springSite(s), springDef(s)])),
  [HEART_SITE]: {
    id: HEART_SITE,
    title: "עץ הלב",
    initial: "withered",
    transitions: [{ force: "form", from: "withered", to: "blooming", when: springsChannelled, then: [{ type: "setFlag", flag: H.bloomed }, { type: "discover", id: "heart_tree" }, { type: "journal", id: "j.heart" }] }],
  },
};

export const HEALTH_QUEST: QuestDef = {
  id: "kingdom_health",
  title: "חורשת החיים",
  essential: true,
  available: { flag: K.codex },
  steps: [
    { id: "enter", text: "לכו בשביל שנפתח בהיכל הדפוסים, אל שער החיים", done: { flag: H.entered } },
    { id: "revive", text: "שינוי: החזירו את המים לשלושת המעיינות", done: atLeast(["flowing", "channelled"]) },
    { id: "channel", text: "חיבור: הזרימו את המים לאורך השורשים אל עץ הלב", done: springsChannelled },
    { id: "bloom", text: "צורה: העירו את עץ הלב", done: { flag: H.bloomed } },
  ],
};

export const onEnterGrove = (): Action[] => [{ type: "setFlag", flag: H.entered }, { type: "discover", id: "kingdom_health" }, { type: "journal", id: "j.grove" }];

export const HEALTH_JOURNAL = {
  "j.grove": {
    title: "חורשת החיים",
    body: "עצים בגובה של מגדלים, שורשים כמו גשרים, ופטריות שזוהרות בצל. אבל הכול כאן עייף. המעיינות יבשו, והעץ הגדול במרכז עומד בלי עלים.",
  },
  "j.heart": {
    title: "עץ הלב",
    body: "המים הגיעו לשורשים, והצורה עשתה את השאר. העץ נשם. עלים נפרשו, ופרחים של אור נפתחו על הענפים ועל האדמה. החורשה זוכרת עכשיו איך לחיות.",
  },
};
