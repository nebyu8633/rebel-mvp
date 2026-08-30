/**
 * Israeli currency formatting (spec §23).
 *
 * Always renders as ₪12,840 / ₪34.50 — never "NIS 12,840", never "12,840₪".
 * Formatters are constructed once and reused; `Intl.NumberFormat` is
 * comparatively expensive to build and these run inside table renders.
 */

const CURRENCY_FORMATTER = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Whole-shekel variant for large headline figures (the savings hero). */
const CURRENCY_FORMATTER_WHOLE = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const NUMBER_FORMATTER = new Intl.NumberFormat("he-IL", {
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
 * @param whole - drop the agorot, for headline figures like ₪12,840
 */
export function formatCurrency(shekels: number, whole = false): string {
  const formatter = whole ? CURRENCY_FORMATTER_WHOLE : CURRENCY_FORMATTER;
  return formatter.format(shekels);
}

/** Formats an amount stored in agorot (integer minor units). */
export function formatAgorot(agorot: number, whole = false): string {
  return formatCurrency(agorot / 100, whole);
}

export function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

/** `0.101` renders as `10.1%`. Signed so price drops read as negative. */
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
