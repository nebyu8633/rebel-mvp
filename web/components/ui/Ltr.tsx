import type { ReactNode } from "react";

/**
 * Isolates left-to-right content inside the RTL interface (spec §27).
 *
 * Without this, an invoice number like "INV-2026-00125" or a SKU rendered
 * inside a Hebrew sentence gets reordered by the bidi algorithm and displays
 * reversed or with the hyphens in the wrong places. `dir="ltr"` alone is not
 * enough in flow text — `unicode-bidi: isolate` is what keeps the surrounding
 * Hebrew from bleeding into the run.
 *
 * Use for: invoice numbers, SKUs, filenames, emails, URLs, Latin brand names.
 * Do NOT use for Hebrew product or supplier names.
 */
export function Ltr({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span dir="ltr" style={{ unicodeBidi: "isolate" }} className={className}>
      {children}
    </span>
  );
}

/**
 * Same isolation for numeric runs that must stay LTR but sit in RTL text,
 * with tabular figures so they align in table columns.
 */
export function LtrNumber({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      dir="ltr"
      style={{ unicodeBidi: "isolate" }}
      className={`tnum ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
