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

import { planForUser, snoozeDecision } from "../push/due";
import type { DB } from "../types";

describe("scheduler plan: on time, late recovery, snoozes", () => {
  const withSettings = (db: DB) => {
    db.settings.settings = { id: "settings", displayName: "", timezone: "Asia/Jerusalem", weekStartsOn: 0, availability: [null, null, null, null, null, null, null], mealReminders: [], notifyInApp: true, notifyBrowser: false, defaultReminderMinutes: 15, mealPrepDay: 2, mealPrepBackupDay: 6, onboarded: true, createdAt: T0, updatedAt: T0 };
    return db;
  };
  const D = "2026-11-02"; // Israel = UTC+2
  it("an on-time reminder is its own notification", () => {
    const db = withSettings(dbWith([task({ id: "a", title: "בנק", date: D, startTime: "09:00", reminderMinutes: 15 })]));
    const out = planForUser(db, new Date("2026-11-02T06:46:00Z"), new Set());
    expect(out).toMatchObject([{ keys: [expect.stringContaining("task:a")], title: "בנק", late: false, href: "/today?task=a" }]);
  });
  it("after an interruption, late reminders (≤ 6h) come once, grouped — never twice", () => {
    const db = withSettings(dbWith([task({ id: "a", title: "בנק", date: D, startTime: "09:00", reminderMinutes: 0 }), task({ id: "b", title: "חשמל", date: D, startTime: "10:00", reminderMinutes: 0 })]));
    const at = new Date("2026-11-02T09:30:00Z"); // 11:30
    const out = planForUser(db, at, new Set());
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ late: true, title: "2 תזכורות שפספסת" });
    expect(planForUser(db, at, new Set(out[0].keys))).toEqual([]);
  });
  it("a single late reminder says when it was due; older than 6h or completed → nothing", () => {
    const db = withSettings(dbWith([task({ id: "a", title: "בנק", date: D, startTime: "09:00", reminderMinutes: 0 })]));
    expect(planForUser(db, new Date("2026-11-02T08:00:00Z"), new Set())[0]).toMatchObject({ title: "פספסת: בנק", body: "התזכורת הייתה ל-09:00" });
    expect(planForUser(db, new Date("2026-11-02T13:30:00Z"), new Set())).toEqual([]); // 15:30
    db.tasks.a = { ...db.tasks.a, status: "completed" };
    expect(planForUser(db, new Date("2026-11-02T08:00:00Z"), new Set())).toEqual([]);
  });
  it("recovers over midnight", () => {
    const db = withSettings(dbWith([task({ id: "n", title: "לילה", date: D, startTime: "23:50", reminderMinutes: 0 })]));
    const out = planForUser(db, new Date("2026-11-02T22:30:00Z"), new Set()); // 00:30 next day
    expect(out[0]).toMatchObject({ title: "פספסת: לילה", late: true });
  });
  it("snoozes: wait until due, send if the task is still open, drop if done or too old", () => {
    const db = withSettings(dbWith([task({ id: "a", title: "בנק", date: D, startTime: "09:00" })]));
    const s = { id: "s1", reminder_key: "k", instance_key: "a", title: "בנק", body: "", href: "/today?task=a", fire_at: "2026-11-02T07:10:00Z" };
    expect(snoozeDecision(db, s, new Date("2026-11-02T07:05:00Z"))).toBe("wait");
    expect(snoozeDecision(db, s, new Date("2026-11-02T07:11:00Z"))).toBe("send");
    expect(snoozeDecision(db, s, new Date("2026-11-02T14:00:00Z"))).toBe("drop");
    db.tasks.a = { ...db.tasks.a, status: "completed" };
    expect(snoozeDecision(db, s, new Date("2026-11-02T07:11:00Z"))).toBe("drop");
  });
});
