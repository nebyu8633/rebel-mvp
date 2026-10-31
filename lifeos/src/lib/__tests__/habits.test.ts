import { describe, expect, it } from "vitest";
import { streak, weekCompletion, type LogIndex } from "../habits";
import type { Habit } from "../types";
import { T0 } from "./helpers";

const habit = (f: Habit["frequency"]): Habit => ({ id: "h", title: "h", goalId: null, frequency: f, startDate: "2026-10-01", paused: false, reminderTime: null, order: 0, createdAt: T0, updatedAt: T0 });
const logs = (entries: Array<[string, "done" | "skipped"]>): LogIndex =>
  Object.fromEntries(entries.map(([d, s]) => [`h:${d}`, { id: `h:${d}`, habitId: "h", date: d, status: s, createdAt: T0, updatedAt: T0 }]));

describe("habits", () => {
  it("daily streak ignores an unfinished today and treats skips as neutral", () => {
    const l = logs([["2026-11-01", "done"], ["2026-11-02", "skipped"], ["2026-11-03", "done"], ["2026-11-04", "done"]]);
    expect(streak(habit({ type: "daily" }), l, "2026-11-05")).toBe(3);
  });
  it("weekly rate counts only due days so far", () => {
    const h = habit({ type: "weekdays", days: [0, 2, 4] });
    const l = logs([["2026-11-01", "done"], ["2026-11-03", "done"]]);
    expect(weekCompletion(h, l, "2026-11-01", "2026-11-04")).toEqual({ done: 2, due: 2, rate: 1 });
  });
  it("times per week", () => {
    const h = habit({ type: "times_per_week", count: 3 });
    const l = logs([["2026-10-25", "done"], ["2026-10-26", "done"], ["2026-10-28", "done"], ["2026-11-02", "done"]]);
    expect(weekCompletion(h, l, "2026-11-01", "2026-11-04").rate).toBeCloseTo(1 / 3);
    expect(streak(h, l, "2026-11-04")).toBe(1);
  });
});
