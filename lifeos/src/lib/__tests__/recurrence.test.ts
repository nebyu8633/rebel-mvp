import { describe, expect, it } from "vitest";
import { expandRule, nextOccurrence, backupDateFor, isOccurrence } from "../recurrence";
import { rule } from "./helpers";
import { weekday } from "../dates";

describe("expandRule", () => {
  it("weekly on Thursday produces one occurrence per week, all Thursdays", () => {
    const r = rule({ byWeekday: [4], startDate: "2026-11-05" });
    const d = expandRule(r, "2026-11-01", "2026-11-30");
    expect(d).toEqual(["2026-11-05", "2026-11-12", "2026-11-19", "2026-11-26"]);
    expect(d.every((x) => weekday(x) === 4)).toBe(true);
  });

  it("never yields duplicates or dates outside the window", () => {
    const r = rule({ freq: "daily", startDate: "2026-10-01" });
    const d = expandRule(r, "2026-11-01", "2026-11-10");
    expect(new Set(d).size).toBe(d.length);
    expect(d[0]).toBe("2026-11-01");
    expect(d.at(-1)).toBe("2026-11-10");
    expect(d).toHaveLength(10);
  });

  it("respects interval, multiple weekdays and biweekly", () => {
    const r = rule({ byWeekday: [2, 3], interval: 2, startDate: "2026-11-01" });
    expect(expandRule(r, "2026-11-01", "2026-11-30")).toEqual(["2026-11-03", "2026-11-04", "2026-11-17", "2026-11-18"]);
  });

  it("daily interval of 3", () => {
    const r = rule({ freq: "daily", interval: 3, startDate: "2026-11-01" });
    expect(expandRule(r, "2026-11-01", "2026-11-10")).toEqual(["2026-11-01", "2026-11-04", "2026-11-07", "2026-11-10"]);
  });

  it("monthly on the 31st clamps to the last day of shorter months", () => {
    const r = rule({ freq: "monthly", byMonthDay: 31, startDate: "2026-01-31" });
    expect(expandRule(r, "2026-01-01", "2026-04-30")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("handles leap years", () => {
    const r = rule({ freq: "monthly", byMonthDay: 29, startDate: "2028-01-29" });
    expect(expandRule(r, "2028-02-01", "2028-02-29")).toEqual(["2028-02-29"]);
  });

  it("honours end date, count, exceptions and pause", () => {
    const base = rule({ freq: "daily", startDate: "2026-11-01" });
    expect(expandRule({ ...base, endDate: "2026-11-03" }, "2026-11-01", "2026-11-30")).toHaveLength(3);
    expect(expandRule({ ...base, count: 5 }, "2026-11-03", "2026-11-30")).toEqual(["2026-11-03", "2026-11-04", "2026-11-05"]);
    expect(expandRule({ ...base, exceptions: ["2026-11-02"] }, "2026-11-01", "2026-11-03")).toEqual(["2026-11-01", "2026-11-03"]);
    expect(expandRule({ ...base, paused: true }, "2026-11-01", "2026-11-30")).toEqual([]);
  });

  it("is stable across DST transitions (Israel: 2026-10-25, US: 2026-11-01)", () => {
    const r = rule({ freq: "daily", startDate: "2026-10-20" });
    const d = expandRule(r, "2026-10-20", "2026-11-05");
    expect(d).toHaveLength(17);
    expect(d).toContain("2026-10-25");
    expect(d).toContain("2026-11-01");
  });

  it("does not start before startDate", () => {
    const r = rule({ byWeekday: [0, 1, 2, 3, 4, 5, 6], startDate: "2026-11-15" });
    expect(expandRule(r, "2026-11-01", "2026-11-16")).toEqual(["2026-11-15", "2026-11-16"]);
  });
});

describe("helpers", () => {
  it("nextOccurrence and isOccurrence", () => {
    const r = rule({ byWeekday: [4], startDate: "2026-11-05" });
    expect(nextOccurrence(r, "2026-11-06")).toBe("2026-11-12");
    expect(isOccurrence(r, "2026-11-12")).toBe(true);
    expect(isOccurrence(r, "2026-11-13")).toBe(false);
  });
  it("backup day is later in the same week", () => {
    const r = rule({ byWeekday: [2], missedPolicy: "backup", backupWeekday: 6 });
    expect(backupDateFor(r, "2026-11-03")).toBe("2026-11-07");
    expect(backupDateFor({ ...r, missedPolicy: "carry" }, "2026-11-03")).toBeNull();
  });
});
