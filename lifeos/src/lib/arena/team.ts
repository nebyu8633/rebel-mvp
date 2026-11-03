/** Team composition analysis — composition matters, so the builder explains what a team can and can't do. */
import { HERO_BY_ID, ROLE_STATS } from "./heroes";
import type { HeroDef } from "./types";

export interface TeamReport {
  hp: number;
  roles: Record<"tank" | "damage" | "support", number>;
  control: number;
  sustain: number;
  burst: number;
  notes: Array<{ tone: "good" | "warn"; text: string }>;
}

function has(def: HeroDef, pred: (p: { damage?: number; heal?: number; shield?: number; status?: { type: string } }) => boolean) {
  return Object.values(def.abilities).some((a) => a.effects.some((e) => "payload" in e && e.payload && pred(e.payload)));
}

export function analyzeTeam(ids: string[]): TeamReport {
  const defs = ids.map((i) => HERO_BY_ID[i]).filter(Boolean);
  const roles = { tank: 0, damage: 0, support: 0 };
  for (const d of defs) roles[d.role]++;
  const control = defs.filter((d) => has(d, (p) => p.status?.type === "stun" || p.status?.type === "silence" || p.status?.type === "slow")).length;
  const sustain = defs.filter((d) => has(d, (p) => !!p.heal || !!p.shield)).length;
  const burst = defs.reduce((s, d) => s + Object.values(d.abilities).reduce((x, a) => x + a.effects.reduce((y, e) => y + ("payload" in e && e.payload?.damage ? e.payload.damage * ("count" in e && e.count ? e.count : 1) : 0), 0), 0), 0);
  const notes: TeamReport["notes"] = [];
  if (!roles.support) notes.push({ tone: "warn", text: "אין תומך — כמעט אין ריפוי באמצע הקרב." });
  if (!roles.tank) notes.push({ tone: "warn", text: "אין מגן — קשה להחזיק שטח ולספוג מכות." });
  if (roles.damage >= 2) notes.push({ tone: "good", text: "הרבה נזק — מתאים להפלות מהירות." });
  if (roles.tank && roles.damage && roles.support) notes.push({ tone: "good", text: "צוות מאוזן: מגן, תוקף ותומך." });
  const marks = defs.some((d) => has(d, (p) => p.status?.type === "mark"));
  if (marks && roles.damage) notes.push({ tone: "good", text: "סימון חולשה + תוקף: מכה משולבת חזקה." });
  if (defs.some((d) => has(d, (p) => p.status?.type === "power")) && roles.damage) notes.push({ tone: "good", text: "חיזוק נזק משדרג את התוקף שלך." });
  if (control >= 2) notes.push({ tone: "good", text: "הרבה שליטה (השהיה/השתקה/האטה) — טוב ללכידת קריסטלים." });
  if (new Set(defs.map((d) => d.region)).size === 3) notes.push({ tone: "good", text: "שלושה איים שונים — מגוון יכולות רחב." });
  return { hp: defs.reduce((s, d) => s + ROLE_STATS[d.role].hp, 0), roles, control, sustain, burst, notes };
}
