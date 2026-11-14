/**
 * Content: the Kingdom of Wealth — the Vault of Value (sixth kingdom), and the end of the first
 * chapter. Pure data, essential.
 *   Reached from the Village of the Hearth once the Common Flame burns (the Gate of Gold).
 *   A great vault is sealed by a balance: an ancient weight on one pan, the other empty. Value is
 *   not found here — it is made and exchanged: CHANGE refines each plinth's ore into gold; CONNECTION
 *   carries each ingot onto the empty pan; with the scale balanced, FORM shapes the key and the
 *   vault opens on the sixth shard.
 *   The finale: back at the Origin Fragment, with all six kingdoms restored, CONNECTION joins them.
 */
import type { Action, Condition, SiteDef } from "../core/state";
import type { QuestDef } from "../core/quests";
import { S } from "./socialKingdom";
import { K } from "./knowledgeKingdom";
import { H } from "./healthKingdom";
import { M } from "./mindKingdom";
import { C } from "./careerKingdom";

export const W = { entered: "wealth.entered", shard: "wealth.shard", restored: "creation.restored" } as const;
export const PLINTHS = ["west", "east", "south"] as const;
export type PlinthId = (typeof PLINTHS)[number];
export const plinthSite = (p: PlinthId) => `plinth_${p}`;
export const VAULT_SITE = "vault";
export const ORIGIN_SITE = "origin_convergence";
export const scaleBalanced: Condition = { all: PLINTHS.map((p) => ({ site: plinthSite(p), is: "placed" })) };
/** every kingdom restored (the Sanctuary's six seals answer) */
export const allKingdoms: Condition = { all: [{ flag: K.codex }, { flag: H.bloomed }, { flag: M.awake }, { flag: C.blueprint }, { flag: S.flame }, { flag: W.shard }] };

export const WEALTH_SITES: Record<string, SiteDef> = {
  ...Object.fromEntries(
    PLINTHS.map((p) => [
      plinthSite(p),
      {
        id: plinthSite(p),
        title: "עפרה גולמית",
        initial: "ore",
        transitions: [
          { force: "change" as const, from: "ore", to: "gold" },
          { force: "connection" as const, from: "gold", to: "placed", then: [{ type: "count", key: "world.ingots_weighed" } as Action] },
        ],
      } satisfies SiteDef,
    ]),
  ),
  [VAULT_SITE]: {
    id: VAULT_SITE,
    title: "דלת הכספת",
    initial: "sealed",
    transitions: [{ force: "form", from: "sealed", to: "open", when: scaleBalanced, then: [{ type: "journal", id: "j.vault" }] }],
  },
  [ORIGIN_SITE]: {
    id: ORIGIN_SITE,
    title: "שבר המקור",
    initial: "apart",
    transitions: [{ force: "connection", from: "apart", to: "joined", when: allKingdoms, then: [{ type: "setFlag", flag: W.restored }, { type: "discover", id: "creation_restored" }, { type: "journal", id: "j.restored" }] }],
  },
};

export const WEALTH_QUEST: QuestDef = {
  id: "kingdom_wealth",
  title: "כספת הערך",
  essential: true,
  available: { flag: S.flame },
  steps: [
    { id: "enter", text: "עברו בשער הזהב שברחבת הכפר", done: { flag: W.entered } },
    { id: "refine", text: "שינוי: זככו את העפרה בשלושת הכנים לזהב", done: { all: PLINTHS.map((p) => ({ any: [{ site: plinthSite(p), is: "gold" }, { site: plinthSite(p), is: "placed" }] })) } },
    { id: "weigh", text: "חיבור: העבירו את מטילי הזהב אל כף המאזניים הריקה", done: scaleBalanced },
    { id: "key", text: "צורה: עצבו את מפתח הכספת", done: { site: VAULT_SITE, is: "open" } },
    { id: "shard", text: "קחו את הרסיס השישי", done: { flag: W.shard } },
  ],
};

export const FINALE_QUEST: QuestDef = {
  id: "creation_restored",
  title: "הבריאה מתאחה",
  essential: true,
  available: { flag: W.shard },
  steps: [
    { id: "return", text: "חזרו אל שבר המקור במקדש הראשון", done: { flag: "finale.returned" } },
    { id: "join", text: "חיבור: אחדו את שש הממלכות", done: { flag: W.restored } },
  ],
};

export const onEnterVault = (): Action[] => [{ type: "setFlag", flag: W.entered }, { type: "discover", id: "kingdom_wealth" }, { type: "journal", id: "j.wealth" }];
export const onShard = (): Action[] => [{ type: "setFlag", flag: W.shard }, { type: "discover", id: "sixth_shard" }, { type: "journal", id: "j.shard" }];
export const onReturnToOrigin = (): Action[] => [{ type: "setFlag", flag: "finale.returned" }];

export const WEALTH_JOURNAL = {
  "j.wealth": {
    title: "כספת הערך",
    body: "אולם של שיש וזהב, ובמרכזו מאזניים בגודל של בית. על כף אחת מונחת משקולת עתיקה, השנייה ריקה. מאחוריהם דלת כספת עגולה. נראה שכאן לא מוצאים ערך. מייצרים אותו.",
  },
  "j.vault": {
    title: "הכספת נפתחת",
    body: "המאזניים התאזנו, והצורה נתנה למפתח גוף. הדלת הכבדה התגלגלה הצידה. בפנים לא היה אוצר, רק רסיס אחד של אור.",
  },
  "j.shard": {
    title: "הרסיס השישי",
    body: "הרסיס האחרון של השבר הראשון. כשהחזקתי אותו, הרגשתי את חמשת האחרים קוראים לו. הם מחכים במקום שבו הכול התחיל.",
  },
  "j.restored": {
    title: "הבריאה מתאחה",
    body: "שש הממלכות ענו יחד. האור עבר בין החותמות ונאסף בשבר המקור, והשבר נעשה שלם. הבריאה לא חזרה להיות מה שהייתה. היא נעשתה משהו שבנינו יחד. וזה רק הפרק הראשון.",
  },
};
