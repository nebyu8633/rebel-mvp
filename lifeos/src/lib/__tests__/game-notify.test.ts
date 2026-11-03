import { describe, expect, it } from "vitest";
import { scheduledReminders, dueScheduled } from "../game/notify";
import { dueForUser } from "../push/due";
import { defaultProfile, milestoneLocked, milestoneSync } from "../game/engine";
import { briefing } from "../game/master";
import { challengesFor } from "../game/challenges";
import type { DB, Goal, Milestone } from "../types";
import { dbWith, task, rule, T0 } from "./helpers";

const D = "2026-11-03";
const settings = (db: DB, av: number | null = null) => {
  db.settings.settings = { id: "settings", displayName: "", timezone: "Asia/Jerusalem", weekStartsOn: 0, availability: [av, av, av, av, av, av, av], mealReminders: [], notifyInApp: true, notifyBrowser: false, defaultReminderMinutes: 15, mealPrepDay: 2, mealPrepBackupDay: 6, onboarded: true, createdAt: T0, updatedAt: T0 };
  return db;
};
const goal = (id: string): Goal => ({ id, title: id, description: "", why: "", kind: "learning", status: "active", startDate: "2026-11-01", startConfirmed: true, targetDate: "2027-11-01", unit: "", startValue: null, targetValue: null, manualValue: null, financeAccountId: null, info: {}, region: null, color: "teal", order: 0, createdAt: T0, updatedAt: T0 });
const ms = (id: string, order: number, status: Milestone["status"] = "pending", updatedAt = T0): Milestone => ({ id, goalId: "g", title: id, description: "", targetDate: "2027-01-01", status, order, planVersionId: null, createdAt: T0, updatedAt });

describe("game reminders", () => {
  it("prep / start / follow-up at 17:45, 18:00, 18:15 for an 18:00 task", () => {
    const db = settings(dbWith([task({ id: "w", title: "אימון", date: D, startTime: "18:00", estimatedMinutes: 45 })]));
    const r = scheduledReminders(db, D).filter((x) => x.instanceKey === "w");
    expect(r.map((x) => `${x.time} ${x.stage}`)).toEqual(["17:45 prep", "18:00 start", "18:15 follow"]);
    expect(r[0].title).toContain("בעוד 15 דק׳");
    expect(r[2].category).toBe("repeat");
  });
  it("follow-up disappears once the task is done; an explicit reminder replaces the prep message", () => {
    const db = settings(dbWith([task({ id: "w", date: D, startTime: "18:00", status: "completed" }), task({ id: "x", date: D, startTime: "09:00", reminderMinutes: 15 })]));
    const r = scheduledReminders(db, D);
    expect(r.some((x) => x.instanceKey === "w")).toBe(false);
    expect(r.filter((x) => x.instanceKey === "x").map((x) => x.time)).toEqual(["08:45", "09:00", "09:15"]);
  });
  it("quiet hours mute normal reminders but not high priority; categories can be turned off", () => {
    const db = settings(dbWith([task({ id: "a", date: D, startTime: "23:00" }), task({ id: "b", date: D, startTime: "23:30", priority: "high" })]));
    const p = defaultProfile(D, T0);
    p.notify.quietStart = "22:00";
    p.notify.quietEnd = "07:00";
    p.notify.categories.repeat = false;
    db.gameProfile = { profile: p };
    const r = scheduledReminders(db, D);
    expect(r.find((x) => x.key.startsWith("g:start:a"))!.muted).toBe("quiet");
    expect(r.find((x) => x.key.startsWith("g:start:b"))!.muted).toBe(null);
    expect(r.find((x) => x.key.startsWith("g:follow:b"))!.muted).toBe("category");
    expect(dueScheduled(r, 23 * 60 + 1, new Set()).map((x) => x.key)).toEqual([]);
    expect(dueScheduled(r, 23 * 60 + 31, new Set()).map((x) => x.key.split(":")[1])).toEqual(["start"]);
  });
  it("server selection uses the same schedule and never sends twice", () => {
    const db = settings(dbWith([task({ id: "w", date: D, startTime: "18:00" })]));
    const at = new Date("2026-11-03T15:46:00Z"); // 17:46 Israel
    const due = dueForUser(db, at, new Set());
    expect(due.map((d) => d.time)).toEqual(["17:45"]);
    expect(dueForUser(db, at, new Set(due.map((d) => d.key)))).toEqual([]);
  });
  it("recurring occurrences get their own keys per day", () => {
    const db = settings(dbWith([task({ id: "r", startTime: "07:00", recurrence: rule({ freq: "daily", startDate: "2026-11-01" }) })]));
    const a = scheduledReminders(db, D).filter((x) => x.instanceKey?.startsWith("r"));
    const b = scheduledReminders(db, "2026-11-04").filter((x) => x.instanceKey?.startsWith("r"));
    expect(a[0].instanceKey).toBe("r:2026-11-03");
    expect(new Set([...a, ...b].map((x) => x.key)).size).toBe(a.length + b.length);
  });
});

describe("milestones & game master", () => {
  it("a milestone is locked until the previous one is done; manual done is not reverted", () => {
    const db = dbWith([task({ id: "t1", milestoneId: "m2", goalId: "g" })]);
    db.goals.g = goal("g");
    db.milestones = { m1: ms("m1", 0), m2: ms("m2", 1, "done", "2026-11-02T00:00:00.000Z") };
    expect(milestoneLocked(db, db.milestones.m2)).toBe(true);
    expect(milestoneLocked(db, db.milestones.m1)).toBe(false);
    // the task was last changed before the milestone was marked done → respected
    expect(milestoneSync(db, T0)).toEqual([]);
    // reopening the task afterwards reopens the milestone
    db.tasks.t1 = { ...db.tasks.t1, updatedAt: "2026-11-03T00:00:00.000Z" };
    expect(milestoneSync(db, T0).map((m) => m.status)).toEqual(["active"]);
  });
  it("after missed days the master suggests one small step, without punishment", () => {
    const db = settings(dbWith([task({ id: "s", title: "קריאה", date: D, estimatedMinutes: 10 }), task({ id: "big", date: D, estimatedMinutes: 120, priority: "high" })]), 60);
    db.xpEvents = { "task:old": { id: "task:old", kind: "task", refId: "old", title: "x", amount: 10, region: null, attribute: "discipline", at: "2026-10-25T10:00:00.000Z", detail: "", evalVersion: null, createdAt: T0, updatedAt: T0 } };
    const b = briefing(db, D);
    const ret = b.notes.find((n) => n.id === "return")!;
    expect(ret.text).toContain("9 ימים");
    expect(ret.action?.key).toBe("s");
    expect(b.notes.some((n) => n.id === "overload")).toBe(true);
    expect(b.next?.key).toBe("big");
  });
  it("return challenge completes when an overdue task is finished today", () => {
    const today = D;
    const db = dbWith([
      task({ id: "o1", date: "2026-11-01" }),
      task({ id: "o2", date: "2026-11-02" }),
      task({ id: "o3", date: "2026-11-02", status: "completed", completedAt: "2026-11-03T08:00:00.000Z" }),
    ]);
    const c = challengesFor(db, today).find((x) => x.id.endsWith(":return"))!;
    expect(c.progress).toBe(1);
    expect(c.done).toBe(true);
  });
});
