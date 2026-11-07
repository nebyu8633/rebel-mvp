/**
 * Content: "The First Resonance" — the first AETHERIA vertical slice (The First Sanctuary).
 * Pure data + action bundles. The scene only calls these; every change goes through the rules engine.
 * Essential: fully playable without any real-life activity (validated in tests).
 */
import type { Action, WorldState } from "../core/state";
import { check } from "../core/state";
import type { QuestDef } from "../core/quests";
import type { EnrichmentRule } from "../core/enrichment";
import { FORCES, KINGDOM_IDS, KINGDOMS, type Force, type KingdomId } from "../core/model";

export const F = {
  arrived: "sanctuary.arrived",
  observatory: "observatory.reached",
  fragment: "fragment.touched",
  ring: (f: Force) => `ring.${f}.aligned`,
  resonance: "resonance.first",
  terrace: "terrace.reached",
  kingdoms: "kingdoms.revealed",
} as const;

export const FIRST_RESONANCE: QuestDef = {
  id: "first_resonance",
  title: "התהודה הראשונה",
  essential: true,
  steps: [
    { id: "observatory", text: "הגיעו אל מצפה הכוכבים הנטוש", done: { flag: F.observatory } },
    { id: "fragment", text: "חקרו את האור שבמרכז המצפה", done: { flag: F.fragment } },
    { id: "rings", text: "כוונו את שלוש טבעות האצטרולב: צורה, שינוי, חיבור", done: { all: FORCES.map((f) => ({ flag: F.ring(f) })) } },
    { id: "resonance", text: "עוררו את התהודה בשבר המקור", done: { flag: F.resonance } },
    { id: "terrace", text: "עלו אל הגלריה העליונה", done: { flag: F.terrace } },
    { id: "sigils", text: "קראו את חותמות הבריאה", done: { flag: F.kingdoms } },
  ],
};

// ---------------------------------------------------------------- journal
export interface JournalText {
  title: string;
  body: string;
}
export const JOURNAL: Record<string, JournalText> = {
  "j.sanctuary": {
    title: "המקדש הראשון",
    body: "רמה שקטה מעל העננים. אבנים עתיקות, שביל מכוסה טחב, ומצפה כוכבים שכיפתו נסדקה. מישהו בנה כאן פעם מקום להקשיב לשמיים.",
  },
  "j.fragment": {
    title: "שבר המקור",
    body: "בלב המצפה מרחף שבר של אור. כשנגעתי בו הוא לא חם ולא קר. הוא פועם, כאילו הוא מכיר את הקצב שלי.",
  },
  "j.echo": {
    title: "הצופה השקט",
    body: "משהו עומד בגלריה ומסתכל עליי. כשאני מתקרב הוא נמוג ומופיע שוב רחוק יותר. יש לו את הצורה שלי, אבל הוא עשוי מאור.",
  },
  "j.resonance": {
    title: "התהודה",
    body: "שלוש הטבעות התיישרו והשבר נפתח. אבנים שנפלו לפני דורות חזרו למקומן, והכיפה נפתחה אל השמיים. הבריאה לא נשברה סופית. היא מחכה.",
  },
  "j.kingdoms": {
    title: "הבריאה השבורה",
    body: "על קיר הגלריה נחשפו שש חותמות: עושר, בריאות, ידע, קריירה, חברה ונפש. שש ממלכות של בריאה אחת שהתנפצה. מסביבן שלוש טבעות: צורה, שינוי וחיבור. מה שנבנה מחדש כאן מהדהד בכל מקום.",
  },
};

export const SIGILS: { kingdom: KingdomId; title: string; color: string; line: string }[] = KINGDOM_IDS.map((k) => ({
  kingdom: k,
  title: KINGDOMS[k].title,
  color: KINGDOMS[k].color,
  line: {
    wealth: "מה שנאסף בסבלנות מחזיק את הגשרים.",
    health: "הגוף הוא האדמה שעליה כל השאר נבנה.",
    knowledge: "כל שאלה פותחת חלון בקיר.",
    career: "המלאכה שבידיים משנה את פני העיר.",
    social: "אין מגדל שעומד לבד.",
    mind: "בשקט שבין המחשבות נשמע ההד.",
  }[k],
}));

// ---------------------------------------------------------------- action bundles
export const onArrive = (): Action[] => [
  { type: "setFlag", flag: F.arrived },
  { type: "discover", id: "first_sanctuary" },
  { type: "journal", id: "j.sanctuary" },
];
export const onObservatory = (): Action[] => [{ type: "setFlag", flag: F.observatory }, { type: "discover", id: "observatory" }];
export const onTouchFragment = (s: WorldState): Action[] => [
  { type: "setFlag", flag: F.fragment },
  { type: "discover", id: "origin_fragment" },
  ...(s.echo === "dormant" ? [{ type: "advanceEcho" as const, to: "silent_observer" as const }] : []),
  { type: "journal", id: "j.fragment" },
  { type: "journal", id: "j.echo" },
];
export const onAlign = (f: Force): Action[] => [{ type: "setFlag", flag: F.ring(f) }];
export const ringsAligned = (s: WorldState) => FORCES.every((f) => s.flags.includes(F.ring(f)));
export const canResonate = (s: WorldState) => s.flags.includes(F.fragment) && ringsAligned(s) && !s.flags.includes(F.resonance);
export const onResonanceComplete = (): Action[] => [{ type: "setFlag", flag: F.resonance }, { type: "journal", id: "j.resonance" }];
export const onTerrace = (): Action[] => [{ type: "setFlag", flag: F.terrace }];
export const canReadSigils = (s: WorldState) => check(s, { all: [{ flag: F.resonance }, { flag: F.terrace }] }) && !s.flags.includes(F.kingdoms);
export const onReadSigils = (): Action[] => [{ type: "setFlag", flag: F.kingdoms }, { type: "discover", id: "six_kingdoms" }, { type: "journal", id: "j.kingdoms" }];

// ---------------------------------------------------------------- optional real-life enrichment
/** A verified milestone in a domain leaves a memory shard in the sanctuary (optional, cosmetic). */
export const ENRICHMENT_RULES: EnrichmentRule[] = [
  ...KINGDOM_IDS.map((k) => ({ id: `memory-${k}`, when: { eventTypes: ["milestone_completed" as const, "goal_completed" as const], kingdom: k }, grant: { kind: "memory" as const, id: `${k}_shard` } })),
  { id: "fragment-glow", when: { eventTypes: ["task_verified", "habit_logged", "occurrence_verified"] }, grant: { kind: "world_detail", id: "fragment_glow" } },
];
export const memoryShards = (s: WorldState): KingdomId[] => KINGDOM_IDS.filter((k) => s.flags.includes(`life:memory.${k}_shard`));
export const fragmentGlowBoost = (s: WorldState) => s.flags.includes("life:world_detail.fragment_glow");
