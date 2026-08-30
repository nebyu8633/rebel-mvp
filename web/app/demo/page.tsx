import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ResultsView } from "@/components/results/ResultsView";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { isDemoMode } from "@/lib/config/env";
import { DEMO_BUSINESS_NAME, DEMO_OPPORTUNITIES, DEMO_SUMMARY } from "@/lib/demo/demoData";
import { getDictionary } from "@/lib/i18n";

const dict = getDictionary();

export const metadata: Metadata = {
  title: `${dict.common.demoBadge} · ${dict.common.appName}`,
  // Fictional figures must never be indexed as if they were real results.
  robots: { index: false, follow: false },
};

/**
 * Demo Mode: the fully-populated experience with clearly-labelled fictional
 * data, for development and for showing the product before a user has any
 * invoices of their own.
 *
 * Returns 404 unless NEXT_PUBLIC_DEMO_MODE is on, so it cannot be reached in
 * a normal deployment. Reads only from lib/demo — no database access, so
 * demo data can never mix with real data.
 */
export default function DemoPage() {
  if (!isDemoMode()) notFound();

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-6 py-14 sm:py-20">
      <div className="mb-8 flex flex-col items-center gap-3">
        <DemoBadge />
        <h1 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          {DEMO_BUSINESS_NAME}
        </h1>
      </div>

      <ResultsView
        summary={{ analysisId: "demo", ...DEMO_SUMMARY, isAnonymous: false }}
        rows={DEMO_OPPORTUNITIES}
      />
    </main>
  );
}
