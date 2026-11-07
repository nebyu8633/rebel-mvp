import { describe, expect, it } from "vitest";
import { ownership, ownedIds, validTeam, FIRST_LANDMARK_XP, heroLevel, ratingDelta, type LedgerEntry } from "../arena/roster";
import { STARTER_HEROES } from "../arena/heroes";
import { computeEarned } from "../game/engine";
import { dbWith, task } from "./helpers";

const ev = (p: Partial<LedgerEntry>): LedgerEntry => ({ id: "x", kind: "task", refId: "x", amount: 0, region: null, title: "t", at: "2026-11-03T10:00:00Z", ...p });

describe("hero ownership comes only from verified LifeOS progression", () => {
  it("a new player owns exactly the three starters (one per role)", () => {
    expect(ownedIds([]).sort()).toEqual([...STARTER_HEROES].sort());
  });
  it("an island's Common hero unlocks with its first landmark (real task XP)", () => {
    expect(ownedIds([ev({ region: "career", amount: FIRST_LANDMARK_XP - 1 })])).not.toContain("forge");
    expect(ownedIds([ev({ region: "career", amount: FIRST_LANDMARK_XP })])).toContain("forge");
    // unlock events themselves don't count as island XP
    expect(ownedIds([ev({ kind: "unlock", region: "career", amount: 999, refId: "area:career:x" })])).not.toContain("forge");
  });
  it("Rare heroes come from milestone unlocks, Legendary from completed goals", () => {
    const own = ownedIds([ev({ kind: "unlock", refId: "hero:health:epic", title: "גיבור אפי" }), ev({ kind: "unlock", refId: "hero:mind:legendary" })]);
    expect(own).toContain("titan");
    expect(own).toContain("mirage");
    expect(own).not.toContain("phoenix");
    const o = ownership([ev({ kind: "unlock", refId: "hero:health:rare", title: "גיבור נדיר — אי הבריאות", at: "2026-11-02T10:00:00Z" })]).find((x) => x.hero.id === "titan")!;
    expect(o.source).toBe("milestone");
    expect(o.at).toBe("2026-11-02T10:00:00Z");
  });
  it("the ledger the arena reads is the real one: a completed task in an island's goal unlocks its Common hero", () => {
    const db = dbWith([task({ id: "a", goalId: "g", status: "completed", completedAt: "2026-11-03T10:00:00.000Z", estimatedMinutes: 120, priority: "high" })]);
    db.goals.g = { id: "g", title: "g", description: "", why: "", kind: "learning", status: "active", startDate: "2026-11-01", startConfirmed: true, targetDate: "2027-11-01", unit: "", startValue: null, targetValue: null, manualValue: null, financeAccountId: null, info: {}, region: "social", color: "teal", order: 0, createdAt: "x", updatedAt: "x" };
    const earned = computeEarned(db, null, "2026-11-03").map((e) => ({ ...e, region: e.region ?? null }));
    const total = earned.filter((e) => e.region === "social").reduce((s, e) => s + e.amount, 0);
    expect(ownedIds(earned).includes("harmony")).toBe(total >= FIRST_LANDMARK_XP);
  });
  it("teams must be 3 distinct owned heroes", () => {
    expect(validTeam(["aegis", "sage", "vita"], STARTER_HEROES)).toBe(true);
    expect(validTeam(["aegis", "sage", "sage"], STARTER_HEROES)).toBe(false);
    expect(validTeam(["aegis", "sage", "croesus"], STARTER_HEROES)).toBe(false);
    expect(validTeam(["aegis", "sage"], STARTER_HEROES)).toBe(false);
  });
  it("hero levels and ratings", () => {
    expect(heroLevel(0).level).toBe(1);
    expect(heroLevel(1000).level).toBeGreaterThan(3);
    expect(ratingDelta(1000, 1000, 1)).toBe(14);
    expect(ratingDelta(1000, 1000, 0)).toBe(-14);
    expect(ratingDelta(1200, 1000, 1)).toBeLessThan(14);
  });
});
