/**
 * Hero ownership — derived ONLY from verified LifeOS progression (the XP ledger):
 * - 3 starter heroes for everyone (one per role), so anyone can play right away;
 * - the Common hero of an island when that island has its first landmark (real task XP there);
 * - the Rare hero of an island from a significant milestone unlock ("hero:<island>:rare|epic");
 * - the Legendary hero of an island from a completed goal ("hero:<island>:legendary").
 * Arena matches never unlock heroes and never grant Life XP.
 */
import { HEROES, STARTER_HEROES, REGION_NAME } from "./heroes";
import type { HeroDef, RegionId } from "./types";

/** Minimal ledger shape (works with the app's XpEvent and with rows read on the server). */
export interface LedgerEntry {
  id: string;
  kind: string;
  refId: string;
  amount: number;
  region: string | null;
  title: string;
  at: string;
}

export const FIRST_LANDMARK_XP = 20;

export interface Ownership {
  hero: HeroDef;
  owned: boolean;
  source: "starter" | "island" | "milestone" | "goal" | null;
  /** How it was unlocked (or what's needed). */
  detail: string;
  at: string | null;
}

export function ownership(ledger: LedgerEntry[]): Ownership[] {
  const regionXp: Partial<Record<RegionId, number>> = {};
  for (const e of ledger) if (e.region && e.kind !== "unlock") regionXp[e.region as RegionId] = (regionXp[e.region as RegionId] ?? 0) + e.amount;
  const unlock = (ref: string) => ledger.find((e) => e.kind === "unlock" && e.refId === ref) ?? null;
  return HEROES.map((h): Ownership => {
    const island = REGION_NAME[h.region];
    if (STARTER_HEROES.includes(h.id)) return { hero: h, owned: true, source: "starter", detail: "גיבור התחלתי", at: null };
    if (h.rarity === "common") {
      const xp = regionXp[h.region] ?? 0;
      return xp >= FIRST_LANDMARK_XP
        ? { hero: h, owned: true, source: "island", detail: `נפתח עם ציון הדרך הראשון ב${island}`, at: null }
        : { hero: h, owned: false, source: null, detail: `בונים את ציון הדרך הראשון ב${island} (${xp}/${FIRST_LANDMARK_XP} XP ממשימות אמיתיות)`, at: null };
    }
    if (h.rarity === "rare" || h.rarity === "epic") {
      const u = unlock(`hero:${h.region}:rare`) ?? unlock(`hero:${h.region}:epic`);
      return u ? { hero: h, owned: true, source: "milestone", detail: u.title, at: u.at } : { hero: h, owned: false, source: null, detail: `משלימים אבן דרך משמעותית במטרה של ${island}`, at: null };
    }
    const u = unlock(`hero:${h.region}:legendary`);
    return u ? { hero: h, owned: true, source: "goal", detail: u.title, at: u.at } : { hero: h, owned: false, source: null, detail: `משיגים מטרה שלמה (עם אבני דרך) ב${island}`, at: null };
  });
}

export const ownedIds = (ledger: LedgerEntry[]) => ownership(ledger).filter((o) => o.owned).map((o) => o.hero.id);

/** Team validation used by both client and server: 3 distinct, owned heroes. */
export function validTeam(team: unknown, owned: string[]): team is string[] {
  return Array.isArray(team) && team.length === 3 && new Set(team).size === 3 && team.every((h) => typeof h === "string" && owned.includes(h));
}

/** Hero level from Hero XP (arena only). Levels are cosmetic in competitive play — stats are normalized. */
export function heroLevel(xp: number) {
  let level = 1;
  let need = 60;
  let rest = xp;
  while (rest >= need && level < 30) {
    rest -= need;
    level++;
    need = Math.round(60 * Math.pow(level, 1.25));
  }
  return { level, into: rest, need };
}

/** Elo-style rating change (server side). */
export function ratingDelta(mine: number, theirs: number, score: 0 | 0.5 | 1, k = 28) {
  const expected = 1 / (1 + Math.pow(10, (theirs - mine) / 400));
  return Math.round(k * (score - expected));
}
