import { describe, expect, it } from "vitest";
import { dueForUser } from "../push/due";
import { dbWith, task, T0 } from "./helpers";

describe("server-side reminder selection (Web Push scheduler)", () => {
  const db = dbWith([task({ id: "t", date: "2026-11-02", startTime: "09:00", reminderMinutes: 15 })]);
  db.settings.settings = { id: "settings", displayName: "", timezone: "Asia/Jerusalem", weekStartsOn: 0, availability: [null, null, null, null, null, null, null], mealReminders: [], notifyInApp: true, notifyBrowser: false, defaultReminderMinutes: 15, mealPrepDay: 2, mealPrepBackupDay: 6, onboarded: true, createdAt: T0, updatedAt: T0 };
  it("uses the user's time zone and never repeats a delivered reminder", () => {
    // 08:47 in Israel (UTC+2 in November) = 06:47Z
    const at = new Date("2026-11-02T06:47:00Z");
    const due = dueForUser(db, at, new Set());
    expect(due.map((d) => d.time)).toEqual(["08:45"]);
    expect(dueForUser(db, at, new Set(due.map((d) => d.key)))).toEqual([]);
    expect(dueForUser(db, new Date("2026-11-02T05:47:00Z"), new Set())).toEqual([]);
  });
});
