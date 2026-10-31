import { describe, expect, it } from "vitest";
import { summarizeAccount, requiredMonthlyContribution, projectValue, motorcycleCost, monthsToSave, scenarioTable, monthsLeft } from "../finance";
import type { FinanceEntry } from "../types";
import { T0 } from "./helpers";

const e = (date: string, kind: FinanceEntry["kind"], amount: number, i = 0): FinanceEntry => ({ id: `${date}${kind}${i}`, accountId: "a", date, kind, amount, note: "", createdAt: `${T0}${i}`, updatedAt: T0 });

describe("account summary", () => {
  it("separates deposits from market changes", () => {
    const s = summarizeAccount([
      e("2026-11-01", "valuation", 10000),
      e("2026-11-10", "deposit", 1000),
      e("2026-12-01", "valuation", 11500),
      e("2026-12-05", "withdrawal", 200),
    ]);
    expect(s.startingValue).toBe(10000);
    expect(s.netContributions).toBe(800);
    expect(s.currentValue).toBe(11300);
    expect(s.marketChange).toBe(500);
  });

  it("savings with only deposits has zero market change", () => {
    const s = summarizeAccount([e("2026-11-01", "deposit", 500), e("2026-12-01", "deposit", 500, 1)]);
    expect(s.currentValue).toBe(1000);
    expect(s.marketChange).toBe(0);
  });

  it("is order-independent of insertion", () => {
    const a = summarizeAccount([e("2026-12-01", "deposit", 100), e("2026-11-01", "valuation", 1000)]);
    expect(a.currentValue).toBe(1100);
    expect(a.startingValue).toBe(1000);
  });
});

describe("required monthly contribution", () => {
  it("with zero return is a straight division", () => {
    expect(requiredMonthlyContribution(6000, 30000, 12, 0)).toBe(2000);
  });
  it("positive return lowers the requirement and the projection reaches the target", () => {
    const pmt = requiredMonthlyContribution(6000, 30000, 12, 0.05);
    expect(pmt).toBeLessThan(2000);
    expect(projectValue(6000, pmt, 12, 0.05)).toBeGreaterThanOrEqual(30000);
    expect(projectValue(6000, pmt - 5, 12, 0.05)).toBeLessThan(30000);
  });
  it("zero when already on track, remaining when no time left", () => {
    expect(requiredMonthlyContribution(31000, 30000, 12, 0)).toBe(0);
    expect(requiredMonthlyContribution(25000, 30000, 0, 0.05)).toBe(5000);
  });
  it("scenario table is monotonic in assumed return", () => {
    const t = scenarioTable(5000, 30000, 12).map((x) => x.monthly);
    expect([...t].sort((a, b) => b - a)).toEqual(t);
  });
  it("months left", () => {
    expect(monthsLeft("2026-10-31", "2027-10-31")).toBe(12);
    expect(monthsLeft("2026-10-31", "2026-11-15")).toBe(0);
  });
});

describe("motorcycle cost", () => {
  it("lists missing information and sums known upfront costs", () => {
    const c = motorcycleCost({ model: "X", price: 30000, gearCost: 3000 });
    expect(c.upfront).toBe(33000);
    expect(c.complete).toBe(false);
    expect(c.missing).toContain("יכולת חיסכון חודשית");
  });
  it("months to save", () => {
    expect(monthsToSave(10000, 1500)).toBe(7);
    expect(monthsToSave(10000, null)).toBeNull();
    expect(monthsToSave(0, null)).toBe(0);
  });
});
