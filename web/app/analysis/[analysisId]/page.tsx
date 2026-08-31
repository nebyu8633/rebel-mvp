import type { Metadata } from "next";

import { ProcessingSteps } from "@/components/analysis/ProcessingSteps";
import { getDictionary } from "@/lib/i18n";

const dict = getDictionary();

export const metadata: Metadata = {
  title: `${dict.analysis.title} · ${dict.common.appName}`,
};

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ analysisId: string }>;
}) {
  const { analysisId } = await params;

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-16 sm:py-24">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {dict.analysis.title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-content-muted">
        {dict.analysis.subtitle}
      </p>

      <div className="mt-10">
        <ProcessingSteps analysisId={analysisId} />
      </div>
    </main>
  );
}
