/**
 * Content: the Kingdom of Knowledge (the first kingdom). Pure data, essential, no real-life gating.
 *   The seal on the isle's threshold answers the three forces in order, each one validated by the
 *   engine: FORM traces its outline, CHANGE turns its rings, CONNECTION joins them — and it opens.
 *   Beyond it: the Hall of Patterns (first slice: arrive, explore; the pattern dials come next).
 */
import type { Action, Condition, SiteDef } from "../core/state";
import type { QuestDef } from "../core/quests";
import { D } from "./worldDepth";

export const K = { open: "knowledge.open", entered: "knowledge.entered", codex: "knowledge.codex" } as const;
export const SEAL_SITE = "knowledge_seal";
export const SEAL_STAGES = ["sealed", "traced", "turning", "open"] as const;
export type SealStage = (typeof SEAL_STAGES)[number];

/**
 * The Hall of Patterns: three star dials (one per satellite platform), each with four symbols.
 * CHANGE turns a dial one step. The lens above the hall shows which symbol each dial must point at;
 * CONNECTION on the codex opens it only when all three match (checked by the engine).
 */
export const DIAL_SYMBOLS = 4;
export const DIALS = ["west", "north", "east"] as const;
export type DialId = (typeof DIALS)[number];
export const dialSite = (d: DialId) => `dial_${d}`;
export const DIAL_TARGET: Record<DialId, number> = { west: 2, north: 1, east: 3 };
/** the four symbols on every dial (kingdom glyphs reused as celestial signs) */
export const DIAL_GLYPHS = ["knowledge", "mind", "health", "career"] as const;
export const CODEX_SITE = "codex";
const dialDef = (d: DialId): SiteDef => ({
  id: dialSite(d),
  title: "חוגת כוכבים",
  initial: "p0",
  transitions: Array.from({ length: DIAL_SYMBOLS }, (_, k) => ({ force: "change" as const, from: `p${k}`, to: `p${(k + 1) % DIAL_SYMBOLS}` })),
});
export const dialsAligned: Condition = { all: DIALS.map((d) => ({ site: dialSite(d), is: `p${DIAL_TARGET[d]}` })) };

export const KNOWLEDGE_SITES: Record<string, SiteDef> = {
  ...Object.fromEntries(DIALS.map((d) => [dialSite(d), dialDef(d)])),
  [CODEX_SITE]: {
    id: CODEX_SITE,
    title: "הקודקס",
    initial: "closed",
    transitions: [{ force: "connection", from: "closed", to: "open", when: dialsAligned, then: [{ type: "setFlag", flag: K.codex }, { type: "discover", id: "knowledge_codex" }, { type: "journal", id: "j.codex" }] }],
  },
  [SEAL_SITE]: {
    id: SEAL_SITE,
    title: "חותם ממלכת הידע",
    initial: "sealed",
    transitions: [
      { force: "form", from: "sealed", to: "traced", then: [{ type: "journal", id: "j.seal_traced" }] },
      { force: "change", from: "traced", to: "turning" },
      { force: "connection", from: "turning", to: "open", then: [{ type: "setFlag", flag: K.open }, { type: "journal", id: "j.seal_open" }] },
    ],
  },
};

export const KNOWLEDGE_QUEST: QuestDef = {
  id: "kingdom_knowledge",
  title: "ממלכת הידע",
  essential: true,
  available: { flag: D.threshold },
  steps: [
    { id: "form", text: "צורה: שרטטו את קווי החותם", done: { any: [{ site: SEAL_SITE, is: "traced" }, { site: SEAL_SITE, is: "turning" }, { site: SEAL_SITE, is: "open" }] } },
    { id: "change", text: "שינוי: סובבו את טבעות החותם", done: { any: [{ site: SEAL_SITE, is: "turning" }, { site: SEAL_SITE, is: "open" }] } },
    { id: "connect", text: "חיבור: חברו את החותם, והוא ייפתח", done: { flag: K.open } },
    { id: "enter", text: "היכנסו לממלכת הידע", done: { flag: K.entered } },
    { id: "dials", text: "שינוי: כוונו את שלוש חוגות הכוכבים לדפוס שבעדשה", done: dialsAligned },
    { id: "codex", text: "חיבור: פתחו את הקודקס במרכז ההיכל", done: { flag: K.codex } },
  ],
};

export const onEnterKingdom = (): Action[] => [{ type: "setFlag", flag: K.entered }, { type: "discover", id: "kingdom_knowledge" }, { type: "journal", id: "j.knowledge" }];

export const KNOWLEDGE_JOURNAL = {
  "j.seal_traced": {
    title: "קווי החותם",
    body: "הצורה שרטטה את קווי החותם באור. עכשיו אני רואה שהוא בנוי מטבעות בתוך טבעות, כמו מנגנון שנעצר באמצע תנועה.",
  },
  "j.seal_open": {
    title: "החותם נפתח",
    body: "שינוי סובב את הטבעות, וחיבור איחד אותן. החותם נפתח בלי קול, ומעבר לו חושך כחול מלא כוכבים.",
  },
  "j.codex": {
    title: "הקודקס",
    body: "שלושת הדפוסים התיישרו, והחיבור עבר ביניהם אל הקודקס. הוא נפתח, והדפים שלו לא כתובים במילים אלא בכוכבים. זו מפה של הבריאה כפי שהייתה לפני השבר, והיא לא שלמה. חסרים בה חמישה חלקים.",
  },
  "j.knowledge": {
    title: "ממלכת הידע",
    body: "כאן הכול מרחף: במות של אבן, ספריות בגובה של מגדלים, ומעל כולן מנגנון שמיים ענק שעדיין מסתובב. מישהו ניסה להבין כאן את הבריאה, לפני שהיא נשברה.",
  },
};
