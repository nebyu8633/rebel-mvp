"use client";

import { ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";

import { Ltr } from "@/components/ui/Ltr";
import { cn } from "@/lib/cn";
import { formatAgorot, formatSignedPercent } from "@/lib/format/currency";
import { getDictionary } from "@/lib/i18n";
import { baseUnitLabel } from "@/lib/i18n/units";
import { confidenceLabel } from "@/lib/savings/confidence";
import { fromScaledUnitPrice } from "@/lib/savings/money";

const dict = getDictionary();

export interface SavingsRow {
  id: string;
  productName: string;
  supplierName: string | null;
  currentUnitPrice: number;
  referenceUnitPrice: number;
  priceDifference: number;
  percentageChange: number | null;
  baseUnit: string;
  annualOpportunityAgorot: number;
  confidence: number;
  isAnnualized: boolean;
}

type SortKey = "product" | "current" | "difference" | "opportunity";

/**
 * The savings table (spec §28).
 *
 * Sortable and filterable, with a horizontal scroll container so a wide table
 * scrolls inside itself instead of forcing the page sideways on a phone.
 */
export function SavingsTable({
  rows,
  onSelect,
}: {
  rows: readonly SavingsRow[];
  onSelect: (row: SavingsRow) => void;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("opportunity");
  const [descending, setDescending] = useState(true);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered =
      needle === ""
        ? [...rows]
        : rows.filter(
            (row) =>
              row.productName.toLowerCase().includes(needle) ||
              (row.supplierName ?? "").toLowerCase().includes(needle),
          );

    filtered.sort((a, b) => {
      const direction = descending ? -1 : 1;
      switch (sortKey) {
        case "product":
          // Locale-aware so Hebrew sorts correctly rather than by code point.
          return a.productName.localeCompare(b.productName, "he") * direction;
        case "current":
          return (a.currentUnitPrice - b.currentUnitPrice) * direction;
        case "difference":
          return (a.priceDifference - b.priceDifference) * direction;
        case "opportunity":
          return (a.annualOpportunityAgorot - b.annualOpportunityAgorot) * direction;
      }
    });

    return filtered;
  }, [rows, query, sortKey, descending]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDescending((value) => !value);
    } else {
      setSortKey(key);
      setDescending(true);
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={dict.invoices.searchPlaceholder}
        aria-label={dict.common.search}
        className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-content placeholder:text-content-subtle focus:border-border-strong focus:outline-none sm:max-w-xs"
      />

      {/* Wide content scrolls inside this container, never the page body. */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[52rem] text-start text-sm">
          <thead className="border-b border-border bg-surface-2/50">
            <tr>
              <SortableHeader
                label={dict.results.columns.product}
                active={sortKey === "product"}
                onClick={() => toggleSort("product")}
              />
              <th scope="col" className="px-4 py-3 text-start font-medium text-content-muted">
                {dict.results.columns.supplier}
              </th>
              <SortableHeader
                label={dict.results.columns.currentPrice}
                active={sortKey === "current"}
                onClick={() => toggleSort("current")}
              />
              <th scope="col" className="px-4 py-3 text-start font-medium text-content-muted">
                {dict.results.columns.referencePrice}
              </th>
              <SortableHeader
                label={dict.results.columns.difference}
                active={sortKey === "difference"}
                onClick={() => toggleSort("difference")}
              />
              <SortableHeader
                label={dict.results.columns.opportunity}
                active={sortKey === "opportunity"}
                onClick={() => toggleSort("opportunity")}
              />
              <th scope="col" className="px-4 py-3 text-start font-medium text-content-muted">
                {dict.results.columns.confidence}
              </th>
            </tr>
          </thead>

          <tbody>
            {visible.map((row) => {
              const unit = baseUnitLabel(row.baseUnit);
              return (
                <tr
                  key={row.id}
                  onClick={() => onSelect(row)}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(row);
                    }
                  }}
                  className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2/40 focus:bg-surface-2/40"
                >
                  <td className="px-4 py-3 font-medium text-content">{row.productName}</td>
                  <td className="px-4 py-3 text-content-muted">{row.supplierName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Money scaled={row.currentUnitPrice} unit={unit} />
                  </td>
                  <td className="px-4 py-3 text-content-muted">
                    <Money scaled={row.referenceUnitPrice} unit={unit} />
                  </td>
                  <td className="px-4 py-3">
                    <span dir="ltr" style={{ unicodeBidi: "isolate" }} className="tnum text-warning">
                      {row.percentageChange !== null
                        ? formatSignedPercent(row.percentageChange)
                        : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-accent">
                    <span dir="ltr" style={{ unicodeBidi: "isolate" }} className="tnum">
                      {formatAgorot(row.annualOpportunityAgorot, true)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-content-muted">
                    {confidenceLabel(row.confidence)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visible.length === 0 && query !== "" && (
        <p className="py-6 text-center text-sm text-content-muted">
          {dict.errors.notFound}
        </p>
      )}
    </div>
  );
}

function Money({ scaled, unit }: { scaled: number; unit: string | null }) {
  return (
    <span dir="ltr" style={{ unicodeBidi: "isolate" }} className="tnum">
      {formatAgorot(Math.round(fromScaledUnitPrice(scaled) * 100))}
      {unit !== null && <span className="text-content-subtle"> / {unit}</span>}
    </span>
  );
}

function SortableHeader({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <th scope="col" className="px-4 py-3 text-start font-medium">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1.5 transition-colors hover:text-content",
          active ? "text-content" : "text-content-muted",
        )}
      >
        {label}
        <ArrowUpDown className="size-3" aria-hidden="true" />
      </button>
    </th>
  );
}

export { Ltr };
