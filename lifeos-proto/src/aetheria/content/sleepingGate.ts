/**
 * Content: "The Sleeping Gate" — Phase 3, Resonance gameplay. The Living Architect learns the three
 * primordial forces at the astrolabe and uses them on the gate at the plateau's edge:
 *   FORM creates (steps of light-stone), CHANGE transforms (the fallen pillar rises),
 *   CONNECTION joins (a thread of light between the pillars wakes the gate).
 * Pure data; essential (no real-life gating). The rules engine validates every use of a power.
 */
import type { Action, SiteDef, WorldState } from "../core/state";
import type { QuestDef } from "../core/quests";
import { FORCES, type Force } from "../core/model";
import { E } from "./echoAwakening";

export const G = { found: "gate.found", awake: "gate.awake" } as const;
export const SITE = { steps: "gate_steps", pillar: "gate_pillar", link: "gate_link" } as const;

export const GATE_SITES: Record<string, SiteDef> = {
  [SITE.steps]: {
    id: SITE.steps,
    title: "הבמה הגבוהה",
    initial: "bare",
    transitions: [{ force: "form", from: "bare", to: "formed", then: [{ type: "journal", id: "j.form" }] }],
  },
  [SITE.pillar]: {
    id: SITE.pillar,
    title: "העמוד שנפל",
    initial: "fallen",
    transitions: [{ force: "change", from: "fallen", to: "standing", when: { site: SITE.steps, is: "formed" }, then: [{ type: "journal", id: "j.change" }] }],
  },
  [SITE.link]: {
    id: SITE.link,
    title: "הגבישים המנותקים",
    initial: "severed",
    transitions: [
      {
        force: "connection",
        from: "severed",
        to: "linked",
        when: { site: SITE.pillar, is: "standing" },
        then: [{ type: "setFlag", flag: G.awake }, { type: "discover", id: "sleeping_gate" }, { type: "journal", id: "j.gate" }],
      },
    ],
  },
};

export const SLEEPING_GATE: QuestDef = {
  id: "sleeping_gate",
  title: "השער הישן",
  essential: true,
  available: { flag: E.bondChosen },
  steps: [
    { id: "learn", text: "למדו את שלושת הכוחות בטבעות האסטרולב", done: { all: FORCES.map((f) => ({ power: f })) } },
    { id: "find", text: "מצאו את השער בקצה המערבי של הרמה", done: { flag: G.found } },
    { id: "form", text: "צורה: בנו דרך אל הבמה", done: { site: SITE.steps, is: "formed" } },
    { id: "change", text: "שינוי: הקימו את העמוד שנפל", done: { site: SITE.pillar, is: "standing" } },
    { id: "connect", text: "חיבור: חברו את הגבישים שבראש העמודים", done: { site: SITE.link, is: "linked" } },
    { id: "tell", text: "חזרו אל הד העתיד", done: { echoAtLeast: "future_companion" } },
  ],
};

/** The bond chosen with the Echo is the force the player learns first (and the one the Echo hears). */
export const canLearn = (s: WorldState) => s.flags.includes(E.bondChosen);
export const onLearn = (s: WorldState, f: Force): Action[] => [
  { type: "learnPower", force: f },
  ...((s.powers ?? []).length === 0 ? [{ type: "journal", id: "j.powers" } as Action] : []),
];
export const onGateFound = (): Action[] => [{ type: "setFlag", flag: G.found }];

/** Hebrew in-world feedback for engine rejections. */
export const REJECT_TEXT: Record<string, string> = {
  "resonance:not_learned": "הכוח הזה עוד לא שלך. למדו אותו בטבעות האסטרולב.",
  "resonance:no_effect": "הכוח מתפזר. כאן צריך כוח אחר.",
  "resonance:not_ready": "משהו חסר עדיין. נסו קודם במקום אחר.",
  "resonance:done": "זה כבר נעשה.",
};

export const GATE_JOURNAL = {
  "j.powers": {
    title: "שלושת הכוחות",
    body: "הטבעות לימדו אותי: צורה בונה את מה שאין, שינוי הופך את מה שיש, חיבור מאחד את מה שנפרד. ההד אמר שהשער מחכה בקצה הרמה.",
  },
  "j.form": {
    title: "צורה",
    body: "הושטתי יד, והאור התגבש לאבן. מדרגות שלא היו קיימות עולות עכשיו אל הבמה.",
  },
  "j.change": {
    title: "שינוי",
    body: "העמוד שנפל לפני עידנים הסתובב באוויר וחזר למקומו. שום דבר כאן לא נשאר כמו שהיה.",
  },
  "j.gate": {
    title: "השער התעורר",
    body: "חוט של אור עבר בין שני הגבישים, והקשת נמלאה באור. מעבר לשער נמתח גשר אל האיים הצפים. ההד בטח מרגיש את זה.",
  },
  "j.companion": {
    title: "בן הלוויה העתידי",
    body: "ההד כבר לא שבור. הוא מדבר במשפטים שלמים, והוא הולך לצידי. הוא אומר שהוא מה שאהיה, ושעכשיו נלך יחד.",
  },
};
