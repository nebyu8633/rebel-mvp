import { describe, expect, it } from "vitest";

import { parsePackSize } from "./parsePackSize";

describe("parsePackSize", () => {
  it("parses Hebrew pack sizes", () => {
    expect(parsePackSize('חזה עוף 10 ק"ג')).toMatchObject({ value: 10, unit: "kg" });
    expect(parsePackSize("שמן זית 1 ליטר")).toMatchObject({ value: 1, unit: "liter" });
    expect(parsePackSize("סוכר 500 גרם")).toMatchObject({ value: 500, unit: "g" });
    expect(parsePackSize('רוטב 750 מ"ל')).toMatchObject({ value: 750, unit: "ml" });
  });

  it("parses English pack sizes with and without a space", () => {
    expect(parsePackSize("Chicken Breast 10KG")).toMatchObject({ value: 10, unit: "kg" });
    expect(parsePackSize("Olive Oil 5 L")).toMatchObject({ value: 5, unit: "liter" });
    expect(parsePackSize("Sugar 500g")).toMatchObject({ value: 500, unit: "g" });
  });

  it("parses decimal pack sizes written with a dot or a comma", () => {
    expect(parsePackSize("גבינה 2.5 קג")).toMatchObject({ value: 2.5, unit: "kg" });
    expect(parsePackSize("גבינה 2,5 קג")).toMatchObject({ value: 2.5, unit: "kg" });
  });

  it("returns null when there is no pack size to read", () => {
    expect(parsePackSize("חזה עוף טרי")).toBeNull();
    expect(parsePackSize("Entrecote")).toBeNull();
    expect(parsePackSize("")).toBeNull();
  });

  it("does not read a bare number as a pack size", () => {
    // "מארז 6" gives no unit, so there is nothing to normalize against.
    expect(parsePackSize("ביצים מארז 6")).toBeNull();
  });

  it("refuses ambiguous names carrying two different pack sizes", () => {
    // Picking either one would be a guess.
    expect(parsePackSize("שמן 1 ליטר מארז 6 ליטר")).toBeNull();
  });

  it("accepts a name that repeats the same pack size", () => {
    expect(parsePackSize("שמן 1 ליטר (1 ליטר)")).toMatchObject({ value: 1, unit: "liter" });
  });

  it("does not match a unit glued to a longer word", () => {
    // "500 גרמושקה" is not 500 grams.
    expect(parsePackSize("מוצר 500 גרמושקה")).toBeNull();
  });
});
