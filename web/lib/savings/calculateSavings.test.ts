import { describe, expect, it } from "vitest";

import { calculateSavings, totalAnnualOpportunity, type SavingsInput } from "./calculateSavings";
import { fromAgorot, toScaledUnitPrice } from "./money";

function input(overrides: Partial<SavingsInput> = {}): SavingsInput {
  return {
    currentUnitPrice: toScaledUnitPrice(120),
    referenceUnitPrice: toScaledUnitPrice(109),
    observedQuantity: 10,
    observationPeriodDays: null,
    calculationMethod: "historical",
    benchmarkSource: null,
    confidence: 0.95,
    ...overrides,
  };
}

describe("calculateSavings — the spec's worked example", () => {
  it("turns 109 -> 120 over 10kg into a ₪110 opportunity", () => {
    const result = calculateSavings(input());

    expect(result).not.toBeNull();
    expect(fromAgorot(result!.annualOpportunity)).toBeCloseTo(110);
    expect(result!.percentageChange).toBeCloseTo(0.1009, 4);
    expect(result!.isAnnualized).toBe(false);
    expect(result!.estimatedAnnualQuantity).toBe(10);
  });
});

describe("calculateSavings — no opportunity (spec §66)", () => {
  it("returns null when the current price is BELOW the reference", () => {
    const result = calculateSavings(
      input({
        currentUnitPrice: toScaledUnitPrice(100),
        referenceUnitPrice: toScaledUnitPrice(109),
      }),
    );
    expect(result).toBeNull();
  });

  it("returns null when the price did not change at all", () => {
    const result = calculateSavings(
      input({
        currentUnitPrice: toScaledUnitPrice(109),
        referenceUnitPrice: toScaledUnitPrice(109),
      }),
    );
    expect(result).toBeNull();
  });

  it("returns null rather than a zero-value opportunity", () => {
    // A zero row would still render in the table and read as a finding.
    const result = calculateSavings(
      input({ currentUnitPrice: toScaledUnitPrice(109.0) }),
    );
    expect(result).toBeNull();
  });

  it("returns null for non-positive or non-finite inputs", () => {
    expect(calculateSavings(input({ currentUnitPrice: 0 }))).toBeNull();
    expect(calculateSavings(input({ referenceUnitPrice: 0 }))).toBeNull();
    expect(calculateSavings(input({ observedQuantity: 0 }))).toBeNull();
    expect(calculateSavings(input({ observedQuantity: -5 }))).toBeNull();
    expect(calculateSavings(input({ currentUnitPrice: Number.NaN }))).toBeNull();
  });
});

describe("calculateSavings — annualization (spec §23)", () => {
  it("extrapolates to a year when the observation period supports it", () => {
    // 100kg over ~73 days -> 5x that a year: 500kg at ₪11 more = ₪5,500.
    const result = calculateSavings(
      input({ observedQuantity: 100, observationPeriodDays: 73 }),
    );

    expect(result!.isAnnualized).toBe(true);
    expect(result!.estimatedAnnualQuantity).toBeCloseTo(500);
    expect(fromAgorot(result!.annualOpportunity)).toBeCloseTo(5500);
  });

  it("does NOT extrapolate from a window too short to imply a year", () => {
    // Two invoices three days apart do not mean 121x the volume annually.
    const result = calculateSavings(
      input({ observedQuantity: 10, observationPeriodDays: 3 }),
    );

    expect(result!.isAnnualized).toBe(false);
    expect(result!.estimatedAnnualQuantity).toBe(10);
  });

  it("falls back to observed volume when there is no dated period", () => {
    const result = calculateSavings(input({ observationPeriodDays: null }));
    expect(result!.isAnnualized).toBe(false);
    expect(result!.estimatedAnnualQuantity).toBe(10);
  });

  it("derives the monthly figure from the annual one", () => {
    const result = calculateSavings(
      input({ observedQuantity: 120, observationPeriodDays: 365 }),
    );
    expect(result!.monthlyOpportunity).toBe(Math.round(result!.annualOpportunity / 12));
  });
});

describe("calculateSavings — provenance (spec §59)", () => {
  it("records a historical comparison with no benchmark source", () => {
    const result = calculateSavings(input({ calculationMethod: "historical" }));
    expect(result!.calculationMethod).toBe("historical");
    expect(result!.benchmarkSource).toBeNull();
  });

  it("records a benchmark comparison with its source", () => {
    const result = calculateSavings(
      input({ calculationMethod: "benchmark", benchmarkSource: "supplier-index-2026" }),
    );
    expect(result!.calculationMethod).toBe("benchmark");
    expect(result!.benchmarkSource).toBe("supplier-index-2026");
  });

  it("carries the extraction confidence through and stamps a time", () => {
    const now = new Date("2026-08-30T10:00:00.000Z");
    const result = calculateSavings(input({ confidence: 0.72 }), now);
    expect(result!.confidence).toBe(0.72);
    expect(result!.calculatedAt).toBe("2026-08-30T10:00:00.000Z");
  });

  it("is deterministic — identical inputs give identical output", () => {
    const now = new Date("2026-08-30T10:00:00.000Z");
    expect(calculateSavings(input(), now)).toEqual(calculateSavings(input(), now));
  });
});

describe("totalAnnualOpportunity", () => {
  it("sums opportunities into a headline figure", () => {
    const a = calculateSavings(input())!;
    const b = calculateSavings(
      input({ currentUnitPrice: toScaledUnitPrice(60), referenceUnitPrice: toScaledUnitPrice(50) }),
    )!;

    expect(fromAgorot(totalAnnualOpportunity([a, b]))).toBeCloseTo(110 + 100);
  });

  it("is zero for an empty set, not NaN", () => {
    expect(totalAnnualOpportunity([])).toBe(0);
  });
});
