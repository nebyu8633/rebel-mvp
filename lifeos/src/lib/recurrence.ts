import type { RecurrenceRule } from "./types";
import { addDays, daysInMonth, diffDays, parseDate, startOfWeek, weekday, WEEKDAYS_HE } from "./dates";

/** Hard ceiling on iterations so a malformed rule can never hang the UI. */
const MAX_SCAN_DAYS = 366 * 15;

function matchesPattern(rule: RecurrenceRule, d: string): boolean {
  if (d < rule.startDate) return false;
  const interval = Math.max(1, rule.interval || 1);
  switch (rule.freq) {
    case "daily":
      return diffDays(rule.startDate, d) % interval === 0;
    case "weekly": {
      const days = rule.byWeekday && rule.byWeekday.length ? rule.byWeekday : [weekday(rule.startDate)];
      if (!days.includes(weekday(d))) return false;
      const weeks = Math.floor(diffDays(startOfWeek(rule.startDate, 0), startOfWeek(d, 0)) / 7);
      return weeks % interval === 0;
    }
    case "monthly": {
      const s = parseDate(rule.startDate);
      const t = parseDate(d);
      const months = (t.getUTCFullYear() - s.getUTCFullYear()) * 12 + (t.getUTCMonth() - s.getUTCMonth());
      if (months < 0 || months % interval !== 0) return false;
      const wanted = rule.byMonthDay ?? s.getUTCDate();
      const dim = daysInMonth(t.getUTCFullYear(), t.getUTCMonth());
      return t.getUTCDate() === Math.min(wanted, dim);
    }
  }
}

/**
 * All occurrence dates of `rule` within [from, to] (inclusive), excluding exceptions.
 * Deterministic and duplicate-free: each calendar date appears at most once.
 * Paused rules produce no occurrences.
 */
export function expandRule(rule: RecurrenceRule, from: string, to: string): string[] {
  if (rule.paused || to < from) return [];
  const end = rule.endDate && rule.endDate < to ? rule.endDate : to;
  if (end < rule.startDate) return [];
  const exceptions = new Set(rule.exceptions ?? []);
  const out: string[] = [];
  // When a count limit exists we must scan from the start to know which occurrence is the Nth.
  let d = rule.count ? rule.startDate : from > rule.startDate ? from : rule.startDate;
  let seen = 0;
  let guard = 0;
  while (d <= end && guard++ < MAX_SCAN_DAYS) {
    if (matchesPattern(rule, d)) {
      seen++;
      if (rule.count && seen > rule.count) break;
      if (d >= from && !exceptions.has(d)) out.push(d);
    }
    d = addDays(d, 1);
  }
  return out;
}

/** Is `d` a (non-cancelled) occurrence of the rule? Ignores pause. */
export function isOccurrence(rule: RecurrenceRule, d: string): boolean {
  return expandRule({ ...rule, paused: false }, d, d).length === 1;
}

/** Next occurrence on/after `from` (or null). */
export function nextOccurrence(rule: RecurrenceRule, from: string, horizonDays = 400): string | null {
  return expandRule(rule, from, addDays(from, horizonDays))[0] ?? null;
}

/** For the "backup" missed policy: the backup day in the same week after the original. */
export function backupDateFor(rule: RecurrenceRule, originalDate: string): string | null {
  if (rule.missedPolicy !== "backup" || rule.backupWeekday == null) return null;
  const diff = (rule.backupWeekday - weekday(originalDate) + 7) % 7;
  if (diff === 0) return null;
  return addDays(originalDate, diff);
}

export function describeRule(rule: RecurrenceRule): string {
  const n = rule.interval || 1;
  let s: string;
  switch (rule.freq) {
    case "daily":
      s = n === 1 ? "כל יום" : `כל ${n} ימים`;
      break;
    case "weekly": {
      const days = (rule.byWeekday && rule.byWeekday.length ? rule.byWeekday : [weekday(rule.startDate)])
        .slice()
        .sort()
        .map((d) => WEEKDAYS_HE[d]);
      const base = n === 1 ? "כל שבוע" : n === 2 ? "כל שבועיים" : `כל ${n} שבועות`;
      s = `${base} ביום ${days.join(", ")}`;
      break;
    }
    case "monthly": {
      const day = rule.byMonthDay ?? parseDate(rule.startDate).getUTCDate();
      s = `${n === 1 ? "כל חודש" : `כל ${n} חודשים`} ב-${day}`;
      break;
    }
  }
  if (rule.paused) s += " (מושהה)";
  return s;
}
