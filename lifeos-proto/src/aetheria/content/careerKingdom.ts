/**
 * Content: the Kingdom of Career — the Great Works (fourth kingdom). Pure data, essential.
 *   Reached from the Hall of Reflections once the Sleeping Mind wakes (the Door of Works).
 *   A great machine stands still at the edge of a chasm. FORM forges each of the three missing
 *   gears (any order); CHANGE throws the gearbox lever from idle to drive (only with all gears in);
 *   CONNECTION couples the drive to the great girder standing at the chasm's edge, which lowers
 *   across it as a bridge to the Tower of Works, where the kingdom's blueprint waits.
 */
import type { Action, Condition, SiteDef } from "../core/state";
import type { QuestDef } from "../core/quests";
import { M } from "./mindKingdom";

export const C = { entered: "career.entered", blueprint: "career.blueprint" } as const;
export const GEARS = ["left", "middle", "right"] as const;
export type GearId = (typeof GEARS)[number];
export const gearSite = (g: GearId) => `gear_${g}`;
export const LEVER_SITE = "gearbox";
export const CRANE_SITE = "crane";
export const gearsIn: Condition = { all: GEARS.map((g) => ({ site: gearSite(g), is: "forged" })) };

export const CAREER_SITES: Record<string, SiteDef> = {
  ...Object.fromEntries(GEARS.map((g) => [gearSite(g), { id: gearSite(g), title: "שקע גלגל השיניים", initial: "empty", transitions: [{ force: "form" as const, from: "empty", to: "forged", then: [{ type: "count", key: "world.gears_forged" } as Action] }] } satisfies SiteDef])),
  [LEVER_SITE]: {
    id: LEVER_SITE,
    title: "ידית תיבת ההילוכים",
    initial: "idle",
    transitions: [{ force: "change", from: "idle", to: "drive", when: gearsIn }],
  },
  [CRANE_SITE]: {
    id: CRANE_SITE,
    title: "זרוע הגשר",
    initial: "resting",
    transitions: [{ force: "connection", from: "resting", to: "spanning", when: { site: LEVER_SITE, is: "drive" }, then: [{ type: "journal", id: "j.crane" }] }],
  },
};

export const CAREER_QUEST: QuestDef = {
  id: "kingdom_career",
  title: "בית המלאכה הגדול",
  essential: true,
  available: { flag: M.awake },
  steps: [
    { id: "enter", text: "עברו בדלת המלאכה באי של התודעה", done: { flag: C.entered } },
    { id: "gears", text: "צורה: צקו את שלושת גלגלי השיניים החסרים", done: gearsIn },
    { id: "lever", text: "שינוי: העבירו את הידית למצב הנעה", done: { site: LEVER_SITE, is: "drive" } },
    { id: "crane", text: "חיבור: חברו את ההנעה לזרוע הגשר", done: { site: CRANE_SITE, is: "spanning" } },
    { id: "blueprint", text: "חצו את הזרוע אל מגדל המלאכה וקראו את התוכנית", done: { flag: C.blueprint } },
  ],
};

export const onEnterWorks = (): Action[] => [{ type: "setFlag", flag: C.entered }, { type: "discover", id: "kingdom_career" }, { type: "journal", id: "j.works" }];
export const onBlueprint = (): Action[] => [{ type: "setFlag", flag: C.blueprint }, { type: "discover", id: "blueprint_of_works" }, { type: "journal", id: "j.blueprint" }];

export const CAREER_JOURNAL = {
  "j.works": {
    title: "בית המלאכה הגדול",
    body: "מכונה בגודל של עיר עומדת דוממת על שפת תהום. בתוך הקיר שלה יש שלושה חורים במקום שבו היו פעם גלגלי שיניים. מעבר לתהום עומד מגדל, ואין שום דרך להגיע אליו.",
  },
  "j.crane": {
    title: "הזרוע נפרשת",
    body: "הגלגלים נתפסו זה בזה, הידית ננעלה על הנעה, והחיבור עבר אל הזרוע. הקורה הענקית ירדה לאט מעל התהום ונחתה על המגדל. עכשיו יש דרך.",
  },
  "j.blueprint": {
    title: "התוכנית",
    body: "על שולחן במגדל פרושה תוכנית של הבריאה: לא כמו שהייתה, אלא כמו שאפשר לבנות אותה מחדש. שתי ממלכות עוד חסרות בה.",
  },
};
