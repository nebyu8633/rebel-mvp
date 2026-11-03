import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DeleteInvoiceButton } from "@/components/dashboard/DeleteInvoiceButton";
import { Ltr } from "@/components/ui/Ltr";
import { formatAgorot, formatNumber } from "@/lib/format/currency";
import { formatDateLong } from "@/lib/format/date";
import { getDictionary } from "@/lib/i18n";
import { baseUnitLabel } from "@/lib/i18n/units";
import { confidenceLabel } from "@/lib/savings/confidence";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { InvoiceItemRow, InvoiceRow, SupplierRow } from "@/types/database";

const dict = getDictionary();

export const metadata: Metadata = {
  title: `${dict.invoices.title} · ${dict.common.appName}`,
};

export const dynamic = "force-dynamic";

interface InvoiceWithSupplier extends InvoiceRow {
  suppliers: Pick<SupplierRow, "name"> | null;
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  // RLS scopes this: another business's invoice id returns nothing.
  const { data } = await supabase
    .from("invoices")
    .select("*, suppliers(name)")
    .eq("id", id)
    .maybeSingle();

  if (data === null) notFound();
  const invoice = data as InvoiceWithSupplier;

  const { data: itemRows } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("created_at");

  const items = (itemRows ?? []) as InvoiceItemRow[];

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
      {/* In RTL, "back" points right. */}
      <Link
        href="/dashboard/invoices"
        className="inline-flex items-center gap-2 text-sm text-content-muted transition-colors hover:text-content"
      >
        <ArrowRight className="size-4" aria-hidden="true" />
        {dict.invoices.title}
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {invoice.suppliers?.name ?? "—"}
          </h1>
          <p className="mt-2 text-sm text-content-muted">
            {invoice.invoice_date !== null && (
              <Ltr>{formatDateLong(invoice.invoice_date)}</Ltr>
            )}
            {invoice.invoice_number !== null && (
              <>
                {invoice.invoice_date !== null && " · "}
                {dict.invoices.columns.number}: <Ltr>{invoice.invoice_number}</Ltr>
              </>
            )}
          </p>
        </div>

        <DeleteInvoiceButton invoiceId={invoice.id} />
      </header>

      {invoice.total_amount_agorot !== null && (
        <p className="mt-6 text-lg">
          <span className="text-content-muted">{dict.invoices.totalLabel}: </span>
          <span className="tnum font-semibold text-content">
            <Ltr>{formatAgorot(invoice.total_amount_agorot)}</Ltr>
          </span>
        </p>
      )}

      <section className="mt-10">
        <h2 className="mb-4 text-base font-semibold">{dict.invoices.itemsTitle}</h2>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[46rem] text-start text-sm">
            <thead className="border-b border-border bg-surface-2/50">
              <tr>
                <Th>{dict.invoices.itemColumns.product}</Th>
                <Th>{dict.invoices.itemColumns.quantity}</Th>
                <Th>{dict.invoices.itemColumns.unitPrice}</Th>
                <Th>{dict.invoices.itemColumns.total}</Th>
                <Th>{dict.invoices.itemColumns.confidence}</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const unit = baseUnitLabel(item.base_unit);
                return (
                  <tr key={item.id} className="border-b border-border/60 last:border-0">
                    {/* raw_product_name, exactly as the supplier printed it. */}
                    <td className="px-4 py-3 font-medium text-content">
                      {item.raw_product_name}
                    </td>
                    <td className="px-4 py-3 text-content-muted">
                      {item.quantity !== null ? (
                        <Ltr>
                          {formatNumber(item.quantity)}
                          {item.unit !== null ? ` ${item.unit}` : ""}
                        </Ltr>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 tnum">
                      {item.unit_price_agorot !== null ? (
                        <Ltr>{formatAgorot(item.unit_price_agorot)}</Ltr>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 tnum text-content-muted">
                      {item.total_price_agorot !== null ? (
                        <Ltr>{formatAgorot(item.total_price_agorot)}</Ltr>
                      ) : (
                        "—"
                      )}
                      {unit !== null && (
                        <span className="text-content-subtle"> / {unit}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-content-muted">
                      {confidenceLabel(item.confidence)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
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
