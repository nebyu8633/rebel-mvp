/**
 * AETHERIA canon (data, not content scripts). Pure TypeScript: no React, no three, no LifeOS UI.
 * The six kingdoms are the six existing LifeOS domains — same ids, so real-life events map 1:1.
 */
import { DOMAINS, type Domain } from "../../data/lifeos";

export type KingdomId = Domain;
export const KINGDOM_IDS: readonly KingdomId[] = DOMAINS;

export const KINGDOMS: Record<KingdomId, { title: string; color: string }> = {
  wealth: { title: "ממלכת העושר", color: "#f5b301" },
  health: { title: "ממלכת הבריאות", color: "#22c55e" },
  knowledge: { title: "ממלכת הידע", color: "#3f8cff" },
  career: { title: "ממלכת הקריירה", color: "#8b5cf6" },
  social: { title: "ממלכת החברה", color: "#ff5ea8" },
  mind: { title: "ממלכת הנפש", color: "#14b8a6" },
};

/** The three primordial forces. */
export const FORCES = ["form", "change", "connection"] as const;
export type Force = (typeof FORCES)[number];
export const FORCE_TITLES: Record<Force, string> = { form: "צורה", change: "שינוי", connection: "חיבור" };

/** The Future Echo's identities, in order. It only ever moves forward. */
export const ECHO_STAGES = ["dormant", "silent_observer", "fragmented_mind", "future_companion"] as const;
export type EchoStage = (typeof ECHO_STAGES)[number];
export const ECHO_TITLES: Record<EchoStage, string> = {
  dormant: "רדום",
  silent_observer: "הצופה השקט",
  fragmented_mind: "התודעה המפוצלת",
  future_companion: "בן הלוויה העתידי",
};

/**
 * Flag namespaces. `life:` flags may ONLY be set by validated real-life enrichment and may never
 * be required by essential content (enforced by validateQuest).
 */
export const LIFE_FLAG_PREFIX = "life:";
export const isLifeFlag = (f: string) => f.startsWith(LIFE_FLAG_PREFIX);
