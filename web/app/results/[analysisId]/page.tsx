import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ResultsView, type ResultsSummary } from "@/components/results/ResultsView";
import type { SavingsRow } from "@/components/results/SavingsTable";
import { getDictionary } from "@/lib/i18n";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AnalysisRow, SavingsOpportunityRow } from "@/types/database";

const dict = getDictionary();

export const metadata: Metadata = {
  title: `${dict.results.title} · ${dict.common.appName}`,
};

/** Results reflect a just-finished analysis, so they must never be cached. */
export const dynamic = "force-dynamic";

interface OpportunityWithNames extends SavingsOpportunityRow {
  products: { canonical_name: string } | null;
  suppliers: { name: string } | null;
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ analysisId: string }>;
}) {
  const { analysisId } = await params;
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) notFound();

  // Read through the caller's own client, so Row Level Security decides
  // visibility — another business's analysis id is simply not found.
  const { data: analysis } = await supabase
    .from("analyses")
    .select("*")
    .eq("id", analysisId)
    .maybeSingle();

  if (analysis === null) notFound();
  const row = analysis as AnalysisRow;

  const { data: opportunities } = await supabase
    .from("savings_opportunities")
    .select("*, products(canonical_name), suppliers(name)")
    .eq("analysis_id", analysisId)
    .order("annual_opportunity_agorot", { ascending: false });

  const rows: SavingsRow[] = ((opportunities ?? []) as OpportunityWithNames[]).map(
    (opportunity) => ({
      id: opportunity.id,
      productName: opportunity.products?.canonical_name ?? "—",
      supplierName: opportunity.suppliers?.name ?? null,
      currentUnitPrice: opportunity.current_unit_price,
      referenceUnitPrice: opportunity.reference_unit_price,
      priceDifference: opportunity.price_difference,
      percentageChange: opportunity.percentage_change,
      baseUnit: opportunity.base_unit,
      annualOpportunityAgorot: opportunity.annual_opportunity_agorot,
      confidence: opportunity.confidence,
      isAnnualized: opportunity.is_annualized,
    }),
  );

  const summary: ResultsSummary = {
    analysisId,
    invoiceCount: row.invoice_count,
    productCount: row.product_count,
    supplierCount: row.supplier_count,
    opportunityCount: row.opportunity_count,
    totalAnnualAgorot: row.total_annual_opportunity_agorot,
    isAnonymous: user.is_anonymous === true,
  };

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-6 py-14 sm:py-20">
      <h1 className="mb-10 text-center text-2xl font-bold tracking-tight sm:text-3xl">
        {dict.results.title}
      </h1>
      <ResultsView summary={summary} rows={rows} />
    </main>
  );
}
