/**
 * Content: the Kingdom of Knowledge (the first kingdom). Pure data, essential, no real-life gating.
 *   The seal on the isle's threshold answers the three forces in order, each one validated by the
 *   engine: FORM traces its outline, CHANGE turns its rings, CONNECTION joins them — and it opens.
 *   Beyond it: the Hall of Patterns (first slice: arrive, explore; the pattern dials come next).
 */
import type { Action, SiteDef } from "../core/state";
import type { QuestDef } from "../core/quests";
import { D } from "./worldDepth";

export const K = { open: "knowledge.open", entered: "knowledge.entered" } as const;
export const SEAL_SITE = "knowledge_seal";
export const SEAL_STAGES = ["sealed", "traced", "turning", "open"] as const;
export type SealStage = (typeof SEAL_STAGES)[number];

export const KNOWLEDGE_SITES: Record<string, SiteDef> = {
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
  "j.knowledge": {
    title: "ממלכת הידע",
    body: "כאן הכול מרחף: במות של אבן, ספריות בגובה של מגדלים, ומעל כולן מנגנון שמיים ענק שעדיין מסתובב. מישהו ניסה להבין כאן את הבריאה, לפני שהיא נשברה.",
  },
};
