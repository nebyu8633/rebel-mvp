/**
 * Unit normalization for Israeli supplier invoices.
 *
 * The variant table is ported from the Python service
 * (`app/guard/matching.py`), which was built against real Hebrew invoices.
 *
 * Two rules govern this module:
 *  1. Never guess. An unrecognized unit stays unrecognized rather than being
 *     coerced into something comparable.
 *  2. Never convert across dimensions. Mass collapses to kg and volume to
 *     liter, but a box is not a unit and a pack is not a box — containers only
 *     ever compare to the identical container.
 */
import type { CanonicalUnit, UnitInfo } from "@/types/domain";

/** Punctuation stripped before lookup, so `ק"ג`, `ק״ג` and `קג` all match. */
const PUNCTUATION = /["'׳״‘’“”.,()\-_/\\\s]/g;

/** Raw invoice spelling -> canonical unit. */
const UNIT_VARIANTS: Record<string, CanonicalUnit> = {
  // mass — kilogram
  kg: "kg",
  kgs: "kg",
  kilo: "kg",
  kilogram: "kg",
  קג: "kg",
  קילו: "kg",
  קילוגרם: "kg",

  // mass — gram
  g: "g",
  gr: "g",
  gram: "g",
  grams: "g",
  גרם: "g",
  גר: "g",

  // volume — liter
  l: "liter",
  lt: "liter",
  liter: "liter",
  litre: "liter",
  liters: "liter",
  litres: "liter",
  ליטר: "liter",

  // volume — millilitre
  ml: "ml",
  מל: "ml",
  מיליליטר: "ml",

  // count — single item
  unit: "unit",
  units: "unit",
  pc: "unit",
  pcs: "unit",
  piece: "unit",
  pieces: "unit",
  יח: "unit",
  יחידה: "unit",
  יחידות: "unit",

  // containers — never interchangeable with each other or with `unit`
  box: "box",
  boxes: "box",
  קרטון: "box",
  קרטונים: "box",

  pack: "pack",
  packs: "pack",
  package: "pack",
  מארז: "pack",
  מארזים: "pack",

  case: "case",
  cases: "case",
  ארגז: "case",
  ארגזים: "case",
};

const UNIT_INFO: Record<CanonicalUnit, UnitInfo> = {
  kg: { canonical: "kg", dimension: "mass", toBaseFactor: 1, baseUnit: "kg" },
  g: { canonical: "g", dimension: "mass", toBaseFactor: 0.001, baseUnit: "kg" },
  liter: { canonical: "liter", dimension: "volume", toBaseFactor: 1, baseUnit: "liter" },
  ml: { canonical: "ml", dimension: "volume", toBaseFactor: 0.001, baseUnit: "liter" },
  unit: { canonical: "unit", dimension: "count", toBaseFactor: 1, baseUnit: "unit" },
  box: { canonical: "box", dimension: "container", toBaseFactor: 1, baseUnit: "box" },
  pack: { canonical: "pack", dimension: "container", toBaseFactor: 1, baseUnit: "pack" },
  case: { canonical: "case", dimension: "container", toBaseFactor: 1, baseUnit: "case" },
};

/**
 * Maps a raw unit string to a canonical unit, or `null` when it is not
 * recognized. Returning `null` is a feature: an unknown unit must block
 * comparison rather than be guessed at.
 */
export function normalizeUnit(rawUnit: string | null | undefined): CanonicalUnit | null {
  if (rawUnit == null) return null;

  const key = rawUnit.normalize("NFKC").replace(PUNCTUATION, "").toLowerCase();
  if (key === "") return null;

  return UNIT_VARIANTS[key] ?? null;
}

export function getUnitInfo(unit: CanonicalUnit): UnitInfo {
  return UNIT_INFO[unit];
}

/**
 * Whether two units can be compared at all. True only when they share a base
 * unit — kg vs g yes, kg vs liter no, box vs unit no.
 */
export function areUnitsComparable(a: CanonicalUnit, b: CanonicalUnit): boolean {
  return UNIT_INFO[a].baseUnit === UNIT_INFO[b].baseUnit;
}

/** Converts a quantity into its base unit (kg, liter, or the container itself). */
export function toBaseQuantity(quantity: number, unit: CanonicalUnit): number {
  return quantity * UNIT_INFO[unit].toBaseFactor;
}
