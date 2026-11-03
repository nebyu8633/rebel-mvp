"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { track } from "@/lib/analytics/track";
import { getDictionary } from "@/lib/i18n";
import {
  ANALYSIS_STEP_ORDER,
  type AnalysisStatus,
  type AnalysisSteps,
  type StepStatus,
} from "@/types/database";

const dict = getDictionary();

const POLL_INTERVAL_MS = 1500;

/** Stop polling rather than hammering the endpoint forever if something hangs. */
const MAX_POLL_ATTEMPTS = 240;

interface AnalysisState {
  status: AnalysisStatus;
  steps: AnalysisSteps;
  error_message: string | null;
}

/**
 * The six-step processing screen.
 *
 * Polls the analysis row and mirrors its per-step state. The user is never
 * left on an indefinite spinner (spec §48): polling gives up after a bounded
 * number of attempts and shows a real error with a way forward.
 */
export function ProcessingSteps({ analysisId }: { analysisId: string }) {
  const router = useRouter();
  const [state, setState] = useState<AnalysisState | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let attempts = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (cancelled) return;

      attempts += 1;
      if (attempts > MAX_POLL_ATTEMPTS) {
        setTimedOut(true);
        return;
      }

      try {
        const response = await fetch(`/api/analyses/${analysisId}`, {
          cache: "no-store",
        });

        if (response.ok) {
          const data = (await response.json()) as AnalysisState;
          if (cancelled) return;
          setState(data);

          if (data.status === "complete") {
            track("analysis_completed", { analysisId });
            router.push(`/results/${analysisId}`);
            return;
          }
          if (data.status === "error") return;
        }
      } catch {
        // A dropped poll is not a failed analysis; the next tick retries.
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    void poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [analysisId, router]);

  const failed = state?.status === "error" || timedOut;

  if (failed) {
    const isExtractionFailure = state?.error_message === "extraction_failed";

    return (
      <div
        role="alert"
        className="rounded-xl border border-danger/40 bg-danger/5 p-6 text-center"
      >
        <AlertCircle className="mx-auto size-8 text-danger" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-semibold">{dict.analysis.failedTitle}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-content-muted">
          {isExtractionFailure ? dict.errors.unreadableInvoice : dict.analysis.failedBody}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <ButtonLink href="/analyze">{dict.common.retry}</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <ol className="space-y-2">
      {ANALYSIS_STEP_ORDER.map((key) => (
        <StepRow
          key={key}
          label={dict.analysis.steps[key]}
          status={state?.steps[key] ?? "pending"}
        />
      ))}
    </ol>
  );
}

function StepRow({ label, status }: { label: string; status: StepStatus }) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
        status === "complete" && "border-accent/30 bg-accent/5",
        status === "processing" && "border-border-strong bg-surface",
        status === "pending" && "border-border bg-surface/40",
        status === "error" && "border-danger/40 bg-danger/5",
      )}
    >
      <span className="flex size-6 shrink-0 items-center justify-center">
        {status === "complete" && <Check className="size-4 text-accent" aria-hidden="true" />}
        {status === "processing" && (
          <Loader2 className="size-4 animate-spin text-content" aria-hidden="true" />
        )}
        {status === "error" && <AlertCircle className="size-4 text-danger" aria-hidden="true" />}
        {status === "pending" && (
          <span className="size-2 rounded-full bg-content-subtle" aria-hidden="true" />
        )}
      </span>

      <span
        className={cn(
          "text-sm",
          status === "pending" ? "text-content-subtle" : "text-content",
        )}
      >
        {label}
      </span>

      {/* Announced to screen readers; the icons above are decorative. */}
      <span className="sr-only">{dict.analysis.status[status]}</span>
    </li>
  );
}

/** Re-exported so the page can render a retry action without importing icons. */
export { Button };
