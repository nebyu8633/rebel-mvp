/**
 * Israeli currency formatting (spec §23).
 *
 * Always renders as ₪12,840 / ₪34.50 — symbol first, never "NIS 12,840",
 * never "12,840₪".
 *
 * Note that `Intl.NumberFormat("he-IL", { style: "currency" })` does NOT do
 * this: it produces "‏12,394 ‏₪", putting the symbol AFTER the
 * number with embedded right-to-left marks — exactly the shape the spec rules
 * out. So the number is formatted on its own (which still gets locale-correct
 * grouping and decimal separators) and the symbol is prepended by hand.
 *
 * Formatters are constructed once and reused; `Intl.NumberFormat` is
 * comparatively expensive to build and these run inside table renders.
 */

const SHEKEL = "₪";

const NUMBER_2DP = new Intl.NumberFormat("he-IL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Whole-shekel variant for large headline figures (the savings hero). */
const NUMBER_0DP = new Intl.NumberFormat("he-IL", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const NUMBER_PLAIN = new Intl.NumberFormat("he-IL", {
  maximumFractionDigits: 2,
});

const PERCENT_FORMATTER = new Intl.NumberFormat("he-IL", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Formats an amount given in shekels.
 *
 * A negative amount renders as -₪34.50, keeping the sign outside the symbol
 * so the figure still reads left-to-right as one unit.
 *
 * @param whole - drop the agorot, for headline figures like ₪12,840
 */
export function formatCurrency(shekels: number, whole = false): string {
  const formatter = whole ? NUMBER_0DP : NUMBER_2DP;
  const magnitude = formatter.format(Math.abs(shekels));
  const sign = shekels < 0 ? "-" : "";
  return `${sign}${SHEKEL}${magnitude}`;
}

/** Formats an amount stored in agorot (integer minor units). */
export function formatAgorot(agorot: number, whole = false): string {
  return formatCurrency(agorot / 100, whole);
}

export function formatNumber(value: number): string {
  return NUMBER_PLAIN.format(value);
}

/** `0.101` renders as `10.1%`. */
export function formatPercent(ratio: number): string {
  return PERCENT_FORMATTER.format(ratio);
}

/** `0.101` renders as `+10.1%` — used for price-change deltas. */
export function formatSignedPercent(ratio: number): string {
  const formatted = PERCENT_FORMATTER.format(Math.abs(ratio));
  if (ratio > 0) return `+${formatted}`;
  if (ratio < 0) return `-${formatted}`;
  return formatted;
}

/**
 * Formats a normalized unit price as "₪10.00 לק״ג".
 * The unit label must already be localized by the caller.
 */
export function formatUnitPrice(shekels: number, unitLabel: string): string {
  return `${formatCurrency(shekels)} ל${unitLabel}`;
}
