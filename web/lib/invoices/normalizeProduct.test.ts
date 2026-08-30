import { describe, expect, it } from "vitest";

import { fromScaledUnitPrice } from "@/lib/savings/money";
import type { ExtractedItem } from "@/types/domain";

import { extractSpecification, normalizeProduct, productKey } from "./normalizeProduct";

function item(overrides: Partial<ExtractedItem> = {}): ExtractedItem {
  return {
    rawProductName: "אנטריקוט",
    quantity: 10,
    unit: 'ק"ג',
    unitPrice: 109,
    totalPrice: 1090,
    sku: null,
    confidence: 0.95,
    ...overrides,
  };
}

describe("normalizeProduct — price normalization (spec §22)", () => {
  it("normalizes a carton price down to a per-kg price", () => {
    // The spec's worked example: ₪100 for 10kg is ₪10/kg.
    const result = normalizeProduct(
      item({
        rawProductName: 'חזה עוף 10 ק"ג',
        quantity: 1,
        unit: "קרטון",
        unitPrice: 100,
        totalPrice: 100,
      }),
    );

    expect(result.comparable).toBe(true);
    expect(result.baseUnit).toBe("kg");
    expect(result.baseQuantity).toBe(10);
    expect(fromScaledUnitPrice(result.normalizedUnitPrice!)).toBeCloseTo(10);
  });

  it("prices a straightforward per-kg line unchanged", () => {
    const result = normalizeProduct(item());
    expect(result.baseUnit).toBe("kg");
    expect(fromScaledUnitPrice(result.normalizedUnitPrice!)).toBeCloseTo(109);
  });

  it("makes different pack sizes of the same product directly comparable", () => {
    const tenKg = normalizeProduct(
      item({ rawProductName: "חזה עוף 10 קג", quantity: 1, unit: "קרטון", totalPrice: 100 }),
    );
    const fiveKg = normalizeProduct(
      item({ rawProductName: "חזה עוף 5 קג", quantity: 1, unit: "קרטון", totalPrice: 55 }),
    );

    expect(tenKg.baseUnit).toBe(fiveKg.baseUnit);
    expect(fromScaledUnitPrice(tenKg.normalizedUnitPrice!)).toBeCloseTo(10);
    expect(fromScaledUnitPrice(fiveKg.normalizedUnitPrice!)).toBeCloseTo(11);
  });

  it("converts grams to a per-kg price", () => {
    const result = normalizeProduct(
      item({ rawProductName: "תבלין", quantity: 500, unit: "גרם", totalPrice: 25, unitPrice: null }),
    );
    expect(result.baseUnit).toBe("kg");
    expect(result.baseQuantity).toBeCloseTo(0.5);
    expect(fromScaledUnitPrice(result.normalizedUnitPrice!)).toBeCloseTo(50);
  });

  it("multiplies pack size by quantity across several cartons", () => {
    const result = normalizeProduct(
      item({ rawProductName: "חזה עוף 10 קג", quantity: 3, unit: "קרטון", totalPrice: 300 }),
    );
    expect(result.baseQuantity).toBe(30);
    expect(fromScaledUnitPrice(result.normalizedUnitPrice!)).toBeCloseTo(10);
  });

  it("falls back to quantity x unit price when no line total was printed", () => {
    const result = normalizeProduct(item({ totalPrice: null }));
    expect(result.comparable).toBe(true);
    expect(fromScaledUnitPrice(result.normalizedUnitPrice!)).toBeCloseTo(109);
  });
});

describe("normalizeProduct — refuses to guess", () => {
  it("marks an item with no usable price as not comparable", () => {
    const result = normalizeProduct(item({ totalPrice: null, unitPrice: null }));
    expect(result.comparable).toBe(false);
    expect(result.notComparableReason).toBe("missing_price");
    expect(result.normalizedUnitPrice).toBeNull();
  });

  it("marks an item with no quantity as not comparable", () => {
    const result = normalizeProduct(item({ quantity: null }));
    expect(result.comparable).toBe(false);
    expect(result.notComparableReason).toBe("missing_quantity");
  });

  it("marks an unknown unit as not comparable rather than assuming one", () => {
    const result = normalizeProduct(
      item({ rawProductName: "עגבניות", unit: "סלסלה", totalPrice: 40 }),
    );
    expect(result.comparable).toBe(false);
    expect(result.notComparableReason).toBe("unknown_unit");
  });

  it("keeps a container with no pack size priced per container, not per unit", () => {
    // Comparable to another carton of the same product, and nothing else.
    const result = normalizeProduct(
      item({ rawProductName: "ירקות מעורבים", quantity: 2, unit: "קרטון", totalPrice: 80 }),
    );
    expect(result.comparable).toBe(true);
    expect(result.baseUnit).toBe("box");
    expect(fromScaledUnitPrice(result.normalizedUnitPrice!)).toBeCloseTo(40);
  });

  it("rejects a zero or negative quantity", () => {
    expect(normalizeProduct(item({ quantity: 0 })).comparable).toBe(false);
    expect(normalizeProduct(item({ quantity: -5 })).comparable).toBe(false);
  });
});

describe("product identity (spec §20)", () => {
  it("treats pure formatting differences as the same product", () => {
    expect(productKey("Chicken Breast 10KG")).toBe(productKey("Chicken Breast 10 kg"));
  });

  it("keeps fresh and frozen apart", () => {
    expect(productKey("חזה עוף טרי")).not.toBe(productKey("חזה עוף קפוא"));
    expect(extractSpecification("חזה עוף טרי")).toContain("טרי");
    expect(extractSpecification("חזה עוף קפוא")).toContain("קפוא");
  });

  it("keeps a specified product apart from an unspecified one", () => {
    expect(productKey("חזה עוף")).not.toBe(productKey("חזה עוף אורגני"));
    expect(extractSpecification("חזה עוף")).toEqual([]);
  });

  it("does not merge different word orders", () => {
    expect(productKey('חזה עוף 5 ק"ג')).not.toBe(productKey("עוף חזה 5KG"));
  });

  it("preserves the raw name alongside the normalized one", () => {
    const result = normalizeProduct(item({ rawProductName: 'אנטריקוט טרי מיוחד 2 ק"ג' }));
    expect(result.rawProductName).toBe('אנטריקוט טרי מיוחד 2 ק"ג');
    expect(result.normalizedName).not.toBe(result.rawProductName);
  });
});
