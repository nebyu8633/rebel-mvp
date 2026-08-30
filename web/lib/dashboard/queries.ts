import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  InvoiceRow,
  ProductRow,
  SavingsOpportunityRow,
  SupplierRow,
} from "@/types/database";

/**
 * Dashboard reads.
 *
 * All of these run through the caller's own client, so Row Level Security is
 * what scopes them — there is no `business_id` filter to forget. The service
 * role is never used for reads on behalf of a user.
 */

export interface DashboardTotals {
  invoiceCount: number;
  productCount: number;
  supplierCount: number;
  opportunityCount: number;
  totalAnnualAgorot: number;
}

export async function getDashboardTotals(
  supabase: SupabaseClient,
): Promise<DashboardTotals> {
  const [invoices, products, suppliers, opportunities] = await Promise.all([
    supabase.from("invoices").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("suppliers").select("id", { count: "exact", head: true }),
    supabase.from("savings_opportunities").select("annual_opportunity_agorot"),
  ]);

  const opportunityRows = (opportunities.data ?? []) as Pick<
    SavingsOpportunityRow,
    "annual_opportunity_agorot"
  >[];

  return {
    invoiceCount: invoices.count ?? 0,
    productCount: products.count ?? 0,
    supplierCount: suppliers.count ?? 0,
    opportunityCount: opportunityRows.length,
    totalAnnualAgorot: opportunityRows.reduce(
      (sum, row) => sum + row.annual_opportunity_agorot,
      0,
    ),
  };
}

export interface OpportunityWithNames extends SavingsOpportunityRow {
  products: Pick<ProductRow, "canonical_name" | "category"> | null;
  suppliers: Pick<SupplierRow, "name"> | null;
}

export async function getTopOpportunities(
  supabase: SupabaseClient,
  limit = 5,
): Promise<OpportunityWithNames[]> {
  const { data } = await supabase
    .from("savings_opportunities")
    .select("*, products(canonical_name, category), suppliers(name)")
    .order("annual_opportunity_agorot", { ascending: false })
    .limit(limit);

  return (data ?? []) as OpportunityWithNames[];
}

export async function getAllOpportunities(
  supabase: SupabaseClient,
): Promise<OpportunityWithNames[]> {
  const { data } = await supabase
    .from("savings_opportunities")
    .select("*, products(canonical_name, category), suppliers(name)")
    .order("annual_opportunity_agorot", { ascending: false });

  return (data ?? []) as OpportunityWithNames[];
}

export interface InvoiceWithSupplier extends InvoiceRow {
  suppliers: Pick<SupplierRow, "name"> | null;
}

export async function getRecentInvoices(
  supabase: SupabaseClient,
  limit = 5,
): Promise<InvoiceWithSupplier[]> {
  const { data } = await supabase
    .from("invoices")
    .select("*, suppliers(name)")
    .order("invoice_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as InvoiceWithSupplier[];
}

export async function getAllInvoices(
  supabase: SupabaseClient,
): Promise<InvoiceWithSupplier[]> {
  const { data } = await supabase
    .from("invoices")
    .select("*, suppliers(name)")
    .order("invoice_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return (data ?? []) as InvoiceWithSupplier[];
}

export interface ProductWithPrices extends ProductRow {
  currentUnitPrice: number | null;
  previousUnitPrice: number | null;
  supplierName: string | null;
  annualOpportunityAgorot: number;
}

/**
 * Products with their two most recent prices.
 *
 * Reads the price history once and folds it in memory rather than issuing a
 * query per product — a restaurant with a few hundred products would otherwise
 * make a few hundred round trips to render one page.
 */
export async function getProductsWithPrices(
  supabase: SupabaseClient,
): Promise<ProductWithPrices[]> {
  const [{ data: products }, { data: records }, { data: opportunities }, { data: suppliers }] =
    await Promise.all([
      supabase.from("products").select("*").order("canonical_name"),
      supabase
        .from("price_records")
        .select("product_id, supplier_id, normalized_unit_price, observed_at")
        .order("observed_at", { ascending: false }),
      supabase.from("savings_opportunities").select("product_id, annual_opportunity_agorot"),
      supabase.from("suppliers").select("id, name"),
    ]);

  const supplierNames = new Map(
    ((suppliers ?? []) as Pick<SupplierRow, "id" | "name">[]).map((s) => [s.id, s.name]),
  );

  const byProduct = new Map<
    string,
    { prices: number[]; supplierId: string | null }
  >();

  for (const record of (records ?? []) as {
    product_id: string;
    supplier_id: string | null;
    normalized_unit_price: number;
  }[]) {
    const entry = byProduct.get(record.product_id) ?? {
      prices: [],
      supplierId: record.supplier_id,
    };
    entry.prices.push(record.normalized_unit_price);
    byProduct.set(record.product_id, entry);
  }

  const opportunityTotals = new Map<string, number>();
  for (const row of (opportunities ?? []) as {
    product_id: string;
    annual_opportunity_agorot: number;
  }[]) {
    opportunityTotals.set(
      row.product_id,
      (opportunityTotals.get(row.product_id) ?? 0) + row.annual_opportunity_agorot,
    );
  }

  return ((products ?? []) as ProductRow[]).map((product) => {
    const entry = byProduct.get(product.id);
    return {
      ...product,
      currentUnitPrice: entry?.prices[0] ?? null,
      previousUnitPrice: entry?.prices[1] ?? null,
      supplierName:
        entry?.supplierId != null ? (supplierNames.get(entry.supplierId) ?? null) : null,
      annualOpportunityAgorot: opportunityTotals.get(product.id) ?? 0,
    };
  });
}

export interface PricePoint {
  observedAt: string;
  unitPrice: number;
}

/**
 * Price history for products that have enough of it to plot.
 *
 * Products with fewer than `minPoints` observations are omitted entirely
 * rather than drawn as a flat or single-point line — a chart implying a trend
 * from one data point would be inventing information (spec §38).
 */
export async function getPriceTrends(
  supabase: SupabaseClient,
  minPoints = 2,
  maxProducts = 3,
): Promise<Array<{ productName: string; baseUnit: string; points: PricePoint[] }>> {
  const { data } = await supabase
    .from("price_records")
    .select("product_id, normalized_unit_price, observed_at, base_unit, products(canonical_name)")
    .order("observed_at", { ascending: true });

  /*
   * PostgREST returns an embedded relation as an array unless it can prove the
   * relationship is one-to-one, so `products` is typed as an array here and
   * narrowed below rather than being asserted into an object shape.
   */
  const rows = (data ?? []) as unknown as Array<{
    product_id: string;
    normalized_unit_price: number;
    observed_at: string;
    base_unit: string;
    products: Array<{ canonical_name: string }> | { canonical_name: string } | null;
  }>;

  const productName = (products: (typeof rows)[number]["products"]): string => {
    if (products === null) return "—";
    if (Array.isArray(products)) return products[0]?.canonical_name ?? "—";
    return products.canonical_name;
  };

  const grouped = new Map<
    string,
    { productName: string; baseUnit: string; points: PricePoint[] }
  >();

  for (const row of rows) {
    const existing = grouped.get(row.product_id) ?? {
      productName: productName(row.products),
      baseUnit: row.base_unit,
      points: [],
    };
    existing.points.push({
      observedAt: row.observed_at,
      unitPrice: row.normalized_unit_price,
    });
    grouped.set(row.product_id, existing);
  }

  return [...grouped.values()]
    .filter((entry) => entry.points.length >= minPoints)
    .sort((a, b) => b.points.length - a.points.length)
    .slice(0, maxProducts);
}
