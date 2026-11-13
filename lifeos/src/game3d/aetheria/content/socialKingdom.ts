/**
 * Content: the Kingdom of Social — the Village of the Hearth (fifth kingdom). Pure data, essential.
 *   Reached from the Tower of Works once the blueprint is read (the Gate of the Hearth).
 *   The village forgot itself: its bridges broke, its people faded, its common fire went out.
 *   CONNECTION rebuilds each bridge from the plaza to a hamlet (any order); ringing each hamlet's
 *   greeting bell brings its people back (light figures gather in the plaza). The Common Flame needs
 *   two keepers at once: you, and the Future Echo — if you ask it to stand with you. Then FORM
 *   kindles the flame. The first puzzle that cannot be solved alone.
 */
import type { Action, Condition, SiteDef } from "../core/state";
import type { QuestDef } from "../core/quests";
import { C } from "./careerKingdom";

export const S = { entered: "social.entered", keepers: "social.keepers", flame: "social.flame" } as const;
export const HAMLETS = ["west", "north", "east"] as const;
export type HamletId = (typeof HAMLETS)[number];
export const bridgeSite = (h: HamletId) => `bridge_${h}`;
export const bellFlag = (h: HamletId) => `social.bell_${h}`;
export const HEARTH_SITE = "common_flame";
/** remembered by the Echo when you ask it to keep the fire with you */
export const ECHO_HELPS = "echo.helping";
export const allBells: Condition = { all: HAMLETS.map((h) => ({ flag: bellFlag(h) })) };

export const SOCIAL_SITES: Record<string, SiteDef> = {
  ...Object.fromEntries(HAMLETS.map((h) => [bridgeSite(h), { id: bridgeSite(h), title: "גשר שבור", initial: "broken", transitions: [{ force: "connection" as const, from: "broken", to: "whole" }] } satisfies SiteDef])),
  [HEARTH_SITE]: {
    id: HEARTH_SITE,
    title: "האש המשותפת",
    initial: "cold",
    transitions: [{ force: "form", from: "cold", to: "burning", when: { all: [allBells, { flag: S.keepers }] }, then: [{ type: "setFlag", flag: S.flame }, { type: "discover", id: "common_flame" }, { type: "journal", id: "j.flame" }] }],
  },
};

export const SOCIAL_QUEST: QuestDef = {
  id: "kingdom_social",
  title: "כפר האח",
  essential: true,
  available: { flag: C.blueprint },
  steps: [
    { id: "enter", text: "עברו בשער האח שליד מגדל המלאכה", done: { flag: S.entered } },
    { id: "bridges", text: "חיבור: חברו מחדש את הגשרים אל שלושת הכפרים", done: { all: HAMLETS.map((h) => ({ site: bridgeSite(h), is: "whole" })) } },
    { id: "bells", text: "צלצלו בפעמון הברכה בכל כפר", done: allBells },
    { id: "keepers", text: "האש צריכה שני שומרים. בקשו מהד העתיד לעמוד איתכם", done: { flag: S.keepers } },
    { id: "flame", text: "צורה: הציתו את האש המשותפת", done: { flag: S.flame } },
  ],
};

export const onEnterVillage = (): Action[] => [{ type: "setFlag", flag: S.entered }, { type: "discover", id: "kingdom_social" }, { type: "journal", id: "j.village" }];
export const onBell = (h: HamletId): Action[] => [{ type: "setFlag", flag: bellFlag(h) }, { type: "count", key: "world.bells_rung" }];
export const onKeepers = (): Action[] => [{ type: "setFlag", flag: S.keepers }, { type: "journal", id: "j.keepers" }];

export const SOCIAL_JOURNAL = {
  "j.village": {
    title: "כפר האח",
    body: "בתים קטנים על איים קטנים, וגשרים שבורים ביניהם. באמצע רחבה עם מדורה כבויה. אין כאן אף אחד. לא כי הלכו, אלא כי שכחו אחד את השני.",
  },
  "j.keepers": {
    title: "שני שומרים",
    body: "ביקשתי מההד לעמוד איתי, והוא עמד. בפעם הראשונה לא עשיתי משהו לבד.",
  },
  "j.flame": {
    title: "האש המשותפת",
    body: "האש נדלקה, והחלונות בכל הכפרים נדלקו איתה. האנשים עמדו סביבה, ואף אחד לא היה צריך להגיד כלום.",
  },
};
