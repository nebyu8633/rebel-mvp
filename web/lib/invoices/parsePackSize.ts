/**
 * Pack-size parsing (spec §22).
 *
 * Supplier invoices routinely price a container while writing its contents
 * into the product name: "חזה עוף 10 ק״ג" billed as 1 קרטון at ₪100. Without
 * parsing the "10 ק״ג" out of the name, that reads as ₪100 per carton and
 * cannot be compared against ₪11/kg from another supplier.
 *
 * The parser is deliberately narrow. It matches a number immediately followed
 * by a known unit, and nothing else — no inference from bare numbers, no
 * "probably kilos because it's meat". An unparseable name yields `null`, which
 * downstream marks the item not-comparable rather than guessing.
 */
import type { PackSize } from "@/types/domain";

import { normalizeUnit } from "./normalizeUnit";

/**
 * Number followed by an optional space and a unit token.
 *
 * The unit alternation is ordered longest-first so that "קילוגרם" wins over
 * "קילו", and "kgs" over "kg" — a shorter alternative matching first would
 * leave a trailing fragment and change the parse.
 */
const PACK_SIZE_PATTERN = new RegExp(
  String.raw`(\d+(?:[.,]\d+)?)\s*(` +
    [
      "kilogram",
      "kilograms",
      "kgs",
      "kg",
      "kilo",
      "grams",
      "gram",
      "gr",
      "g",
      "liters",
      "litres",
      "liter",
      "litre",
      "lt",
      "l",
      "ml",
      "קילוגרם",
      "קילו",
      'ק"ג',
      "ק״ג",
      "קג",
      "גרם",
      "גר",
      "ליטר",
      'מ"ל',
      "מ״ל",
      "מל",
      "מיליליטר",
    ].join("|") +
    String.raw`)(?![\p{L}\d])`,
  "giu",
);

/**
 * Extracts a pack size from a product name.
 *
 * Returns `null` when nothing matches, or when the name is ambiguous because
 * it contains more than one distinct pack size (e.g. "שמן 1 ליטר מארז 6 ליטר")
 * — picking one of them would be a guess.
 */
export function parsePackSize(productName: string): PackSize | null {
  const normalized = productName.normalize("NFKC");
  const matches = [...normalized.matchAll(PACK_SIZE_PATTERN)];

  if (matches.length === 0) return null;

  const parsed: PackSize[] = [];
  for (const match of matches) {
    const rawValue = match[1];
    const rawUnit = match[2];
    if (rawValue === undefined || rawUnit === undefined) continue;

    const value = Number.parseFloat(rawValue.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) continue;

    const unit = normalizeUnit(rawUnit);
    if (unit === null) continue;

    parsed.push({ value, unit, matchedText: match[0].trim() });
  }

  if (parsed.length === 0) return null;

  // More than one *distinct* pack size is ambiguous; identical repeats are not.
  const distinct = new Set(parsed.map((p) => `${p.value}:${p.unit}`));
  if (distinct.size > 1) return null;

  return parsed[0] ?? null;
}
