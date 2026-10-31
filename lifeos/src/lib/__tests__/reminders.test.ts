import { describe, expect, it } from "vitest";
import { dueReminders, remindersForDate } from "../reminders";
import { dbWith, task, rule } from "./helpers";

describe("reminders", () => {
  const db = dbWith([
    task({ id: "a", date: "2026-11-02", startTime: "09:00", reminderMinutes: 15 }),
    task({ id: "b", date: "2026-11-02", startTime: "10:00", reminderMinutes: null }),
    task({ id: "done", date: "2026-11-02", startTime: "09:00", reminderMinutes: 0, status: "completed" }),
    task({ id: "r", startTime: "18:00", reminderMinutes: 0, recurrence: rule({ freq: "daily", startDate: "2026-11-01" }) }),
  ]);
  it("only tasks with a time and a reminder, never completed ones", () => {
    const r = remindersForDate(db, "2026-11-02");
    expect(r.map((x) => x.time)).toEqual(["08:45", "18:00"]);
  });
  it("fires once within the grace window and never twice", () => {
    const all = remindersForDate(db, "2026-11-02");
    const due = dueReminders(all, 8 * 60 + 47, new Set());
    expect(due).toHaveLength(1);
    expect(dueReminders(all, 8 * 60 + 48, new Set(due.map((d) => d.key)))).toHaveLength(0);
    expect(dueReminders(all, 9 * 60 + 30, new Set())).toHaveLength(0); // too late — not shown retroactively
  });
});
