import { describe, expect, it } from "vitest";

import {
  fromScaledUnitPrice,
  meanScaledPrice,
  percentageChange,
  roundHalfUp,
  scaledPriceTimesQuantity,
  toAgorot,
  toScaledUnitPrice,
  unitPriceFromTotal,
} from "./money";

describe("roundHalfUp", () => {
  it("rounds halves away from zero, symmetrically", () => {
    expect(roundHalfUp(0.5)).toBe(1);
    expect(roundHalfUp(1.5)).toBe(2);
    expect(roundHalfUp(2.5)).toBe(3);
    // Math.round would give -0 and -1 here; money rounding must not depend on sign.
    expect(roundHalfUp(-0.5)).toBe(-1);
    expect(roundHalfUp(-1.5)).toBe(-2);
  });
});

describe("scaled conversions", () => {
  it("converts shekels to integer agorot", () => {
    expect(toAgorot(12.34)).toBe(1234);
    expect(toAgorot(0.005)).toBe(1);
    expect(toAgorot(1090)).toBe(109_000);
  });

  it("holds unit prices to more precision than agorot", () => {
    // ₪0.0123/gram would round to ₪0.01 in agorot — a 22% error.
    const perGram = toScaledUnitPrice(0.0123);
    expect(fromScaledUnitPrice(perGram)).toBeCloseTo(0.0123, 4);
  });

  it("survives a round trip without drift", () => {
    for (const value of [109, 120.5, 0.75, 1234.56]) {
      expect(fromScaledUnitPrice(toScaledUnitPrice(value))).toBeCloseTo(value, 4);
    }
  });
});

describe("unitPriceFromTotal", () => {
  it("divides a total by a quantity", () => {
    expect(fromScaledUnitPrice(unitPriceFromTotal(100, 10)!)).toBeCloseTo(10);
    expect(fromScaledUnitPrice(unitPriceFromTotal(1090, 10)!)).toBeCloseTo(109);
  });

  it("returns null rather than Infinity or NaN", () => {
    expect(unitPriceFromTotal(100, 0)).toBeNull();
    expect(unitPriceFromTotal(100, -5)).toBeNull();
    expect(unitPriceFromTotal(Number.NaN, 10)).toBeNull();
    expect(unitPriceFromTotal(100, Number.NaN)).toBeNull();
  });
});

describe("percentageChange", () => {
  it("computes the spec's worked example", () => {
    // 109 -> 120 is +10.09%.
    const change = percentageChange(toScaledUnitPrice(120), toScaledUnitPrice(109));
    expect(change).toBeCloseTo(0.1009, 4);
  });

  it("is negative for a price drop", () => {
    const change = percentageChange(toScaledUnitPrice(90), toScaledUnitPrice(100));
    expect(change).toBeCloseTo(-0.1);
  });

  it("returns null for a zero reference instead of Infinity", () => {
    expect(percentageChange(toScaledUnitPrice(10), 0)).toBeNull();
  });
});

describe("scaledPriceTimesQuantity", () => {
  it("computes the spec's impact example", () => {
    // (120 - 109) x 10 = ₪110.00
    const difference = toScaledUnitPrice(120) - toScaledUnitPrice(109);
    expect(scaledPriceTimesQuantity(difference, 10)).toBe(11_000);
  });

  it("handles fractional quantities", () => {
    // (60 - 50) x 7.5 = ₪75.00
    const difference = toScaledUnitPrice(60) - toScaledUnitPrice(50);
    expect(scaledPriceTimesQuantity(difference, 7.5)).toBe(7_500);
  });
});

describe("meanScaledPrice", () => {
  it("averages historical prices", () => {
    const prices = [100, 102, 98].map(toScaledUnitPrice);
    expect(fromScaledUnitPrice(meanScaledPrice(prices)!)).toBeCloseTo(100);
  });

  it("returns null for an empty history", () => {
    expect(meanScaledPrice([])).toBeNull();
  });
});
