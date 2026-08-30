"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Ltr } from "@/components/ui/Ltr";
import type { InvoiceWithSupplier } from "@/lib/dashboard/queries";
import { formatAgorot } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";
import { getDictionary } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import type { InvoiceStatus } from "@/types/database";

const dict = getDictionary();

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  processed: "bg-accent/10 text-accent",
  needs_review: "bg-warning/10 text-warning",
  failed: "bg-danger/10 text-danger",
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  processed: dict.invoices.status.processed,
  needs_review: dict.invoices.status.needsReview,
  failed: dict.invoices.status.failed,
};

/** Searchable, supplier-filterable invoice list (spec §40). */
export function InvoiceList({ invoices }: { invoices: readonly InvoiceWithSupplier[] }) {
  const [query, setQuery] = useState("");
  const [supplier, setSupplier] = useState("");

  const suppliers = useMemo(() => {
    const names = new Set<string>();
    for (const invoice of invoices) {
      if (invoice.suppliers?.name != null) names.add(invoice.suppliers.name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "he"));
  }, [invoices]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return invoices.filter((invoice) => {
      if (supplier !== "" && invoice.suppliers?.name !== supplier) return false;
      if (needle === "") return true;

      return (
        (invoice.suppliers?.name ?? "").toLowerCase().includes(needle) ||
        (invoice.invoice_number ?? "").toLowerCase().includes(needle)
      );
    });
  }, [invoices, query, supplier]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={dict.invoices.searchPlaceholder}
          aria-label={dict.common.search}
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-content placeholder:text-content-subtle focus:border-border-strong focus:outline-none sm:max-w-xs"
        />

        <select
          value={supplier}
          onChange={(event) => setSupplier(event.target.value)}
          aria-label={dict.invoices.supplierFilter}
          className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-content focus:border-border-strong focus:outline-none"
        >
          <option value="">
            {dict.common.all} · {dict.invoices.supplierFilter}
          </option>
          {suppliers.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {visible.map((invoice) => (
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
                      {/* Invoice numbers must not reverse inside RTL text. */}
                      <Ltr>{invoice.invoice_number}</Ltr>
                    </>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] font-medium",
                    STATUS_STYLES[invoice.status],
                  )}
                >
                  {STATUS_LABELS[invoice.status]}
                </span>
                <p className="tnum text-sm text-content">
                  {invoice.total_amount_agorot !== null ? (
                    <Ltr>{formatAgorot(invoice.total_amount_agorot)}</Ltr>
                  ) : (
                    "—"
                  )}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {visible.length === 0 && (
        <p className="py-8 text-center text-sm text-content-muted">
          {dict.errors.notFound}
        </p>
      )}
    </div>
  );
}
