"use client";

import { CheckCircle2 } from "lucide-react";
import { m, useReducedMotion } from "framer-motion";

import { Ltr } from "@/components/ui/Ltr";
import { cn } from "@/lib/cn";
import { getDictionary } from "@/lib/i18n";
import { MIN_FILES_PER_ANALYSIS } from "@/lib/invoices/validateFile";
import { DURATION, EASE_OUT } from "@/lib/motion/tokens";

const dict = getDictionary();

/**
 * Progress toward the five-invoice minimum.
 *
 * Rendered from the moment the screen loads, including at zero. A requirement
 * the person only discovers when the submit button refuses them is a
 * requirement they meet by accident; stating it up front is the difference
 * between a rule and a rejection.
 */
export function UploadCounter({ count }: { count: number }) {
  const reduced = useReducedMotion();

  const isReady = count >= MIN_FILES_PER_ANALYSIS;
  const remaining = Math.max(0, MIN_FILES_PER_ANALYSIS - count);
  // Files beyond the minimum are welcome, but the meter is full at five.
  const progress = Math.min(1, count / MIN_FILES_PER_ANALYSIS);

  const remainingLabel = `${dict.analyze.remainingPrefix} ${remaining} ${
    remaining === 1 ? dict.analyze.remainingSuffixOne : dict.analyze.remainingSuffixMany
  }`;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm font-medium text-content">{dict.analyze.counterLabel}</p>

        {/*
         * "5/10" inside an RTL paragraph has its two numbers swapped by the
         * bidi algorithm, so the ratio is isolated. Tabular figures keep it
         * from shifting sideways as the count climbs.
         */}
        <Ltr className="tnum text-sm font-semibold text-content">
          {count}/{MIN_FILES_PER_ANALYSIS}
        </Ltr>
      </div>

      {/*
       * The meter is decorative: everything it conveys is also written below
       * in words, so it is hidden from the accessibility tree rather than
       * announced as a second, redundant progress reading.
       */}
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2"
        aria-hidden="true"
      >
        <m.div
          // The page is RTL, so the bar grows from the right edge. There is no
          // logical equivalent of transform-origin, and V1 ships Hebrew only.
          className={cn(
            "h-full origin-right rounded-full",
            // Partial progress is `content-muted`, not `border-strong`: the
            // latter is barely a shade off the track behind it, so a
            // half-filled meter looked identical to an empty one. The accent
            // stays reserved for the completed state and the primary action.
            isReady ? "bg-accent" : "bg-content-muted",
          )}
          // scaleX, not width: a transform is composited, while animating
          // width forces layout on every frame.
          //
          // `initial={false}` starts at the current value instead of sweeping
          // in on mount, so returning to a half-filled form does not replay
          // progress the person already made.
          initial={false}
          animate={{ scaleX: progress }}
          transition={
            reduced === true
              ? { duration: 0 }
              : { duration: DURATION.base, ease: EASE_OUT }
          }
        />
      </div>

      {/*
       * `output` rather than a div with role="status": it carries that role
       * natively and an implicit polite live region, so the count is announced
       * after the current utterance instead of interrupting, and never takes
       * focus — the person is still working in the file picker.
       */}
      <output
        className={cn(
          "mt-3 flex items-center gap-2 text-sm",
          // Colour reinforces the state; the words carry it. Someone who
          // cannot distinguish the two greens still reads the sentence.
          isReady ? "text-accent" : "text-content-muted",
        )}
      >
        {isReady && <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />}
        {isReady ? dict.analyze.counterReady : remainingLabel}
      </output>
    </div>
  );
}
