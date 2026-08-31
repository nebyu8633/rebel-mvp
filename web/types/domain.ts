/**
 * Core domain types shared across extraction, normalization and the savings
 * engine. These describe the *business* model, not the database rows.
 */

/** Units we can reason about after normalization. */
export type CanonicalUnit =
  | "kg"
  | "g"
  | "liter"
  | "ml"
  | "unit"
  | "box"
  | "pack"
  | "case";

/**
 * The unit two prices must share before they may be compared.
 *
 * Mass normalizes to kg and volume to liter, so ₪/g and ₪/kg are comparable.
 * Containers (box/pack/case) deliberately stay their own base: a box and a
 * pack are not interchangeable, and neither converts to a bare `unit` unless
 * a pack size tells us how many are inside.
 */
export type BaseUnit = "kg" | "liter" | "unit" | "box" | "pack" | "case";

export type Dimension = "mass" | "volume" | "count" | "container";

export interface UnitInfo {
  canonical: CanonicalUnit;
  dimension: Dimension;
  /** Multiply a quantity in `canonical` units by this to get `baseUnit`. */
  toBaseFactor: number;
  baseUnit: BaseUnit;
}

/** A pack size parsed out of a product name, e.g. "10KG" in "Chicken 10KG". */
export interface PackSize {
  value: number;
  unit: CanonicalUnit;
  /** The substring it was parsed from, for debugging and review surfaces. */
  matchedText: string;
}

/** One line item as extracted from an invoice, before any DB identity. */
export interface ExtractedItem {
  rawProductName: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  sku: string | null;
  confidence: number;
}

/**
 * A line item after normalization: the price restated per comparable base
 * unit, or an explicit reason why it cannot be compared.
 */
export interface NormalizedItem {
  rawProductName: string;
  normalizedName: string;
  canonicalUnit: CanonicalUnit | null;
  packSize: PackSize | null;
  /** Quantity restated in `baseUnit`, e.g. 2 boxes of 10kg -> 20. */
  baseQuantity: number | null;
  baseUnit: BaseUnit | null;
  /**
   * Price per one `baseUnit`, in scaled integer units
   * (see `lib/savings/money.ts` — UNIT_PRICE_SCALE).
   * `null` when the item cannot be normalized and so must never be compared.
   */
  normalizedUnitPrice: number | null;
  comparable: boolean;
  /** Why the item is not comparable — surfaced for review, never as a savings claim. */
  notComparableReason: NotComparableReason | null;
  confidence: number;
}

export type NotComparableReason =
  | "missing_price"
  | "missing_quantity"
  | "unknown_unit"
  | "ambiguous_container";

/** Which comparison produced a savings figure (spec §25, §59). */
export type CalculationMethod = "historical" | "benchmark";

export type ConfidenceBand = "high" | "medium" | "low";
