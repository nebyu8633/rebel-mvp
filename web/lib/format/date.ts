/**
 * Israeli date formatting (spec §24).
 *
 * Two registers: numeric `30.08.2026` for dense surfaces (tables, lists) and
 * long `30 באוגוסט 2026` where a date needs to read as prose.
 */

const NUMERIC_FORMATTER = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const LONG_FORMATTER = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat("he-IL", {
  month: "short",
  year: "numeric",
});

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** `30.08.2026` — for tables and other dense surfaces. */
export function formatDate(value: Date | string): string {
  return NUMERIC_FORMATTER.format(toDate(value));
}

/** `30 באוגוסט 2026` — where the date reads as part of a sentence. */
export function formatDateLong(value: Date | string): string {
  return LONG_FORMATTER.format(toDate(value));
}

/** `אוג׳ 2026` — for chart axes on price trends. */
export function formatMonthYear(value: Date | string): string {
  return MONTH_YEAR_FORMATTER.format(toDate(value));
}

/** ISO `YYYY-MM-DD`, for API payloads and DB columns — never shown to users. */
export function toIsoDate(value: Date | string): string {
  const date = toDate(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
