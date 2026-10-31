import type { FinanceEntry, MotorcycleInfo } from "./types";
import { addMonths } from "./dates";

export interface AccountSummary {
  /** Current value: last valuation + flows after it. */
  currentValue: number;
  /** Value at the first record, if the first record was a valuation (starting value). */
  startingValue: number;
  /** Deposits − withdrawals recorded after the starting value. */
  netContributions: number;
  deposits: number;
  withdrawals: number;
  /** currentValue − startingValue − netContributions: gains/losses (or untracked changes). */
  marketChange: number;
  lastValuationDate: string | null;
  lastUpdate: string | null;
  history: Array<{ date: string; value: number; contributed: number }>;
}

export function sortEntries(entries: FinanceEntry[]): FinanceEntry[] {
  return entries
    .slice()
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1));
}

export function summarizeAccount(entries: FinanceEntry[]): AccountSummary {
  const sorted = sortEntries(entries);
  let value = 0;
  let deposits = 0;
  let withdrawals = 0;
  let startingValue = 0;
  let lastValuationDate: string | null = null;
  const history: AccountSummary["history"] = [];
  sorted.forEach((e, idx) => {
    if (e.kind === "deposit") {
      value += e.amount;
      deposits += e.amount;
    } else if (e.kind === "withdrawal") {
      value -= e.amount;
      withdrawals += e.amount;
    } else {
      if (idx === 0) startingValue = e.amount;
      value = e.amount;
      lastValuationDate = e.date;
    }
    const contributed = startingValue + deposits - withdrawals;
    const last = history[history.length - 1];
    if (last && last.date === e.date) {
      last.value = value;
      last.contributed = contributed;
    } else history.push({ date: e.date, value, contributed });
  });
  const netContributions = deposits - withdrawals;
  return {
    currentValue: round2(value),
    startingValue: round2(startingValue),
    netContributions: round2(netContributions),
    deposits: round2(deposits),
    withdrawals: round2(withdrawals),
    marketChange: round2(value - startingValue - netContributions),
    lastValuationDate,
    lastUpdate: sorted.length ? sorted[sorted.length - 1].date : null,
    history,
  };
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function monthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/**
 * Monthly contribution needed to grow `presentValue` to `target` in `months`,
 * assuming a constant annual return (compounded monthly, contributions at month end).
 * This is an illustration under an explicit assumption — never a guarantee.
 */
export function requiredMonthlyContribution(
  presentValue: number,
  target: number,
  months: number,
  annualRate: number,
): number {
  if (months <= 0) return Math.max(0, round2(target - presentValue));
  const r = monthlyRate(annualRate);
  const growth = Math.pow(1 + r, months);
  const need = target - presentValue * growth;
  if (need <= 0) return 0;
  const pmt = r === 0 ? need / months : (need * r) / (growth - 1);
  return Math.ceil(pmt);
}

export function projectValue(presentValue: number, monthly: number, months: number, annualRate: number): number {
  const r = monthlyRate(annualRate);
  let v = presentValue;
  for (let i = 0; i < months; i++) v = v * (1 + r) + monthly;
  return round2(v);
}

export const SCENARIOS = [
  { id: "conservative", label: "שמרני", annualRate: 0.02 },
  { id: "neutral", label: "ניטרלי", annualRate: 0.05 },
  { id: "optimistic", label: "אופטימי", annualRate: 0.08 },
] as const;

export function scenarioTable(presentValue: number, target: number, months: number) {
  return [
    { id: "zero", label: "ללא תשואה", annualRate: 0 },
    ...SCENARIOS,
  ].map((s) => ({ ...s, monthly: requiredMonthlyContribution(presentValue, target, months, s.annualRate) }));
}

export function monthsLeft(today: string, deadline: string): number {
  // count whole months, at least 0
  let m = 0;
  while (addMonths(today, m + 1) <= deadline && m < 600) m++;
  return m;
}

// ───────────── Motorcycle ─────────────

export interface MotorcycleCost {
  upfront: number;
  yearly: number;
  breakdown: Array<{ label: string; amount: number | null }>;
  missing: string[];
  complete: boolean;
}

export function motorcycleCost(info: Partial<MotorcycleInfo>): MotorcycleCost {
  const upfrontParts: Array<{ key: keyof MotorcycleInfo; label: string }> = [
    { key: "price", label: "מחיר האופנוע" },
    { key: "licenseCost", label: "רישיון" },
    { key: "gearCost", label: "ציוד מגן" },
    { key: "insuranceYearly", label: "ביטוח (שנה ראשונה)" },
    { key: "otherCosts", label: "הוצאות נוספות (העברה, טסט…)" },
  ];
  const breakdown = upfrontParts.map((p) => ({ label: p.label, amount: (info[p.key] as number | null | undefined) ?? null }));
  const missing = breakdown.filter((b) => b.amount == null).map((b) => b.label);
  if (!info.model) missing.unshift("דגם רצוי");
  if (info.monthlySavingCapacity == null) missing.push("יכולת חיסכון חודשית");
  const upfront = breakdown.reduce((s, b) => s + (b.amount ?? 0), 0);
  const yearly = (info.insuranceYearly ?? 0) + (info.maintenanceYearly ?? 0);
  return { upfront, yearly, breakdown, missing, complete: missing.length === 0 };
}

/** Months needed at the stated saving capacity; null if capacity unknown/zero. */
export function monthsToSave(remaining: number, monthlyCapacity: number | null | undefined): number | null {
  if (remaining <= 0) return 0;
  if (!monthlyCapacity || monthlyCapacity <= 0) return null;
  return Math.ceil(remaining / monthlyCapacity);
}

export function formatILS(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(n);
}
