import { Lightbulb } from "lucide-react";
import type { Metadata } from "next";

import { SetupNotice } from "@/components/ui/SetupNotice";
import { UploadForm } from "@/components/upload/UploadForm";
import { isSupabaseConfigured } from "@/lib/config/env";
import { getDictionary } from "@/lib/i18n";

const dict = getDictionary();

export const metadata: Metadata = {
  title: `${dict.analyze.title} · ${dict.common.appName}`,
};

export default function AnalyzePage() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-6 py-16 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        {dict.analyze.title}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-content-muted">
        {dict.analyze.subtitle}
      </p>

      {/*
       * A first analysis of a single invoice has nothing to compare against
       * and will honestly report no price changes. Uploading several periods
       * at once is what makes the very first result useful, so the hint is
       * prominent rather than buried in help text.
       */}
      <p className="mt-6 flex items-start gap-3 rounded-lg border border-accent/25 bg-accent/5 px-4 py-3 text-sm leading-relaxed text-content-muted">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
        {dict.analyze.multiPeriodHint}
      </p>

      <div className="mt-10">
        {/* Without a Supabase project there is nowhere to store an upload, so
            say what is missing instead of failing at submit time. */}
        {isSupabaseConfigured() ? <UploadForm /> : <SetupNotice />}
      </div>
    </main>
  );
}
