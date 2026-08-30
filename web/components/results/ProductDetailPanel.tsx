"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

import type { SavingsRow } from "@/components/results/SavingsTable";
import { formatAgorot, formatNumber, formatSignedPercent } from "@/lib/format/currency";
import { getDictionary } from "@/lib/i18n";
import { baseUnitLabel } from "@/lib/i18n/units";
import { confidenceLabel } from "@/lib/savings/confidence";
import { fromScaledUnitPrice } from "@/lib/savings/money";

const dict = getDictionary();

/**
 * Product detail (spec §29).
 *
 * A side panel rather than a route so the table keeps its scroll position and
 * sort. Focus moves into the panel on open and Escape closes it, so it is
 * operable from the keyboard.
 */
export function ProductDetailPanel({
  row,
  onClose,
}: {
  row: SavingsRow | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (row === null) return;

    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [row, onClose]);

  if (row === null) return null;

  const unit = baseUnitLabel(row.baseUnit);

  return (
    // A native <dialog> only behaves as a modal when opened imperatively with
    // showModal(); this panel is rendered conditionally, so role + aria-modal
    // is the correct pattern here.
    // oxlint-disable-next-line prefer-tag-over-role
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={dict.productDetail.title}>
      <button
        type="button"
        onClick={onClose}
        aria-label={dict.common.close}
        className="flex-1 bg-black/60 backdrop-blur-sm"
      />

      {/*
       * `end-0` not `right-0`: in RTL the panel slides in from the left, which
       * is the trailing edge of the reading direction.
       */}
      <aside className="h-full w-full max-w-md overflow-y-auto border-s border-border bg-surface p-6 sm:w-[26rem]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-content-subtle">
              {dict.productDetail.title}
            </p>
            <h2 className="mt-1 text-lg font-semibold leading-snug">{row.productName}</h2>
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={dict.common.close}
            className="shrink-0 rounded-md p-1.5 text-content-subtle transition-colors hover:bg-surface-2 hover:text-content"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <dl className="mt-6 space-y-4">
          <Field label={dict.productDetail.supplier} value={row.supplierName ?? "—"} />
          <Field
            label={dict.productDetail.currentPrice}
            value={`${formatAgorot(Math.round(fromScaledUnitPrice(row.currentUnitPrice) * 100))}${unit !== null ? ` / ${unit}` : ""}`}
            ltr
          />
          <Field
            label={dict.productDetail.referencePrice}
            value={`${formatAgorot(Math.round(fromScaledUnitPrice(row.referenceUnitPrice) * 100))}${unit !== null ? ` / ${unit}` : ""}`}
            ltr
          />
          <Field
            label={dict.productDetail.priceChange}
            value={
              row.percentageChange !== null ? formatSignedPercent(row.percentageChange) : "—"
            }
            ltr
            accent="warning"
          />
          <Field
            label={dict.productDetail.normalizedUnit}
            value={unit ?? "—"}
          />
          <Field
            label={dict.productDetail.annualImpact}
            value={formatAgorot(row.annualOpportunityAgorot, true)}
            ltr
            accent="accent"
          />
          <Field
            label={dict.productDetail.confidence}
            value={confidenceLabel(row.confidence)}
          />
        </dl>

        {/*
         * When the figure could not be annualized, say so here rather than
         * letting an observed-volume number read as a yearly one.
         */}
        {!row.isAnnualized && (
          <p className="mt-6 rounded-lg border border-border bg-surface-2/50 px-4 py-3 text-xs leading-relaxed text-content-muted">
            {dict.trust.disclaimer}
          </p>
        )}
      </aside>
    </div>
  );
}

function Field({
  label,
  value,
  ltr = false,
  accent,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  accent?: "accent" | "warning";
}) {
  const tone =
    accent === "accent"
      ? "text-accent font-semibold"
      : accent === "warning"
        ? "text-warning"
        : "text-content";

  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-3 last:border-0">
      <dt className="text-sm text-content-muted">{label}</dt>
      <dd className={`text-sm ${tone}`}>
        {ltr ? (
          <span dir="ltr" style={{ unicodeBidi: "isolate" }} className="tnum">
            {value}
          </span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export { formatNumber };
