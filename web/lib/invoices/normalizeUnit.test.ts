import { describe, expect, it } from "vitest";

import {
  areUnitsComparable,
  normalizeUnit,
  toBaseQuantity,
} from "./normalizeUnit";

describe("normalizeUnit", () => {
  it("maps Hebrew kilogram spellings to kg", () => {
    for (const variant of ['ק"ג', "ק״ג", "קג", "קילו", "קילוגרם"]) {
      expect(normalizeUnit(variant)).toBe("kg");
    }
  });

  it("maps English and Hebrew variants of the same unit alike", () => {
    expect(normalizeUnit("KG")).toBe("kg");
    expect(normalizeUnit("גרם")).toBe("g");
    expect(normalizeUnit("ליטר")).toBe("liter");
    expect(normalizeUnit('מ"ל')).toBe("ml");
    expect(normalizeUnit("יח'")).toBe("unit");
    expect(normalizeUnit("יחידה")).toBe("unit");
    expect(normalizeUnit("קרטון")).toBe("box");
    expect(normalizeUnit("מארז")).toBe("pack");
    expect(normalizeUnit("ארגז")).toBe("case");
  });

  it("returns null for unknown units instead of guessing", () => {
    expect(normalizeUnit("סלסלה")).toBeNull();
    expect(normalizeUnit("שקית")).toBeNull();
    expect(normalizeUnit("")).toBeNull();
    expect(normalizeUnit(null)).toBeNull();
    expect(normalizeUnit(undefined)).toBeNull();
  });

  it("converts mass and volume to their base unit", () => {
    expect(toBaseQuantity(500, "g")).toBeCloseTo(0.5);
    expect(toBaseQuantity(2, "kg")).toBe(2);
    expect(toBaseQuantity(750, "ml")).toBeCloseTo(0.75);
    expect(toBaseQuantity(3, "liter")).toBe(3);
  });

  it("treats kg and g as comparable, kg and liter as not", () => {
    expect(areUnitsComparable("kg", "g")).toBe(true);
    expect(areUnitsComparable("liter", "ml")).toBe(true);
    expect(areUnitsComparable("kg", "liter")).toBe(false);
  });

  it("never treats a container as interchangeable with a unit or another container", () => {
    // A carton is not a piece, and a carton is not a pack. Comparing them
    // would invent a price change out of a packaging difference.
    expect(areUnitsComparable("box", "unit")).toBe(false);
    expect(areUnitsComparable("box", "pack")).toBe(false);
    expect(areUnitsComparable("pack", "case")).toBe(false);
    expect(areUnitsComparable("box", "box")).toBe(true);
  });
});
