"use client";

import { FileSearch } from "lucide-react";
import { useEffect, useState } from "react";

import { HowWasThisCalculated } from "@/components/results/HowWasThisCalculated";
import { ProductDetailPanel } from "@/components/results/ProductDetailPanel";
import { SavingsHero } from "@/components/results/SavingsHero";
import { SavingsTable, type SavingsRow } from "@/components/results/SavingsTable";
import { TopOpportunitiesChart } from "@/components/results/TopOpportunitiesChart";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { track } from "@/lib/analytics/track";
import { formatNumber } from "@/lib/format/currency";
import { getDictionary } from "@/lib/i18n";
import { averageConfidence, confidenceLabel } from "@/lib/savings/confidence";

const dict = getDictionary();

export interface ResultsSummary {
  analysisId: string;
  invoiceCount: number;
  productCount: number;
  supplierCount: number;
  opportunityCount: number;
  totalAnnualAgorot: number;
  isAnonymous: boolean;
}

export function ResultsView({
  summary,
  rows,
}: {
  summary: ResultsSummary;
  rows: readonly SavingsRow[];
}) {
  const [selected, setSelected] = useState<SavingsRow | null>(null);

  useEffect(() => {
    track("results_viewed", {
      analysisId: summary.analysisId,
      opportunityCount: summary.opportunityCount,
    });
  }, [summary.analysisId, summary.opportunityCount]);

  const confidence = averageConfidence(rows.map((row) => row.confidence));

  return (
    <div className="space-y-10">
      <SavingsHero annualAgorot={summary.totalAnnualAgorot} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label={dict.results.summary.invoices} value={summary.invoiceCount} />
        <Stat label={dict.results.summary.products} value={summary.productCount} />
        <Stat label={dict.results.summary.suppliers} value={summary.supplierCount} />
        <Stat label={dict.results.summary.opportunities} value={summary.opportunityCount} />
        <Stat
          label={dict.results.summary.confidence}
          text={confidence !== null ? confidenceLabel(confidence) : "—"}
        />
      </section>

      {rows.length === 0 ? (
        /*
         * No opportunities is a real, honest outcome — most often a first
         * analysis with nothing to compare against. It says what happened and
         * what would change it, rather than showing an invented figure.
         */
        <EmptyState
          icon={<FileSearch className="size-8" aria-hidden="true" />}
          title={dict.results.noOpportunitiesTitle}
          body={dict.results.noOpportunitiesBody}
          action={<ButtonLink href="/analyze">{dict.dashboard.uploadCta}</ButtonLink>}
        />
      ) : (
        <>
          <TopOpportunitiesChart rows={rows} />

          <section>
            <h2 className="mb-4 text-base font-semibold">{dict.results.tableTitle}</h2>
            <SavingsTable rows={rows} onSelect={setSelected} />
          </section>
        </>
      )}

      <HowWasThisCalculated method={rows.length > 0 ? "historical" : null} />

      {/*
       * The account prompt comes after the value, never before it (spec §32).
       * Shown only while the visitor is still anonymous.
       */}
      {summary.isAnonymous && (
        <Card className="text-center">
          <h2 className="text-lg font-semibold">{dict.results.saveAnalysis}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-content-muted">
            {dict.results.saveAnalysisBody}
          </p>
          <div className="mt-5">
            <ButtonLink href="/signup" size="lg">
              {dict.results.createAccount}
            </ButtonLink>
          </div>
        </Card>
      )}

      <ProductDetailPanel row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Stat({
  label,
  value,
  text,
}: {
  label: string;
  value?: number;
  text?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5">
      <p className="text-xs text-content-muted">{label}</p>
      <p className="mt-1.5 text-xl font-semibold text-content">
        {text !== undefined ? (
          text
        ) : (
          <span dir="ltr" style={{ unicodeBidi: "isolate" }} className="tnum">
            {formatNumber(value ?? 0)}
          </span>
        )}
      </p>
    </div>
  );
}
