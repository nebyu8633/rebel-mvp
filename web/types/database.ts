/**
 * Database row types, mirroring supabase/migrations/0001_init.sql.
 *
 * Hand-written rather than generated so the project has no dependency on a
 * live Supabase project to type-check. If you later run
 * `supabase gen types typescript`, replace this file wholesale.
 *
 * Money columns are integers by convention:
 *   *_agorot            -> 1/100 shekel
 *   normalized_unit_price, current/reference_unit_price, price_difference
 *                       -> 1/10,000 shekel (see lib/savings/money.ts)
 */

export type AnalysisStatus = "pending" | "processing" | "complete" | "error";
export type StepStatus = "pending" | "processing" | "complete" | "error";
export type InvoiceStatus = "processed" | "needs_review" | "failed";

export type AnalysisStepKey =
  | "uploading"
  | "reading"
  | "identifying"
  | "extracting"
  | "normalizing"
  | "calculating";

export const ANALYSIS_STEP_ORDER: readonly AnalysisStepKey[] = [
  "uploading",
  "reading",
  "identifying",
  "extracting",
  "normalizing",
  "calculating",
] as const;

export type AnalysisSteps = Partial<Record<AnalysisStepKey, StepStatus>>;

export interface BusinessRow {
  id: string;
  owner_id: string;
  name: string;
  owner_name: string;
  currency: string;
  country: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierRow {
  id: string;
  business_id: string;
  name: string;
  normalized_name: string;
  created_at: string;
}

export interface ProductRow {
  id: string;
  business_id: string;
  canonical_name: string;
  normalized_name: string;
  category: string | null;
  brand: string | null;
  specification: string[];
  default_unit: string | null;
  base_unit: string | null;
  confidence: number;
  created_at: string;
}

export interface AnalysisRow {
  id: string;
  business_id: string;
  status: AnalysisStatus;
  steps: AnalysisSteps;
  error_message: string | null;
  invoice_count: number;
  product_count: number;
  supplier_count: number;
  opportunity_count: number;
  total_annual_opportunity_agorot: number;
  created_at: string;
  completed_at: string | null;
}

export interface InvoiceRow {
  id: string;
  business_id: string;
  supplier_id: string | null;
  analysis_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  currency: string;
  total_amount_agorot: number | null;
  file_path: string | null;
  file_name: string | null;
  status: InvoiceStatus;
  extraction_confidence: number | null;
  created_at: string;
}

export interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  business_id: string;
  product_id: string | null;
  raw_product_name: string;
  normalized_name: string;
  sku: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price_agorot: number | null;
  total_price_agorot: number | null;
  base_quantity: number | null;
  base_unit: string | null;
  normalized_unit_price: number | null;
  comparable: boolean;
  not_comparable_reason: string | null;
  confidence: number;
  created_at: string;
}

export interface PriceRecordRow {
  id: string;
  business_id: string;
  supplier_id: string | null;
  product_id: string;
  invoice_item_id: string | null;
  normalized_unit_price: number;
  base_unit: string;
  base_quantity: number | null;
  observed_at: string;
  confidence: number;
  created_at: string;
}

export interface BenchmarkRow {
  id: string;
  normalized_name: string;
  category: string | null;
  base_unit: string;
  benchmark_unit_price: number;
  source: string;
  region: string;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
}

export interface SavingsOpportunityRow {
  id: string;
  business_id: string;
  analysis_id: string;
  product_id: string;
  supplier_id: string | null;
  invoice_item_id: string | null;
  current_unit_price: number;
  reference_unit_price: number;
  price_difference: number;
  percentage_change: number | null;
  base_unit: string;
  observed_quantity: number;
  estimated_annual_quantity: number;
  annual_opportunity_agorot: number;
  monthly_opportunity_agorot: number;
  is_annualized: boolean;
  calculation_method: "historical" | "benchmark";
  benchmark_source: string | null;
  confidence: number;
  calculated_at: string;
}
