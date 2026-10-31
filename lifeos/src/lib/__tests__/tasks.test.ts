import { describe, expect, it } from "vitest";
import { instancesInRange, overdueInstances, findConflicts, mostImportant, dayLoad, occurrenceId } from "../tasks";
import { task, rule, dbWith, T0 } from "./helpers";
import { relationshipProblems, milestoneCompletion } from "../goals";
import type { Goal, Milestone } from "../types";

describe("task instances", () => {
  it("a moved recurring occurrence appears once, on its new date", () => {
    const t = task({ id: "g", recurrence: rule({ byWeekday: [4], startDate: "2026-11-05" }) });
    const db = dbWith([t]);
    db.occurrences[occurrenceId("g", "2026-11-12")] = {
      id: occurrenceId("g", "2026-11-12"), taskId: "g", originalDate: "2026-11-12", status: "planned",
      date: "2026-11-13", startTime: null, title: null, notes: null, completedAt: null, createdAt: T0, updatedAt: T0,
    };
    const list = instancesInRange(db, "2026-11-01", "2026-11-30");
    expect(list.map((i) => i.date)).toEqual(["2026-11-05", "2026-11-13", "2026-11-19", "2026-11-26"]);
    expect(new Set(list.map((i) => i.key)).size).toBe(list.length);
  });

  it("completed occurrences survive a series edit (history kept)", () => {
    const t = task({ id: "r", recurrence: rule({ byWeekday: [1], startDate: "2026-11-02" }) });
    const db = dbWith([t]);
    db.occurrences["r:2026-11-02"] = {
      id: "r:2026-11-02", taskId: "r", originalDate: "2026-11-02", status: "completed",
      date: null, startTime: null, title: null, notes: null, completedAt: T0, createdAt: T0, updatedAt: T0,
    };
    // series moved to Wednesdays
    db.tasks.r = { ...t, recurrence: rule({ byWeekday: [3], startDate: "2026-11-02" }) };
    const list = instancesInRange(db, "2026-11-01", "2026-11-08");
    expect(list.map((i) => [i.date, i.status])).toEqual([["2026-11-02", "completed"], ["2026-11-04", "planned"]]);
  });

  it("overdue respects missed policy", () => {
    const carry = task({ id: "c", recurrence: rule({ freq: "daily", startDate: "2026-11-01" }) });
    const skip = task({ id: "s", recurrence: rule({ freq: "daily", startDate: "2026-11-01", missedPolicy: "skip" }) });
    const once = task({ id: "o", date: "2026-10-01" });
    const done = task({ id: "d", date: "2026-10-01", status: "completed" });
    const db = dbWith([carry, skip, once, done]);
    const od = overdueInstances(db, "2026-11-05", 7);
    expect(od.filter((i) => i.task.id === "c")).toHaveLength(4);
    expect(od.filter((i) => i.task.id === "s")).toHaveLength(0);
    expect(od.map((i) => i.task.id)).toContain("o");
    expect(od.map((i) => i.task.id)).not.toContain("d");
  });

  it("backup policy moves a missed meal-prep to the backup day", () => {
    const t = task({ id: "mp", recurrence: rule({ byWeekday: [2], startDate: "2026-11-03", missedPolicy: "backup", backupWeekday: 6 }) });
    const db = dbWith([t]);
    // today is Thursday 2026-11-05; Tuesday's prep was missed
    const list = instancesInRange(db, "2026-11-05", "2026-11-08", "2026-11-05");
    expect(list).toHaveLength(1);
    expect(list[0].date).toBe("2026-11-07");
    expect(list[0].movedToBackup).toBe(true);
  });
});

describe("conflicts and capacity", () => {
  it("detects overlapping timed items", () => {
    const c = findConflicts([
      { key: "a", title: "a", date: "2026-11-01", start: 600, end: 660 },
      { key: "b", title: "b", date: "2026-11-01", start: 630, end: 700 },
      { key: "c", title: "c", date: "2026-11-01", start: 700, end: 720 },
      { key: "d", title: "d", date: "2026-11-02", start: 600, end: 700 },
    ]);
    expect(c.map(([x, y]) => x.key + y.key)).toEqual(["ab"]);
  });

  it("flags days with more planned work than available", () => {
    const db = dbWith([task({ id: "a", date: "2026-11-02", estimatedMinutes: 90 }), task({ id: "b", date: "2026-11-02", estimatedMinutes: 60 })]);
    db.settings.settings = {
      id: "settings", displayName: "", timezone: "Asia/Jerusalem", weekStartsOn: 0,
      availability: [null, 120, null, null, null, null, null], mealReminders: [], notifyInApp: true, notifyBrowser: false,
      defaultReminderMinutes: 15, mealPrepDay: 2, mealPrepBackupDay: 6, onboarded: true, createdAt: T0, updatedAt: T0,
    };
    const l = dayLoad(db, "2026-11-02");
    expect(l.plannedMinutes).toBe(150);
    expect(l.over).toBe(true);
  });

  it("most important prefers unblocked, high-priority, goal-linked work", () => {
    const blocker = task({ id: "x", date: "2026-11-02", priority: "low" });
    const blocked = task({ id: "y", date: "2026-11-02", priority: "high", dependsOn: ["x"] });
    const goal = task({ id: "z", date: "2026-11-02", priority: "high", goalId: "g" });
    const db = dbWith([blocker, blocked, goal]);
    const list = instancesInRange(db, "2026-11-02", "2026-11-02");
    expect(mostImportant(db, list, "2026-11-02")?.task.id).toBe("z");
  });
});

describe("goal ↔ task relationships", () => {
  const goal = { id: "g1" } as Goal;
  const ms = (id: string, goalId: string) => ({ id, goalId, title: id, description: "", targetDate: null, status: "pending", order: 0, createdAt: T0, updatedAt: T0 }) as Milestone;

  it("reports tasks pointing at missing or mismatched parents", () => {
    const db = dbWith([
      task({ id: "ok", goalId: "g1", milestoneId: "m1" }),
      task({ id: "badGoal", goalId: "nope" }),
      task({ id: "mismatch", goalId: "g1", milestoneId: "m2" }),
      task({ id: "dep", dependsOn: ["ghost"] }),
    ]);
    db.goals.g1 = goal;
    db.goals.g2 = { id: "g2" } as Goal;
    db.milestones.m1 = ms("m1", "g1");
    db.milestones.m2 = ms("m2", "g2");
    const p = relationshipProblems(db);
    expect(p).toHaveLength(3);
    expect(p.join()).toContain("badGoal");
    expect(p.join()).toContain("mismatch");
    expect(p.join()).toContain("ghost");
  });

  it("milestone completion counts only its non-recurring tasks", () => {
    const db = dbWith([
      task({ id: "a", milestoneId: "m1", status: "completed" }),
      task({ id: "b", milestoneId: "m1" }),
      task({ id: "r", milestoneId: "m1", recurrence: rule({}) }),
      task({ id: "c", milestoneId: "m2", status: "completed" }),
    ]);
    expect(milestoneCompletion(db, "m1")).toEqual({ total: 2, done: 1 });
  });
});
