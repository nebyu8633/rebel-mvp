/**
 * Money arithmetic.
 *
 * Every financial figure in this product is deterministic (spec §CRITICAL
 * BUSINESS RULE): the LLM extracts numbers, this module and the savings engine
 * decide what they mean. Floats are converted to scaled integers once, at the
 * boundary, with explicit half-up rounding — then all arithmetic is integer,
 * mirroring the `Decimal` discipline of the Python service.
 *
 * Two scales are in play:
 *  - AGOROT_SCALE (100) for totals and displayed prices. ₪12.34 -> 1234.
 *  - UNIT_PRICE_SCALE (10_000) for normalized unit prices, which need more
 *    precision than agorot: ₪0.0123 per gram is a real price and would round
 *    to ₪0.01 in agorot, a 22% error.
 */

/** 1 shekel = 100 agorot. */
export const AGOROT_SCALE = 100;

/** Normalized unit prices are held to 1/10,000 of a shekel. */
export const UNIT_PRICE_SCALE = 10_000;

/**
 * Half-up rounding, symmetric around zero.
 *
 * `Math.round` breaks ties toward +Infinity, so -0.5 becomes -0 rather than -1
 * and a price drop would round differently from the equivalent rise. Money
 * rounding must not depend on sign.
 */
export function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Shekels (float, e.g. from extracted JSON) -> integer agorot. */
export function toAgorot(shekels: number): number {
  return roundHalfUp(shekels * AGOROT_SCALE);
}

/** Integer agorot -> shekels, for display formatting only. */
export function fromAgorot(agorot: number): number {
  return agorot / AGOROT_SCALE;
}

/** Shekels -> scaled integer unit price. */
export function toScaledUnitPrice(shekels: number): number {
  return roundHalfUp(shekels * UNIT_PRICE_SCALE);
}

/** Scaled integer unit price -> shekels, for display formatting only. */
export function fromScaledUnitPrice(scaled: number): number {
  return scaled / UNIT_PRICE_SCALE;
}

/**
 * Divides a total (in shekels) by a quantity to get a scaled unit price.
 * Returns `null` for a non-positive or non-finite quantity rather than
 * producing Infinity or NaN.
 */
export function unitPriceFromTotal(
  totalShekels: number,
  quantity: number,
): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (!Number.isFinite(totalShekels)) return null;
  return toScaledUnitPrice(totalShekels / quantity);
}

/**
 * Multiplies a scaled unit price by a quantity and returns agorot.
 * Used to turn "₪11 more per kg × 1,200 kg a year" into an annual figure.
 */
export function scaledPriceTimesQuantity(
  scaledUnitPrice: number,
  quantity: number,
): number {
  const shekels = (scaledUnitPrice / UNIT_PRICE_SCALE) * quantity;
  return toAgorot(shekels);
}

/**
 * Relative change from `reference` to `current`, as a ratio (0.101 = +10.1%).
 * Returns `null` when the reference is zero — a percentage change from nothing
 * is undefined, and reporting one would be a fabricated number.
 */
export function percentageChange(
  currentScaled: number,
  referenceScaled: number,
): number | null {
  if (referenceScaled === 0) return null;
  return (currentScaled - referenceScaled) / referenceScaled;
}

/** Arithmetic mean of scaled prices, rounded back to a scaled integer. */
export function meanScaledPrice(scaledPrices: readonly number[]): number | null {
  if (scaledPrices.length === 0) return null;
  const total = scaledPrices.reduce((sum, price) => sum + price, 0);
  return roundHalfUp(total / scaledPrices.length);
}
