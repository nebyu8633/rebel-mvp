"use client";

import { useEffect, useState } from "react";

import { formatAgorot } from "@/lib/format/currency";
import { getDictionary } from "@/lib/i18n";

const dict = getDictionary();

const COUNT_UP_DURATION_MS = 1100;

/**
 * The headline savings figure — the most important element on the screen
 * (spec §26).
 *
 * The number counts up on load, which draws the eye to it. The animation is
 * skipped entirely for viewers who prefer reduced motion, and the final value
 * is rendered immediately in that case rather than being withheld.
 */
export function SavingsHero({ annualAgorot }: { annualAgorot: number }) {
  const [displayed, setDisplayed] = useState(annualAgorot);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion || annualAgorot === 0) {
      setDisplayed(annualAgorot);
      return;
    }

    setDisplayed(0);
    let frame: number;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / COUNT_UP_DURATION_MS);
      // Ease-out cubic: fast at first, settling into the final value.
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(annualAgorot * eased));

      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [annualAgorot]);

  return (
    <div className="text-center">
      <p className="text-sm font-medium text-content-muted">{dict.results.heroLabel}</p>

      {/*
       * The figure is LTR-isolated: "₪12,840" inside an RTL paragraph would
       * otherwise have its symbol and digits reordered.
       */}
      <p
        dir="ltr"
        style={{ unicodeBidi: "isolate" }}
        className="tnum mt-3 text-[clamp(2.75rem,12vw,4.5rem)] font-bold leading-none tracking-tight text-accent"
      >
        {formatAgorot(displayed, true)}
      </p>

      <p className="mt-4 text-sm text-content-muted">{dict.results.heroCaption}</p>
    </div>
  );
}
