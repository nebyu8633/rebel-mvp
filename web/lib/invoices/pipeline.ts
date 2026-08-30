import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { extractInvoiceData } from "@/lib/ai/extractInvoiceData";
import { ExtractionError } from "@/lib/ai/provider";
import type { InvoiceExtraction } from "@/lib/ai/schema";
import { getMinConfidence, getPriceHistoryWindowDays } from "@/lib/config/env";
import { normalizeName } from "@/lib/invoices/normalizeName";
import { extractSpecification, normalizeProduct } from "@/lib/invoices/normalizeProduct";
import { calculateSavings } from "@/lib/savings/calculateSavings";
import { meanScaledPrice, toAgorot } from "@/lib/savings/money";
import { invoiceObjectPath, uploadInvoiceFile } from "@/lib/supabase/storage";
import type {
  AnalysisStepKey,
  AnalysisSteps,
  InvoiceStatus,
  PriceRecordRow,
  StepStatus,
} from "@/types/database";
import type { ExtractedItem, NormalizedItem } from "@/types/domain";

export interface PipelineFile {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}

/**
 * Runs one analysis end to end: store the files, read them, match suppliers
 * and products, record prices, and compute savings.
 *
 * Uses the service-role client, so RLS is NOT enforcing isolation here —
 * every query filters by `businessId` explicitly. That is the reason this
 * function takes a business id rather than reading one from a session.
 */
export async function runAnalysis(
  admin: SupabaseClient,
  businessId: string,
  analysisId: string,
  files: readonly PipelineFile[],
): Promise<void> {
  const steps: AnalysisSteps = {};

  const setStep = async (key: AnalysisStepKey, status: StepStatus) => {
    steps[key] = status;
    await admin.from("analyses").update({ steps }).eq("id", analysisId);
  };

  try {
    await admin
      .from("analyses")
      .update({ status: "processing", steps })
      .eq("id", analysisId);

    await setStep("uploading", "processing");
    const stored = await storeFiles(admin, businessId, analysisId, files);
    await setStep("uploading", "complete");

    await setStep("reading", "processing");
    const readResults = await readInvoices(stored);
    await setStep("reading", readResults.some((r) => r.extraction !== null) ? "complete" : "error");

    // Every document failed to read. Nothing downstream can run, so stop here
    // with a clear reason rather than producing an empty analysis.
    if (readResults.every((result) => result.extraction === null)) {
      await admin
        .from("analyses")
        .update({
          status: "error",
          steps,
          error_message: "extraction_failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", analysisId);
      return;
    }

    await setStep("identifying", "processing");
    const persisted = await persistInvoices(admin, businessId, analysisId, readResults);
    await setStep("identifying", "complete");
    await setStep("extracting", "complete");

    await setStep("normalizing", "processing");
    await recordPrices(admin, businessId, persisted);
    await setStep("normalizing", "complete");

    await setStep("calculating", "processing");
    const opportunityCount = await computeSavings(admin, businessId, analysisId, persisted);
    await setStep("calculating", "complete");

    const totals = await summarize(admin, businessId, analysisId);

    await admin
      .from("analyses")
      .update({
        status: "complete",
        steps,
        invoice_count: totals.invoiceCount,
        product_count: totals.productCount,
        supplier_count: totals.supplierCount,
        opportunity_count: opportunityCount,
        total_annual_opportunity_agorot: totals.totalAgorot,
        completed_at: new Date().toISOString(),
      })
      .eq("id", analysisId);
  } catch (error) {
    // The user never sees this string — the UI maps `error_message` to Hebrew
    // copy. It exists so a failure is diagnosable from the row alone.
    const reason = error instanceof ExtractionError ? error.reason : "unexpected_error";

    await admin
      .from("analyses")
      .update({
        status: "error",
        steps,
        error_message: reason,
        completed_at: new Date().toISOString(),
      })
      .eq("id", analysisId);
  }
}

interface StoredFile extends PipelineFile {
  invoiceId: string;
  storagePath: string | null;
}

/**
 * Writes each file to the private bucket under its own invoice id.
 *
 * A storage failure does not abort the analysis: the extraction still has the
 * bytes in memory, and a saved analysis without its source file is far more
 * useful than no analysis at all. `file_path` stays null in that case.
 */
async function storeFiles(
  admin: SupabaseClient,
  businessId: string,
  analysisId: string,
  files: readonly PipelineFile[],
): Promise<StoredFile[]> {
  const stored: StoredFile[] = [];

  for (const file of files) {
    const invoiceId = crypto.randomUUID();
    const path = invoiceObjectPath(businessId, invoiceId, file.fileName);
    const result = await uploadInvoiceFile(admin, path, file.bytes, file.mimeType);

    stored.push({
      ...file,
      invoiceId,
      storagePath: result.ok ? path : null,
    });
  }

  void analysisId;
  return stored;
}

interface ReadResult extends StoredFile {
  extraction: InvoiceExtraction | null;
}

/** Reads each document. One unreadable file does not fail the others. */
async function readInvoices(files: readonly StoredFile[]): Promise<ReadResult[]> {
  const results: ReadResult[] = [];

  for (const file of files) {
    try {
      const extraction = await extractInvoiceData({
        data: file.bytes,
        mimeType: file.mimeType,
        fileName: file.fileName,
      });
      results.push({ ...file, extraction });
    } catch {
      results.push({ ...file, extraction: null });
    }
  }

  return results;
}

interface PersistedItem {
  invoiceItemId: string;
  productId: string;
  supplierId: string;
  invoiceDate: string;
  normalized: NormalizedItem;
}

/**
 * Saves suppliers, products, invoices and line items.
 *
 * Supplier and product identity are resolved by exact normalized name, scoped
 * to this business — the conservative matching the spec requires. A name that
 * does not match exactly becomes a new product rather than being folded into
 * an existing one.
 */
async function persistInvoices(
  admin: SupabaseClient,
  businessId: string,
  analysisId: string,
  results: readonly ReadResult[],
): Promise<PersistedItem[]> {
  const persisted: PersistedItem[] = [];

  for (const result of results) {
    const { extraction } = result;

    if (extraction === null) {
      await admin.from("invoices").insert({
        id: result.invoiceId,
        business_id: businessId,
        analysis_id: analysisId,
        file_path: result.storagePath,
        file_name: result.fileName,
        status: "failed" satisfies InvoiceStatus,
      });
      continue;
    }

    const supplierId = await resolveSupplier(admin, businessId, extraction.supplier.rawName);

    // Duplicate guard: same business, same supplier, same invoice number.
    if (extraction.invoiceNumber !== null) {
      const { data: duplicate } = await admin
        .from("invoices")
        .select("id")
        .eq("business_id", businessId)
        .eq("supplier_id", supplierId)
        .eq("invoice_number", extraction.invoiceNumber)
        .maybeSingle();

      if (duplicate !== null) continue;
    }

    const invoiceDate = extraction.invoiceDate ?? new Date().toISOString().slice(0, 10);

    const averageConfidence =
      extraction.items.reduce((sum, item) => sum + item.confidence, 0) /
      extraction.items.length;

    // An invoice we could read but that carries no usable prices is flagged
    // for review rather than silently counted as processed.
    const hasPrices = extraction.items.some(
      (item) => item.totalPrice !== null || item.unitPrice !== null,
    );

    await admin.from("invoices").insert({
      id: result.invoiceId,
      business_id: businessId,
      supplier_id: supplierId,
      analysis_id: analysisId,
      invoice_number: extraction.invoiceNumber,
      invoice_date: extraction.invoiceDate,
      currency: extraction.currency ?? "ILS",
      total_amount_agorot: extraction.total !== null ? toAgorot(extraction.total) : null,
      file_path: result.storagePath,
      file_name: result.fileName,
      status: (hasPrices ? "processed" : "needs_review") satisfies InvoiceStatus,
      extraction_confidence: averageConfidence,
    });

    for (const item of extraction.items) {
      const extracted: ExtractedItem = {
        rawProductName: item.rawProductName,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        sku: item.sku,
        confidence: item.confidence,
      };

      const normalized = normalizeProduct(extracted);
      const productId = await resolveProduct(admin, businessId, normalized);

      const invoiceItemId = crypto.randomUUID();
      await admin.from("invoice_items").insert({
        id: invoiceItemId,
        invoice_id: result.invoiceId,
        business_id: businessId,
        product_id: productId,
        raw_product_name: normalized.rawProductName,
        normalized_name: normalized.normalizedName,
        sku: item.sku,
        quantity: item.quantity,
        unit: item.unit,
        unit_price_agorot: item.unitPrice !== null ? toAgorot(item.unitPrice) : null,
        total_price_agorot: item.totalPrice !== null ? toAgorot(item.totalPrice) : null,
        base_quantity: normalized.baseQuantity,
        base_unit: normalized.baseUnit,
        normalized_unit_price: normalized.normalizedUnitPrice,
        comparable: normalized.comparable,
        not_comparable_reason: normalized.notComparableReason,
        confidence: normalized.confidence,
      });

      if (normalized.comparable) {
        persisted.push({
          invoiceItemId,
          productId,
          supplierId,
          invoiceDate,
          normalized,
        });
      }
    }
  }

  return persisted;
}

async function resolveSupplier(
  admin: SupabaseClient,
  businessId: string,
  rawName: string,
): Promise<string> {
  const normalized = normalizeName(rawName);

  const { data: existing } = await admin
    .from("suppliers")
    .select("id")
    .eq("business_id", businessId)
    .eq("normalized_name", normalized)
    .maybeSingle();

  if (existing !== null) return existing.id as string;

  const id = crypto.randomUUID();
  const { error } = await admin
    .from("suppliers")
    .insert({ id, business_id: businessId, name: rawName, normalized_name: normalized });

  // A concurrent insert loses the race against the unique index; re-read
  // rather than failing, since both requests want the same row.
  if (error !== null) {
    const { data } = await admin
      .from("suppliers")
      .select("id")
      .eq("business_id", businessId)
      .eq("normalized_name", normalized)
      .single();
    return data?.id as string;
  }

  return id;
}

async function resolveProduct(
  admin: SupabaseClient,
  businessId: string,
  normalized: NormalizedItem,
): Promise<string> {
  const { data: existing } = await admin
    .from("products")
    .select("id")
    .eq("business_id", businessId)
    .eq("normalized_name", normalized.normalizedName)
    .maybeSingle();

  if (existing !== null) return existing.id as string;

  const id = crypto.randomUUID();
  const { error } = await admin.from("products").insert({
    id,
    business_id: businessId,
    canonical_name: normalized.rawProductName,
    normalized_name: normalized.normalizedName,
    specification: extractSpecification(normalized.rawProductName),
    default_unit: normalized.canonicalUnit,
    base_unit: normalized.baseUnit,
    confidence: normalized.confidence,
  });

  if (error !== null) {
    const { data } = await admin
      .from("products")
      .select("id")
      .eq("business_id", businessId)
      .eq("normalized_name", normalized.normalizedName)
      .single();
    return data?.id as string;
  }

  return id;
}

/** Appends every comparable line to the price history. */
async function recordPrices(
  admin: SupabaseClient,
  businessId: string,
  items: readonly PersistedItem[],
): Promise<void> {
  const rows = items
    .filter((item) => item.normalized.normalizedUnitPrice !== null)
    .map((item) => ({
      business_id: businessId,
      supplier_id: item.supplierId,
      product_id: item.productId,
      invoice_item_id: item.invoiceItemId,
      normalized_unit_price: item.normalized.normalizedUnitPrice,
      base_unit: item.normalized.baseUnit,
      base_quantity: item.normalized.baseQuantity,
      observed_at: item.invoiceDate,
      confidence: item.normalized.confidence,
    }));

  if (rows.length > 0) await admin.from("price_records").insert(rows);
}

/**
 * Compares each line against its own history and writes any opportunities.
 *
 * Mode A (historical) only: the `benchmarks` table ships empty, and the spec
 * forbids inventing a market price. When a benchmark source is loaded, this is
 * where Mode B would slot in.
 */
async function computeSavings(
  admin: SupabaseClient,
  businessId: string,
  analysisId: string,
  items: readonly PersistedItem[],
): Promise<number> {
  const minConfidence = getMinConfidence();
  const windowDays = getPriceHistoryWindowDays();
  const rows: Record<string, unknown>[] = [];

  for (const item of items) {
    const currentPrice = item.normalized.normalizedUnitPrice;
    if (currentPrice === null) continue;

    // A line the model was unsure of never drives an automatic conclusion.
    if (item.normalized.confidence < minConfidence) continue;

    const cutoff = new Date(item.invoiceDate);
    cutoff.setDate(cutoff.getDate() - windowDays);

    const { data: history } = await admin
      .from("price_records")
      .select("normalized_unit_price, observed_at, base_unit")
      .eq("business_id", businessId)
      .eq("supplier_id", item.supplierId)
      .eq("product_id", item.productId)
      .neq("invoice_item_id", item.invoiceItemId)
      .gte("observed_at", cutoff.toISOString().slice(0, 10))
      .lte("observed_at", item.invoiceDate)
      .order("observed_at", { ascending: false });

    const priorRecords = ((history ?? []) as Pick<
      PriceRecordRow,
      "normalized_unit_price" | "observed_at" | "base_unit"
    >[])
      // Only compare like with like: a price per kg is not a price per carton.
      .filter((record) => record.base_unit === item.normalized.baseUnit);

    if (priorRecords.length === 0) continue;

    const priorPrices = priorRecords.map((record) => record.normalized_unit_price);
    const referencePrice =
      priorPrices.length === 1
        ? (priorPrices[0] as number)
        : (meanScaledPrice(priorPrices) as number);

    const observedDates = priorRecords.map((record) => record.observed_at);
    const periodDays = observationPeriodDays(observedDates, item.invoiceDate);

    const opportunity = calculateSavings({
      currentUnitPrice: currentPrice,
      referenceUnitPrice: referencePrice,
      observedQuantity: item.normalized.baseQuantity ?? 0,
      observationPeriodDays: periodDays,
      calculationMethod: "historical",
      benchmarkSource: null,
      confidence: item.normalized.confidence,
    });

    // null means the price did not rise. That is not an opportunity, and no
    // row is written for it.
    if (opportunity === null) continue;

    rows.push({
      business_id: businessId,
      analysis_id: analysisId,
      product_id: item.productId,
      supplier_id: item.supplierId,
      invoice_item_id: item.invoiceItemId,
      current_unit_price: currentPrice,
      reference_unit_price: referencePrice,
      price_difference: opportunity.priceDifference,
      percentage_change: opportunity.percentageChange,
      base_unit: item.normalized.baseUnit,
      observed_quantity: item.normalized.baseQuantity ?? 0,
      estimated_annual_quantity: opportunity.estimatedAnnualQuantity,
      annual_opportunity_agorot: opportunity.annualOpportunity,
      monthly_opportunity_agorot: opportunity.monthlyOpportunity,
      is_annualized: opportunity.isAnnualized,
      calculation_method: opportunity.calculationMethod,
      benchmark_source: opportunity.benchmarkSource,
      confidence: opportunity.confidence,
      calculated_at: opportunity.calculatedAt,
    });
  }

  if (rows.length > 0) await admin.from("savings_opportunities").insert(rows);
  return rows.length;
}

/**
 * Days between the earliest observation and the current invoice.
 *
 * Returns null when that span is zero, so the savings engine reports observed
 * volume rather than extrapolating from no elapsed time.
 */
function observationPeriodDays(
  observedDates: readonly string[],
  currentDate: string,
): number | null {
  if (observedDates.length === 0) return null;

  const timestamps = observedDates
    .map((date) => Date.parse(date))
    .filter((value) => Number.isFinite(value));
  if (timestamps.length === 0) return null;

  const earliest = Math.min(...timestamps);
  const current = Date.parse(currentDate);
  if (!Number.isFinite(current)) return null;

  const days = Math.round((current - earliest) / (1000 * 60 * 60 * 24));
  return days > 0 ? days : null;
}

async function summarize(
  admin: SupabaseClient,
  businessId: string,
  analysisId: string,
): Promise<{
  invoiceCount: number;
  productCount: number;
  supplierCount: number;
  totalAgorot: number;
}> {
  const { data: invoices } = await admin
    .from("invoices")
    .select("id, supplier_id")
    .eq("business_id", businessId)
    .eq("analysis_id", analysisId);

  const invoiceIds = (invoices ?? []).map((row) => row.id as string);
  const supplierIds = new Set(
    (invoices ?? []).map((row) => row.supplier_id).filter((id) => id !== null),
  );

  let productCount = 0;
  if (invoiceIds.length > 0) {
    const { data: items } = await admin
      .from("invoice_items")
      .select("product_id")
      .eq("business_id", businessId)
      .in("invoice_id", invoiceIds);

    productCount = new Set(
      (items ?? []).map((row) => row.product_id).filter((id) => id !== null),
    ).size;
  }

  const { data: opportunities } = await admin
    .from("savings_opportunities")
    .select("annual_opportunity_agorot")
    .eq("business_id", businessId)
    .eq("analysis_id", analysisId);

  const totalAgorot = (opportunities ?? []).reduce(
    (sum, row) => sum + (row.annual_opportunity_agorot as number),
    0,
  );

  return {
    invoiceCount: invoiceIds.length,
    productCount,
    supplierCount: supplierIds.size,
    totalAgorot,
  };
}
