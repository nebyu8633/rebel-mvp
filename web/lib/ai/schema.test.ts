import { describe, expect, it } from "vitest";

import { InvoiceExtractionSchema, sanitizeExtraction } from "./schema";

const validExtraction = {
  supplier: { rawName: "בשר הצפון", normalizedName: "בשר הצפון" },
  invoiceNumber: "10492",
  invoiceDate: "2026-06-01",
  currency: "ILS",
  subtotal: 1090,
  tax: 185.3,
  total: 1275.3,
  items: [
    {
      rawProductName: "אנטריקוט טרי מיוחד",
      quantity: 10,
      unit: 'ק"ג',
      unitPrice: 109,
      totalPrice: 1090,
      sku: null,
      confidence: 0.95,
    },
  ],
};

describe("InvoiceExtractionSchema", () => {
  it("accepts a well-formed extraction", () => {
    const result = InvoiceExtractionSchema.safeParse(validExtraction);
    expect(result.success).toBe(true);
  });

  it("accepts nulls for anything the model could not read", () => {
    const result = InvoiceExtractionSchema.safeParse({
      ...validExtraction,
      invoiceNumber: null,
      invoiceDate: null,
      subtotal: null,
      tax: null,
      total: null,
      items: [
        {
          ...validExtraction.items[0],
          quantity: null,
          unit: null,
          unitPrice: null,
          totalPrice: null,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects free text in place of structured data", () => {
    expect(InvoiceExtractionSchema.safeParse("I could not read this invoice").success).toBe(
      false,
    );
  });

  it("rejects a missing supplier", () => {
    const { supplier: _supplier, ...withoutSupplier } = validExtraction;
    expect(InvoiceExtractionSchema.safeParse(withoutSupplier).success).toBe(false);
  });

  it("rejects a confidence outside 0-1", () => {
    const result = InvoiceExtractionSchema.safeParse({
      ...validExtraction,
      items: [{ ...validExtraction.items[0], confidence: 1.5 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("sanitizeExtraction", () => {
  it("keeps a valid ISO date", () => {
    const result = sanitizeExtraction(InvoiceExtractionSchema.parse(validExtraction));
    expect(result.invoiceDate).toBe("2026-06-01");
  });

  it("discards an impossible date rather than repairing it", () => {
    // Inventing a date would corrupt the price history every comparison reads.
    const parsed = InvoiceExtractionSchema.parse({
      ...validExtraction,
      invoiceDate: "2026-13-45",
    });
    expect(sanitizeExtraction(parsed).invoiceDate).toBeNull();
  });

  it("discards a non-ISO date format", () => {
    const parsed = InvoiceExtractionSchema.parse({
      ...validExtraction,
      invoiceDate: "01/06/2026",
    });
    expect(sanitizeExtraction(parsed).invoiceDate).toBeNull();
  });

  it("nulls out a non-positive quantity", () => {
    const parsed = InvoiceExtractionSchema.parse({
      ...validExtraction,
      items: [{ ...validExtraction.items[0], quantity: 0 }],
    });
    expect(sanitizeExtraction(parsed).items[0]!.quantity).toBeNull();
  });

  it("nulls out a negative price", () => {
    const parsed = InvoiceExtractionSchema.parse({
      ...validExtraction,
      items: [{ ...validExtraction.items[0], unitPrice: -5 }],
    });
    expect(sanitizeExtraction(parsed).items[0]!.unitPrice).toBeNull();
  });

  it("keeps a legitimate zero price", () => {
    // A free or comped line is real data, not an error.
    const parsed = InvoiceExtractionSchema.parse({
      ...validExtraction,
      items: [{ ...validExtraction.items[0], totalPrice: 0 }],
    });
    expect(sanitizeExtraction(parsed).items[0]!.totalPrice).toBe(0);
  });
});
