"use client";

import type { SavingsRow } from "@/components/results/SavingsTable";
import { formatAgorot } from "@/lib/format/currency";
import { getDictionary } from "@/lib/i18n";

const dict = getDictionary();

const MAX_BARS = 5;

/**
 * The top savings opportunities as a horizontal bar chart (spec §30).
 *
 * Built from divs rather than a charting library: five bars do not justify a
 * dependency, and hand-built bars mirror correctly in RTL for free — many
 * chart libraries lay out left-to-right regardless of document direction.
 *
 * Each bar is also a table row of text, so the information is available
 * without relying on the visual encoding.
 */
export function TopOpportunitiesChart({ rows }: { rows: readonly SavingsRow[] }) {
  const top = [...rows]
    .sort((a, b) => b.annualOpportunityAgorot - a.annualOpportunityAgorot)
    .slice(0, MAX_BARS);

  if (top.length === 0) return null;

  const max = top[0]?.annualOpportunityAgorot ?? 0;
  if (max <= 0) return null;

  return (
    <section>
      <h2 className="text-base font-semibold">{dict.results.chartTitle}</h2>

      <ul className="mt-5 space-y-3">
        {top.map((row) => {
          const widthPercent = Math.max(4, (row.annualOpportunityAgorot / max) * 100);

          return (
            <li key={row.id}>
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span className="truncate text-content">{row.productName}</span>
                <span
                  dir="ltr"
                  style={{ unicodeBidi: "isolate" }}
                  className="tnum shrink-0 font-semibold text-accent"
                >
                  {formatAgorot(row.annualOpportunityAgorot, true)}
                </span>
              </div>

              {/* The track fills from the start edge, which is the right in RTL. */}
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-700"
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
