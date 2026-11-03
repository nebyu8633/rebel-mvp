import { z } from "zod";

/**
 * The exact structure the vision model must return (spec §18).
 *
 * Two rules encoded here rather than merely requested in the prompt:
 *  - Anything not clearly printed on the invoice is `null`, never a guess.
 *  - The model returns data only. It never returns a price judgement, a
 *    benchmark, or a savings figure — those are computed downstream by
 *    deterministic code (spec CRITICAL BUSINESS RULE).
 *
 * `.nullable()` rather than `.optional()` throughout: a missing key and an
 * unreadable field are different things, and the model must say which.
 */

export const InvoiceItemSchema = z.object({
  rawProductName: z
    .string()
    .describe("The product name exactly as printed on the invoice. Never translated."),
  quantity: z.number().nullable().describe("Quantity billed, or null if unreadable."),
  unit: z
    .string()
    .nullable()
    .describe(
      "Unit of measure exactly as printed (kg, ק\"ג, יח', קרטון, ...), or null.",
    ),
  unitPrice: z.number().nullable().describe("Price per unit before tax, or null."),
  totalPrice: z.number().nullable().describe("Line total before tax, or null."),
  sku: z.string().nullable().describe("Supplier catalogue number, or null."),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("How certain you are this line was read correctly. 1 = certain."),
});

export const InvoiceExtractionSchema = z.object({
  supplier: z.object({
    rawName: z.string().describe("Supplier name exactly as printed."),
    normalizedName: z
      .string()
      .describe("Lowercase, punctuation-stripped version of the supplier name."),
  }),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z
    .string()
    .nullable()
    .describe("Invoice date as YYYY-MM-DD, or null if not clearly printed."),
  currency: z.string().nullable().describe("ISO currency code, e.g. ILS."),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  total: z.number().nullable(),
  items: z.array(InvoiceItemSchema),
});

export type InvoiceExtraction = z.infer<typeof InvoiceExtractionSchema>;
export type InvoiceExtractionItem = z.infer<typeof InvoiceItemSchema>;

/** `YYYY-MM-DD`, used to reject a plausible-looking but invalid date. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Post-validation the schema alone cannot express.
 *
 * A malformed date is discarded rather than repaired: an invoice dated
 * "2026-13-45" is unreadable, and inventing a date would silently corrupt the
 * price history that every comparison depends on.
 */
export function sanitizeExtraction(extraction: InvoiceExtraction): InvoiceExtraction {
  const date = extraction.invoiceDate;
  const dateIsValid =
    date !== null && ISO_DATE.test(date) && !Number.isNaN(Date.parse(date));

  return {
    ...extraction,
    invoiceDate: dateIsValid ? date : null,
    items: extraction.items.map((item) => ({
      ...item,
      // Clamp rather than reject: a model that returns 1.2 is expressing
      // certainty, and dropping the whole line over it would lose real data.
      confidence: Math.min(1, Math.max(0, item.confidence)),
      quantity: positiveOrNull(item.quantity),
      unitPrice: nonNegativeOrNull(item.unitPrice),
      totalPrice: nonNegativeOrNull(item.totalPrice),
    })),
  };
}

function positiveOrNull(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value > 0 ? value : null;
}

function nonNegativeOrNull(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}
