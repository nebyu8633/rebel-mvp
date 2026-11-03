import { describe, expect, it } from "vitest";
import { computeEarned, defaultProfile, levelInfo, milestoneSync, questFor, reconcile, regionStates, isVerified } from "../game/engine";
import { challengesFor } from "../game/challenges";
import { inferEvidence } from "../game/evidence";
import type { DB, Evidence, Goal, Milestone, XpEvent } from "../types";
import { dbWith, task, T0 } from "./helpers";

const today = "2026-11-03";
const goal = (id: string, kind: Goal["kind"] = "learning"): Goal => ({ id, title: id, description: "", why: "", kind, status: "active", startDate: "2026-11-01", startConfirmed: true, targetDate: "2027-11-01", unit: "", startValue: null, targetValue: null, manualValue: null, financeAccountId: null, info: {}, region: null, color: "teal", order: 0, createdAt: T0, updatedAt: T0 });
const ms = (id: string, goalId: string, order: number, status: Milestone["status"] = "pending"): Milestone => ({ id, goalId, title: id, description: "", targetDate: "2027-01-01", status, order, planVersionId: null, createdAt: T0, updatedAt: T0 });
const ev = (taskId: string, status: Evidence["status"]): Evidence => ({ id: `e-${taskId}-${status}`, taskId, instanceKey: taskId, status, kind: "photo", fileRef: null, note: "", aiVerdict: null, aiReason: "", submittedAt: T0, decidedAt: T0, createdAt: T0, updatedAt: T0 });

function apply(db: DB, r: ReturnType<typeof reconcile>): DB {
  const x = { ...db.xpEvents };
  for (const e of r.put) x[e.id] = e;
  for (const id of r.remove) delete x[id];
  return { ...db, xpEvents: x };
}

describe("XP ledger", () => {
  const profile = defaultProfile(today, T0);
  it("awards completed tasks once, never for open or unverified ones", () => {
    let db = dbWith([
      task({ id: "a", goalId: "g", status: "completed", completedAt: T0, estimatedMinutes: 10 }),
      task({ id: "b", goalId: "g", status: "planned" }),
      task({ id: "c", goalId: "g", status: "completed", completedAt: T0, evidence: "photo" }),
    ]);
    db.goals.g = goal("g");
    const r1 = reconcile(db, computeEarned(db, profile, today), T0);
    expect(r1.put.map((e) => e.id)).toEqual(["task:a", "ach:first-quest"]);
    expect(r1.put[0].amount).toBe(10);
    expect(r1.put[0].region).toBe("knowledge");
    db = apply(db, r1);
    const r2 = reconcile(db, computeEarned(db, profile, today), T0);
    expect(r2.put).toEqual([]);
    expect(r2.remove).toEqual([]);
    // evidence accepted → now counts
    db.evidence = { x: ev("c", "accepted") };
    expect(isVerified(db, db.tasks.c, "c")).toBe(true);
    const r3 = reconcile(db, computeEarned(db, profile, today), T0);
    expect(r3.gained.map((e) => e.id)).toContain("task:c");
  });

  it("un-completing a task revokes its XP; achievements stay", () => {
    let db = dbWith([task({ id: "a", status: "completed", completedAt: T0 })]);
    db = apply(db, reconcile(db, computeEarned(db, profile, today), T0));
    expect(Object.keys(db.xpEvents).sort()).toEqual(["ach:first-quest", "task:a"]);
    db.tasks.a = { ...db.tasks.a, status: "planned" };
    const r = reconcile(db, computeEarned(db, profile, today), T0);
    expect(r.remove).toEqual(["task:a"]);
  });

  it("levels need progressively more XP", () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(99).level).toBe(1);
    expect(levelInfo(100).level).toBe(2);
    const a = levelInfo(1000);
    const b = levelInfo(2000);
    expect(b.level).toBeGreaterThan(a.level);
    expect(b.need).toBeGreaterThan(a.need);
  });
});

describe("quests and milestones", () => {
  it("locks later milestones and auto-completes only unlocked ones", () => {
    const db = dbWith([
      task({ id: "t1", goalId: "g", milestoneId: "m1", status: "planned" }),
      task({ id: "t2", goalId: "g", milestoneId: "m2", status: "completed", completedAt: T0 }),
    ]);
    db.goals.g = goal("g");
    db.milestones = { m1: ms("m1", "g", 0), m2: ms("m2", "g", 1) };
    const q = questFor(db, db.goals.g);
    expect(q.milestones.map((m) => m.state)).toEqual(["available", "locked"]);
    expect(milestoneSync(db, T0)).toEqual([]); // m2's tasks are done but m1 isn't → stays locked
    db.tasks.t1 = { ...db.tasks.t1, status: "completed", completedAt: T0 };
    const ch = milestoneSync(db, T0);
    expect(ch.map((m) => [m.id, m.status])).toEqual([["m1", "done"], ["m2", "done"]]);
  });

  it("pending verification state", () => {
    const db = dbWith([task({ id: "t1", goalId: "g", milestoneId: "m1", status: "planned", evidence: "photo" })]);
    db.goals.g = goal("g");
    db.milestones = { m1: ms("m1", "g", 0) };
    db.evidence = { x: ev("t1", "submitted") };
    expect(questFor(db, db.goals.g).milestones[0].state).toBe("pending");
  });
});

describe("world development", () => {
  it("records which real achievement built each landmark", () => {
    const mk = (id: string, amount: number, at: string): XpEvent => ({ id, kind: "task", refId: id, title: id, amount, region: "wealth", attribute: "wealth", at, createdAt: T0, updatedAt: T0 });
    const rs = regionStates([mk("a", 10, "2026-11-01"), mk("b", 15, "2026-11-02"), mk("c", 100, "2026-11-03")]);
    expect(rs.wealth.stage).toBe(2);
    expect(rs.wealth.unlocks.map((u) => [u.stage, u.event?.id])).toEqual([[1, "b"], [2, "c"]]);
    expect(rs.health.stage).toBe(0);
  });
});

describe("challenges are sized to the real plan", () => {
  it("one important task today → challenge asks for one, not three", () => {
    const db = dbWith([task({ id: "a", date: today, priority: "high" })]);
    const d = challengesFor(db, today).find((c) => c.id.startsWith(`d:${today}:important`))!;
    expect(d.target).toBe(1);
    expect(challengesFor(dbWith([]), today).filter((c) => c.period === "daily")).toEqual([]);
  });
});

describe("evidence inference", () => {
  it("not every task needs a photo", () => {
    expect(inferEvidence("אימון כוח").evidence).toBe("photo");
    expect(inferEvidence("להשלים קורס פייתון").evidence).toBe("document");
    expect(inferEvidence("לנסח מטרה").evidence).toBe("none");
  });
});
