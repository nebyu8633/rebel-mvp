/**
 * Demo Mode dataset (spec §62).
 *
 * Development only, gated behind NEXT_PUBLIC_DEMO_MODE, and never mixed with
 * real user data: nothing here is ever written to the database, and the demo
 * route reads only from this file.
 *
 * The restaurant, suppliers and products are openly fictional and every
 * surface that renders them carries the "נתוני דמו" badge, so a demo figure
 * can never be mistaken for a real one.
 *
 * The numbers are internally consistent — each opportunity's annual figure is
 * genuinely (current − reference) × annual quantity — so the demo exercises
 * the same rendering paths as real data rather than displaying arbitrary
 * values.
 */
import type { SavingsRow } from "@/components/results/SavingsTable";
import { toScaledUnitPrice } from "@/lib/savings/money";

export const DEMO_BUSINESS_NAME = "מסעדת דמו";

function opportunity(
  id: string,
  productName: string,
  supplierName: string,
  referenceShekels: number,
  currentShekels: number,
  baseUnit: string,
  annualQuantity: number,
  confidence: number,
): SavingsRow {
  const reference = toScaledUnitPrice(referenceShekels);
  const current = toScaledUnitPrice(currentShekels);

  return {
    id,
    productName,
    supplierName,
    currentUnitPrice: current,
    referenceUnitPrice: reference,
    priceDifference: current - reference,
    percentageChange: (current - reference) / reference,
    baseUnit,
    // Agorot, matching how the savings engine computes it.
    annualOpportunityAgorot: Math.round(
      (currentShekels - referenceShekels) * annualQuantity * 100,
    ),
    confidence,
    isAnnualized: true,
  };
}

export const DEMO_OPPORTUNITIES: readonly SavingsRow[] = [
  opportunity("demo-1", "אנטריקוט טרי מיוחד", "בשר הצפון", 109, 120, "kg", 480, 0.95),
  opportunity("demo-2", "חזה עוף טרי", "עוף הכפר", 28, 31.5, "kg", 1040, 0.92),
  opportunity("demo-3", "שמן זית כתית", "מזון ים תיכוני", 42, 47, "liter", 260, 0.88),
  opportunity("demo-4", "עגבניות שרי", "ירקות השוק", 12.5, 14.2, "kg", 620, 0.9),
  opportunity("demo-5", "גבינת מוצרלה", "חלב העמק", 34, 36.8, "kg", 400, 0.87),
];

export const DEMO_SUMMARY = {
  invoiceCount: 3,
  productCount: 12,
  supplierCount: 5,
  opportunityCount: DEMO_OPPORTUNITIES.length,
  totalAnnualAgorot: DEMO_OPPORTUNITIES.reduce(
    (sum, row) => sum + row.annualOpportunityAgorot,
    0,
  ),
};
