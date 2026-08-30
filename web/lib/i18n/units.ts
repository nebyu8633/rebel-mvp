import { getDictionary } from "@/lib/i18n";
import type { BaseUnit } from "@/types/domain";

const dict = getDictionary();

const BASE_UNIT_LABELS: Record<BaseUnit, string> = {
  kg: dict.units.kg,
  liter: dict.units.liter,
  unit: dict.units.unit,
  box: dict.units.box,
  pack: dict.units.pack,
  case: dict.units.case,
};

/**
 * Hebrew label for a base unit, e.g. "kg" -> "ק״ג".
 *
 * Base units are stored as English identifiers because they are data, not
 * copy; this is the single place they become something a user reads.
 */
export function baseUnitLabel(baseUnit: string | null): string | null {
  if (baseUnit === null) return null;
  return BASE_UNIT_LABELS[baseUnit as BaseUnit] ?? baseUnit;
}
