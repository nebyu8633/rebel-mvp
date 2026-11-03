import { Package } from "lucide-react";
import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Ltr } from "@/components/ui/Ltr";
import { getProductsWithPrices } from "@/lib/dashboard/queries";
import { formatAgorot, formatSignedPercent } from "@/lib/format/currency";
import { getDictionary } from "@/lib/i18n";
import { baseUnitLabel } from "@/lib/i18n/units";
import { fromScaledUnitPrice, percentageChange } from "@/lib/savings/money";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const dict = getDictionary();

export const metadata: Metadata = {
  title: `${dict.products.title} · ${dict.common.appName}`,
};

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const supabase = await getSupabaseServerClient();
  const products = await getProductsWithPrices(supabase);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight">{dict.products.title}</h1>

      <div className="mt-8">
        {products.length === 0 ? (
          <EmptyState
            icon={<Package className="size-8" aria-hidden="true" />}
            title={dict.products.emptyTitle}
            body={dict.products.emptyBody}
            action={<ButtonLink href="/analyze">{dict.dashboard.emptyCta}</ButtonLink>}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[52rem] text-start text-sm">
              <thead className="border-b border-border bg-surface-2/50">
                <tr>
                  <Th>{dict.products.columns.product}</Th>
                  <Th>{dict.products.columns.category}</Th>
                  <Th>{dict.products.columns.supplier}</Th>
                  <Th>{dict.products.columns.currentPrice}</Th>
                  <Th>{dict.products.columns.previousPrice}</Th>
                  <Th>{dict.products.columns.priceChange}</Th>
                  <Th>{dict.products.columns.opportunity}</Th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const unit = baseUnitLabel(product.base_unit);

                  // Only computed when both prices exist — a change from a
                  // price we do not have is not a change.
                  const change =
                    product.currentUnitPrice !== null && product.previousUnitPrice !== null
                      ? percentageChange(product.currentUnitPrice, product.previousUnitPrice)
                      : null;

                  return (
                    <tr key={product.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-medium text-content">
                        {product.canonical_name}
                      </td>
                      <td className="px-4 py-3 text-content-muted">
                        {product.category ?? dict.products.uncategorized}
                      </td>
                      <td className="px-4 py-3 text-content-muted">
                        {product.supplierName ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Price scaled={product.currentUnitPrice} unit={unit} />
                      </td>
                      <td className="px-4 py-3 text-content-muted">
                        <Price scaled={product.previousUnitPrice} unit={unit} />
                      </td>
                      <td className="px-4 py-3">
                        {change !== null ? (
                          <span
                            dir="ltr"
                            style={{ unicodeBidi: "isolate" }}
                            className={`tnum ${change > 0 ? "text-warning" : "text-accent"}`}
                          >
                            {formatSignedPercent(change)}
                          </span>
                        ) : (
                          <span className="text-content-subtle">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-accent">
                        {product.annualOpportunityAgorot > 0 ? (
                          <Ltr>{formatAgorot(product.annualOpportunityAgorot, true)}</Ltr>
                        ) : (
                          <span className="font-normal text-content-subtle">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-4 py-3 text-start font-medium text-content-muted">
      {children}
    </th>
  );
}

function Price({ scaled, unit }: { scaled: number | null; unit: string | null }) {
  if (scaled === null) return <span className="text-content-subtle">—</span>;

  return (
    <span dir="ltr" style={{ unicodeBidi: "isolate" }} className="tnum">
      {formatAgorot(Math.round(fromScaledUnitPrice(scaled) * 100))}
      {unit !== null && <span className="text-content-subtle"> / {unit}</span>}
    </span>
  );
}
