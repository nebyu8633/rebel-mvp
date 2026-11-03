import { FileUp, Upload } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { OpportunityList } from "@/components/dashboard/OpportunityList";
import { PriceTrendChart } from "@/components/dashboard/PriceTrendChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Ltr } from "@/components/ui/Ltr";
import { getCurrentBusiness } from "@/lib/auth/session";
import {
  getDashboardTotals,
  getPriceTrends,
  getRecentInvoices,
  getTopOpportunities,
} from "@/lib/dashboard/queries";
import { formatAgorot } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";
import { getDictionary } from "@/lib/i18n";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const dict = getDictionary();

export const metadata: Metadata = {
  title: `${dict.dashboard.nav.overview} · ${dict.common.appName}`,
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const business = await getCurrentBusiness(supabase);

  const [totals, opportunities, invoices, trends] = await Promise.all([
    getDashboardTotals(supabase),
    getTopOpportunities(supabase),
    getRecentInvoices(supabase),
    getPriceTrends(supabase),
  ]);

  const hasData = totals.invoiceCount > 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-content-muted">{dict.dashboard.greeting}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {business?.name !== undefined && business.name !== ""
              ? business.name
              : dict.common.appName}
          </h1>
        </div>

        <ButtonLink href="/analyze">
          <Upload className="size-4" aria-hidden="true" />
          {dict.dashboard.uploadCta}
        </ButtonLink>
      </header>

      {!hasData ? (
        <div className="mt-10">
          <EmptyState
            icon={<FileUp className="size-8" aria-hidden="true" />}
            title={dict.dashboard.emptyTitle}
            body={dict.dashboard.emptyBody}
            action={<ButtonLink href="/analyze">{dict.dashboard.emptyCta}</ButtonLink>}
          />
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          <section className="rounded-xl border border-accent/25 bg-accent/5 px-6 py-8 text-center">
            <p className="text-sm font-medium text-content-muted">
              {dict.dashboard.potentialSavings}
            </p>
            <p
              dir="ltr"
              style={{ unicodeBidi: "isolate" }}
              className="tnum mt-3 text-[clamp(2.25rem,9vw,3.5rem)] font-bold leading-none tracking-tight text-accent"
            >
              {formatAgorot(totals.totalAnnualAgorot, true)}
            </p>
            <p className="mt-3 text-sm text-content-muted">
              {dict.dashboard.basedOnInvoices}
            </p>
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={dict.dashboard.cards.invoices} value={totals.invoiceCount} />
            <StatCard label={dict.dashboard.cards.products} value={totals.productCount} />
            <StatCard label={dict.dashboard.cards.suppliers} value={totals.supplierCount} />
            <StatCard
              label={dict.dashboard.cards.opportunities}
              value={totals.opportunityCount}
            />
          </section>

          {opportunities.length > 0 && (
            <section>
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-base font-semibold">{dict.dashboard.topOpportunities}</h2>
                <Link
                  href="/dashboard/savings"
                  className="text-sm text-accent hover:underline"
                >
                  {dict.dashboard.viewAll}
                </Link>
              </div>
              <OpportunityList rows={opportunities} />
            </section>
          )}

          {/*
           * Only rendered when some product actually has enough history to
           * plot. Nothing is drawn from a single data point.
           */}
          {trends.length > 0 && (
            <section>
              <h2 className="mb-4 text-base font-semibold">{dict.dashboard.priceTrends}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trends.map((trend) => (
                  <PriceTrendChart
                    key={trend.productName}
                    productName={trend.productName}
                    baseUnit={trend.baseUnit}
                    points={trend.points}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-base font-semibold">{dict.dashboard.recentInvoices}</h2>
              <Link
                href="/dashboard/invoices"
                className="text-sm text-accent hover:underline"
              >
                {dict.dashboard.viewAll}
              </Link>
            </div>

            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {invoices.map((invoice) => (
                <li key={invoice.id}>
                  <Link
                    href={`/dashboard/invoices/${invoice.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-content">
                        {invoice.suppliers?.name ?? "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-content-subtle">
                        {invoice.invoice_date !== null ? (
                          <Ltr>{formatDate(invoice.invoice_date)}</Ltr>
                        ) : (
                          "—"
                        )}
                        {invoice.invoice_number !== null && (
                          <>
                            {" · "}
                            <Ltr>{invoice.invoice_number}</Ltr>
                          </>
                        )}
                      </p>
                    </div>

                    <p className="tnum shrink-0 text-sm text-content">
                      {invoice.total_amount_agorot !== null ? (
                        <Ltr>{formatAgorot(invoice.total_amount_agorot)}</Ltr>
                      ) : (
                        "—"
                      )}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
