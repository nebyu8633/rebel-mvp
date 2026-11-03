/**
 * The savings engine (spec §23, §24, §25, §59, §66).
 *
 * Deterministic by construction: given the same inputs it returns the same
 * output, and it never invents a reference price. It is handed a reference
 * that a caller has already established — either the user's own purchase
 * history (Mode A) or a real benchmark row (Mode B) — and it refuses to
 * produce a figure without one.
 *
 * Every result carries how it was calculated, from what source, at what
 * confidence, and when, so the UI can always answer "how was this calculated?"
 * without guessing.
 */
import type { CalculationMethod } from "@/types/domain";

import {
  percentageChange,
  scaledPriceTimesQuantity,
  UNIT_PRICE_SCALE,
} from "./money";

const DAYS_PER_YEAR = 365;
const MONTHS_PER_YEAR = 12;

/**
 * A period shorter than this is too small a window to extrapolate a year from
 * — two invoices three days apart do not imply 121x that volume annually.
 */
const MIN_ANNUALIZATION_PERIOD_DAYS = 14;

export interface SavingsInput {
  /** Current price per base unit, scaled (see money.ts). */
  currentUnitPrice: number;
  /** Reference price per base unit, scaled. Established by the caller. */
  referenceUnitPrice: number;
  /** Quantity observed across the analyzed invoices, in base units. */
  observedQuantity: number;
  /**
   * Days spanned by the observations backing `observedQuantity`.
   * `null` when only a single dated observation exists — the engine then
   * reports observed volume only and does not extrapolate.
   */
  observationPeriodDays: number | null;
  calculationMethod: CalculationMethod;
  /** Where a Mode B benchmark came from. Must be `null` for Mode A. */
  benchmarkSource: string | null;
  /** Extraction confidence of the current line item, 0-1. */
  confidence: number;
}

export interface SavingsOpportunity {
  /** How much more per base unit, scaled. Always positive. */
  priceDifference: number;
  /** Relative increase, e.g. 0.101 for +10.1%. */
  percentageChange: number | null;
  /**
   * Quantity the annual figure is based on, in base units. Equals
   * `observedQuantity` when `isAnnualized` is false.
   */
  estimatedAnnualQuantity: number;
  /** Annual opportunity in agorot. */
  annualOpportunity: number;
  /** Monthly opportunity in agorot — the annual figure divided by 12. */
  monthlyOpportunity: number;
  /**
   * False when there was not enough dated history to extrapolate. The UI must
   * then say the figure reflects observed purchasing volume, not a year.
   */
  isAnnualized: boolean;
  calculationMethod: CalculationMethod;
  benchmarkSource: string | null;
  confidence: number;
  calculatedAt: string;
}

/**
 * Computes a savings opportunity, or `null` when there is not one.
 *
 * Returns `null` — never a zero or negative "opportunity" — when:
 *  - the current price is at or below the reference (spec §66: a price that
 *    did not rise is not an opportunity),
 *  - either price is not a positive finite number,
 *  - the observed quantity is not positive.
 */
export function calculateSavings(
  input: SavingsInput,
  now: Date = new Date(),
): SavingsOpportunity | null {
  const {
    currentUnitPrice,
    referenceUnitPrice,
    observedQuantity,
    observationPeriodDays,
    calculationMethod,
    benchmarkSource,
    confidence,
  } = input;

  if (!Number.isFinite(currentUnitPrice) || currentUnitPrice <= 0) return null;
  if (!Number.isFinite(referenceUnitPrice) || referenceUnitPrice <= 0) return null;
  if (!Number.isFinite(observedQuantity) || observedQuantity <= 0) return null;

  // Spec §66. A price that held steady or fell is not a saving to chase.
  if (currentUnitPrice <= referenceUnitPrice) return null;

  const priceDifference = currentUnitPrice - referenceUnitPrice;

  const canAnnualize =
    observationPeriodDays !== null &&
    Number.isFinite(observationPeriodDays) &&
    observationPeriodDays >= MIN_ANNUALIZATION_PERIOD_DAYS;

  const estimatedAnnualQuantity = canAnnualize
    ? observedQuantity * (DAYS_PER_YEAR / (observationPeriodDays as number))
    : observedQuantity;

  const annualOpportunity = scaledPriceTimesQuantity(
    priceDifference,
    estimatedAnnualQuantity,
  );

  return {
    priceDifference,
    percentageChange: percentageChange(currentUnitPrice, referenceUnitPrice),
    estimatedAnnualQuantity,
    annualOpportunity,
    monthlyOpportunity: Math.round(annualOpportunity / MONTHS_PER_YEAR),
    isAnnualized: canAnnualize,
    calculationMethod,
    benchmarkSource,
    confidence,
    calculatedAt: now.toISOString(),
  };
}

/** Sums a set of opportunities into a headline annual figure, in agorot. */
export function totalAnnualOpportunity(
  opportunities: readonly SavingsOpportunity[],
): number {
  return opportunities.reduce((sum, o) => sum + o.annualOpportunity, 0);
}

/**
 * Converts a scaled unit price to shekels for display.
 * Kept here so callers never divide by the scale by hand.
 */
export function unitPriceToShekels(scaled: number): number {
  return scaled / UNIT_PRICE_SCALE;
}
