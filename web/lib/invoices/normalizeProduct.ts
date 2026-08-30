/**
 * Product normalization (spec §20, §21, §22).
 *
 * Turns a raw invoice line into something comparable, or explains why it is
 * not. Two independent jobs:
 *
 *  1. Identity — which product is this? Exact normalized-name match only.
 *     "Chicken Breast 10KG" and "Chicken Breast 10 kg" collapse to one
 *     product because the difference is pure formatting. "חזה עוף טרי" and
 *     "חזה עוף קפוא" do not, and must not: fresh and frozen are different
 *     goods at different prices, and merging them invents a price change that
 *     never happened.
 *
 *  2. Price comparability — restate the price per base unit, so ₪100 for a
 *     10kg carton compares against ₪11/kg from another supplier.
 */
import type {
  ExtractedItem,
  NormalizedItem,
  NotComparableReason,
} from "@/types/domain";

import { unitPriceFromTotal } from "@/lib/savings/money";

import { normalizeName } from "./normalizeName";
import { getUnitInfo, normalizeUnit, toBaseQuantity } from "./normalizeUnit";
import { parsePackSize } from "./parsePackSize";

/**
 * Specification markers that must keep products apart even when the rest of
 * the name matches. Presence or absence of any of these makes two names
 * different products, never the same one at a different price.
 */
const SPECIFICATION_MARKERS: readonly string[] = [
  "טרי",
  "קפוא",
  "מצונן",
  "אורגני",
  "מיוחד",
  "פרימיום",
  "מיובש",
  "מעושן",
  "טחון",
  "שלם",
  "פרוס",
  "fresh",
  "frozen",
  "chilled",
  "organic",
  "premium",
  "dried",
  "smoked",
  "ground",
  "whole",
  "sliced",
];

/**
 * The specification markers present in a name, normalized and sorted.
 * Part of the product's identity, so a grade change never reads as a price
 * change on the same product.
 */
export function extractSpecification(rawName: string): string[] {
  const normalized = normalizeName(rawName);
  const tokens = new Set(normalized.split(" "));
  return SPECIFICATION_MARKERS.filter((marker) =>
    tokens.has(normalizeName(marker)),
  ).sort();
}

/**
 * The key two line items must share to be treated as the same product.
 *
 * Scoped per business and supplier by the caller — a product key is never
 * compared across businesses (data isolation) or across suppliers (different
 * suppliers price different goods under similar names).
 */
export function productKey(rawName: string): string {
  return normalizeName(rawName);
}

/**
 * Normalizes one extracted line item.
 *
 * Never throws and never guesses: anything it cannot establish comes back as
 * `comparable: false` with a reason, and the savings engine skips it.
 */
export function normalizeProduct(item: ExtractedItem): NormalizedItem {
  const normalizedName = normalizeName(item.rawProductName);
  const canonicalUnit = normalizeUnit(item.unit);
  const packSize = parsePackSize(item.rawProductName);

  const base: Omit<
    NormalizedItem,
    "baseQuantity" | "baseUnit" | "normalizedUnitPrice" | "comparable" | "notComparableReason"
  > = {
    rawProductName: item.rawProductName,
    normalizedName,
    canonicalUnit,
    packSize,
    confidence: item.confidence,
  };

  const notComparable = (reason: NotComparableReason): NormalizedItem => ({
    ...base,
    baseQuantity: null,
    baseUnit: null,
    normalizedUnitPrice: null,
    comparable: false,
    notComparableReason: reason,
  });

  // A line total is what we normalize from. Fall back to quantity × unit price
  // when the invoice only printed the per-unit figure.
  const totalPrice =
    item.totalPrice ??
    (item.unitPrice !== null && item.quantity !== null
      ? item.unitPrice * item.quantity
      : null);

  if (totalPrice === null || !Number.isFinite(totalPrice) || totalPrice <= 0) {
    return notComparable("missing_price");
  }

  if (item.quantity === null || !Number.isFinite(item.quantity) || item.quantity <= 0) {
    return notComparable("missing_quantity");
  }

  // Pack size wins when present: it describes the contents, which is what we
  // actually want to price. "1 carton" of "10 ק״ג" is 10 kg.
  if (packSize !== null) {
    const packInfo = getUnitInfo(packSize.unit);
    const baseQuantity = item.quantity * toBaseQuantity(packSize.value, packSize.unit);
    const normalizedUnitPrice = unitPriceFromTotal(totalPrice, baseQuantity);

    if (normalizedUnitPrice === null) return notComparable("missing_quantity");

    return {
      ...base,
      baseQuantity,
      baseUnit: packInfo.baseUnit,
      normalizedUnitPrice,
      comparable: true,
      notComparableReason: null,
    };
  }

  if (canonicalUnit === null) {
    return notComparable("unknown_unit");
  }

  const unitInfo = getUnitInfo(canonicalUnit);

  // A container with no parseable pack size prices an unknown amount of goods.
  // It stays comparable only against the identical container for the same
  // product — which the caller enforces by matching on baseUnit.
  if (unitInfo.dimension === "container") {
    const normalizedUnitPrice = unitPriceFromTotal(totalPrice, item.quantity);
    if (normalizedUnitPrice === null) return notComparable("ambiguous_container");

    return {
      ...base,
      baseQuantity: item.quantity,
      baseUnit: unitInfo.baseUnit,
      normalizedUnitPrice,
      comparable: true,
      notComparableReason: null,
    };
  }

  const baseQuantity = toBaseQuantity(item.quantity, canonicalUnit);
  const normalizedUnitPrice = unitPriceFromTotal(totalPrice, baseQuantity);

  if (normalizedUnitPrice === null) return notComparable("missing_quantity");

  return {
    ...base,
    baseQuantity,
    baseUnit: unitInfo.baseUnit,
    normalizedUnitPrice,
    comparable: true,
    notComparableReason: null,
  };
}
