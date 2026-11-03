import { TrendingDown } from "lucide-react";
import type { Metadata } from "next";

import { OpportunityList } from "@/components/dashboard/OpportunityList";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Ltr } from "@/components/ui/Ltr";
import { getAllOpportunities } from "@/lib/dashboard/queries";
import { formatAgorot } from "@/lib/format/currency";
import { getDictionary } from "@/lib/i18n";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const dict = getDictionary();

export const metadata: Metadata = {
  title: `${dict.savings.title} · ${dict.common.appName}`,
};

export const dynamic = "force-dynamic";

/** Groups opportunities by a key, summing the annual figure for each. */
function groupTotals(
  rows: Array<{ key: string; agorot: number }>,
): Array<{ key: string; agorot: number }> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.key, (totals.get(row.key) ?? 0) + row.agorot);
  }
  return [...totals.entries()]
    .map(([key, agorot]) => ({ key, agorot }))
    .sort((a, b) => b.agorot - a.agorot);
}

export default async function SavingsPage() {
  const supabase = await getSupabaseServerClient();
  const opportunities = await getAllOpportunities(supabase);

  const total = opportunities.reduce(
    (sum, row) => sum + row.annual_opportunity_agorot,
    0,
  );

  const byCategory = groupTotals(
    opportunities.map((row) => ({
      key: row.products?.category ?? dict.products.uncategorized,
      agorot: row.annual_opportunity_agorot,
    })),
  );

  const bySupplier = groupTotals(
    opportunities.map((row) => ({
      key: row.suppliers?.name ?? "—",
      agorot: row.annual_opportunity_agorot,
    })),
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight">{dict.savings.title}</h1>

      {opportunities.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<TrendingDown className="size-8" aria-hidden="true" />}
            title={dict.savings.emptyTitle}
            body={dict.savings.emptyBody}
            action={<ButtonLink href="/analyze">{dict.dashboard.uploadCta}</ButtonLink>}
          />
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          <section className="rounded-xl border border-accent/25 bg-accent/5 px-6 py-8 text-center">
            <p className="text-sm font-medium text-content-muted">{dict.savings.total}</p>
            <p
              dir="ltr"
              style={{ unicodeBidi: "isolate" }}
              className="tnum mt-3 text-[clamp(2.25rem,9vw,3.5rem)] font-bold leading-none tracking-tight text-accent"
            >
              {formatAgorot(total, true)}
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-base font-semibold">{dict.dashboard.topOpportunities}</h2>
            <OpportunityList rows={opportunities} />
          </section>

          <div className="grid gap-6 sm:grid-cols-2">
            <BreakdownCard title={dict.savings.byCategory} rows={byCategory} />
            <BreakdownCard title={dict.savings.bySupplier} rows={bySupplier} />
          </div>
        </div>
      )}
    </main>
  );
}

function BreakdownCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; agorot: number }>;
}) {
  const max = rows[0]?.agorot ?? 0;

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold">{title}</h2>

      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={row.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-content">{row.key}</span>
              <span className="tnum shrink-0 font-medium text-accent">
                <Ltr>{formatAgorot(row.agorot, true)}</Ltr>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent/70"
                style={{ width: `${max > 0 ? Math.max(4, (row.agorot / max) * 100) : 0}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
