import { Info } from "lucide-react";

import { getDictionary } from "@/lib/i18n";

const dict = getDictionary();

/**
 * "How was this calculated?" (spec §31).
 *
 * States the inputs plainly and, just as importantly, states the limits: these
 * are potential opportunities, not guaranteed savings, and a price rise is not
 * automatically a supplier's mistake. Everything here is answerable from
 * stored data — no claim is made that the calculation cannot back up.
 */
export function HowWasThisCalculated({
  method,
}: {
  method?: "historical" | "benchmark" | null;
}) {
  const methodLabel =
    method === "historical"
      ? dict.trust.methodHistorical
      : method === "benchmark"
        ? dict.trust.methodBenchmark
        : null;

  return (
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Info className="size-4 text-content-muted" aria-hidden="true" />
        {dict.trust.title}
      </h2>

      <p className="mt-4 text-sm text-content-muted">{dict.trust.intro}</p>

      <ul className="mt-3 space-y-2">
        {dict.trust.points.map((point) => (
          <li
            key={point}
            className="flex gap-2.5 text-sm leading-relaxed text-content-muted"
          >
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            {point}
          </li>
        ))}
      </ul>

      {methodLabel !== null && (
        <p className="mt-4 text-sm">
          <span className="text-content-muted">{dict.trust.methodLabel}: </span>
          <span className="text-content">{methodLabel}</span>
        </p>
      )}

      <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-content-subtle">
        {dict.trust.disclaimer}
      </p>
    </section>
  );
}
