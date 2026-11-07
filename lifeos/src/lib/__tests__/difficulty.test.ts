import { describe, expect, it } from "vitest";
import { scoreDims, timeScore, XP_TABLE, evaluationFromAssessment, ruleEvaluation, effectiveEvaluation, contentHash, findDuplicate, paceRatio, evaluationsToFreeze, type Assessment } from "../game/difficulty";
import { taskRewards, milestoneEvaluation, goalEvaluation, PARENT_BUDGET } from "../game/rewards";
import { computeEarned, defaultProfile } from "../game/engine";
import type { DB, EvalDims, Goal, Milestone, Task } from "../types";
import { dbWith, task, T0 } from "./helpers";

const NOW = "2026-11-03T12:00:00.000Z";
const goal = (id: string, status: Goal["status"] = "active"): Goal => ({ id, title: id, description: "", why: "", kind: "learning", status, startDate: "2026-11-01", startConfirmed: true, targetDate: "2027-11-01", unit: "", startValue: null, targetValue: null, manualValue: null, financeAccountId: null, info: {}, region: null, color: "teal", order: 0, createdAt: T0, updatedAt: T0 });
const ms = (id: string, order: number, status: Milestone["status"] = "done", title = id): Milestone => ({ id, goalId: "g", title, description: "", targetDate: "2027-01-01", status, order, planVersionId: null, createdAt: T0, updatedAt: "2026-11-03T10:00:00.000Z" });
const assess = (p: Partial<Assessment>): Assessment => ({ estimatedMinutes: 60, steps: 3, complexity: 3, effort: 3, scope: 3, significance: 3, sufficient: true, questions: [], rationale: "x", ...p });
const dims = (v: number, sig = 3): EvalDims => ({ time: v, complexity: v, effort: v, scope: v, significance: sig });
const done = (id: string, p: Partial<Task> = {}) => task({ id, status: "completed", completedAt: "2026-11-03T10:00:00.000Z", createdAt: "2026-11-03T08:00:00.000Z", date: "2026-11-03", ...p });
function withEval(db: DB, t: Task, a: Partial<Assessment>) {
  db.evaluations[t.id] = evaluationFromAssessment({ db, task: t, now: "2026-11-03T09:00:00.000Z" }, assess(a));
}

describe("scoring model", () => {
  it("maps uniform ratings to the matching level and XP inside the configured range", () => {
    for (const l of [1, 2, 3, 4, 5] as const) {
      const s = scoreDims(dims(l));
      expect(s.level).toBe(l);
      expect(s.xp).toBeGreaterThanOrEqual(XP_TABLE[l][0]);
      expect(s.xp).toBeLessThanOrEqual(XP_TABLE[l][1]);
    }
  });
  it("is monotonic: more of any dimension never gives less XP", () => {
    let prev = 0;
    for (let v = 1; v <= 5; v += 0.25) {
      const xp = scoreDims(dims(v)).xp;
      expect(xp).toBeGreaterThanOrEqual(prev);
      prev = xp;
    }
  });
  it("goal significance alone can't raise the level of a small task", () => {
    expect(scoreDims(dims(1, 5)).level).toBe(1);
    expect(scoreDims(dims(2, 5)).level).toBe(2);
    expect(scoreDims({ ...dims(2), significance: 5 }).score - scoreDims({ ...dims(2), significance: 3 }).score).toBeLessThanOrEqual(0.15);
  });
  it("time score grows with minutes", () => {
    expect(timeScore(5)).toBe(1);
    expect(timeScore(45)).toBeGreaterThan(2);
    expect(timeScore(600)).toBe(5);
  });
});

describe("evaluation from AI ratings", () => {
  it("ignores implausible user minutes (typing a big number doesn't make a task harder)", () => {
    const t = task({ id: "a", title: "לשלוח מייל", estimatedMinutes: 600 });
    const db = dbWith([t]);
    const ev = evaluationFromAssessment({ db, task: t, now: NOW }, assess({ estimatedMinutes: 10, complexity: 1, effort: 1, scope: 1, steps: 1 }));
    expect(ev.estimatedMinutes).toBe(10);
    expect(ev.difficulty).toBe(1);
    expect(ev.reasons.join(" ")).toContain("לא תואם");
  });
  it("asks at most 2 questions and stops after two rounds of answers", () => {
    const t = task({ id: "a", title: "פרויקט" });
    const db = dbWith([t]);
    const q = [{ q: "כמה עמודים?", options: ["1", "10"] }, { q: "עד מתי?", options: [] }, { q: "שלישית", options: [] }];
    expect(evaluationFromAssessment({ db, task: t, now: NOW }, assess({ sufficient: false, questions: q })).questions).toHaveLength(2);
    const answers = Array.from({ length: 4 }, (_, i) => ({ q: `q${i}`, a: "x" }));
    expect(evaluationFromAssessment({ db, task: t, now: NOW, answers }, assess({ sufficient: false, questions: q })).questions).toHaveLength(0);
  });
  it("without AI the level is capped at 3", () => {
    const t = task({ id: "a", title: "תזה", estimatedMinutes: 600, notes: Array.from({ length: 20 }, (_, i) => `- שלב ${i}`).join("\n"), goalId: "g", milestoneId: "m" });
    const db = dbWith([t]);
    db.goals.g = goal("g");
    expect(ruleEvaluation(db, t, NOW).difficulty).toBeLessThanOrEqual(3);
  });
});

describe("scope changes & freezing", () => {
  it("editing the scope never inflates the reward until re-evaluation", () => {
    const t = task({ id: "a", title: "לקרוא פרק", estimatedMinutes: 30 });
    const db = dbWith([t]);
    withEval(db, t, { estimatedMinutes: 30, complexity: 2, effort: 2, scope: 2 });
    const before = effectiveEvaluation(db, t).ev.xp;
    db.tasks.a = { ...t, estimatedMinutes: 240, notes: "- 1\n- 2\n- 3\n- 4\n- 5\n- 6" };
    const after = effectiveEvaluation(db, db.tasks.a);
    expect(after.stale).toBe(true);
    expect(after.ev.xp).toBeLessThanOrEqual(before);
  });
  it("a completed task's evaluation is frozen; one is created at completion if missing", () => {
    const t = done("a", { estimatedMinutes: 20 });
    const db = dbWith([t]);
    const frozen = evaluationsToFreeze(db, NOW);
    expect(frozen.map((e) => e.id)).toEqual(["a"]);
    db.evaluations.a = frozen[0];
    db.tasks.a = { ...t, estimatedMinutes: 240, notes: "- 1\n- 2\n- 3\n- 4" };
    expect(effectiveEvaluation(db, db.tasks.a).ev.xp).toBe(frozen[0].xp);
    expect(contentHash(db.tasks.a)).not.toBe(frozen[0].contentHash);
  });
});

describe("anti-exploit rewards", () => {
  it("near-identical tasks on the same day are rewarded once", () => {
    const a = done("a", { title: "לקרוא 20 עמודים בספר", goalId: "g" });
    const b = done("b", { title: "לקרוא 20 עמודים בספר", goalId: "g", createdAt: "2026-11-03T08:05:00.000Z", completedAt: "2026-11-03T10:05:00.000Z" });
    const db = dbWith([a, b]);
    expect(findDuplicate(db, b)?.id).toBe("a");
    const r = taskRewards(db);
    expect(r.find((x) => x.id === "task:a")!.amount).toBeGreaterThan(0);
    expect(r.find((x) => x.id === "task:b")!.amount).toBe(0);
    expect(r.find((x) => x.id === "task:b")!.detail).toContain("כפילות");
  });
  it("the same activity again on another day is full XP (experience never lowers rewards)", () => {
    const a = done("a", { title: "ריצה 5 קילומטר" });
    const b = done("b", { title: "ריצה 5 קילומטר", date: "2026-11-04", createdAt: "2026-11-04T08:00:00.000Z", completedAt: "2026-11-04T10:00:00.000Z" });
    const r = taskRewards(dbWith([a, b]));
    expect(r[0].amount).toBe(r[1].amount);
  });
  it("repeats within a day are balanced 100/50/25/0", () => {
    const ts = [0, 1, 2, 3].map((i) => done(`r${i}`, { title: "שכיבות סמיכה", goalId: `g${i}`, completedAt: `2026-11-03T1${i}:00:00.000Z` }));
    const r = taskRewards(dbWith(ts));
    const base = r[0].amount;
    expect(r.map((x) => x.amount)).toEqual([base, Math.round(base * 0.5), Math.round(base * 0.25), 0]);
  });
  it("splitting a task into sub-tasks never beats the parent's budget", () => {
    const parent = done("p", { title: "לכתוב דוח רבעוני", completedAt: "2026-11-03T18:00:00.000Z" });
    const kids = Array.from({ length: 8 }, (_, i) => done(`c${i}`, { title: `חלק ${i} של הדוח ${"אבגדהוזח"[i]}`, parentTaskId: "p", completedAt: `2026-11-03T1${i}:00:00.000Z` }));
    const db = dbWith([parent, ...kids]);
    withEval(db, parent, { estimatedMinutes: 240, complexity: 4, effort: 4, scope: 4 });
    for (const k of kids) withEval(db, k, { estimatedMinutes: 60, complexity: 3, effort: 3, scope: 3 });
    const total = taskRewards(db).reduce((s, r) => s + r.amount, 0);
    expect(total).toBeLessThanOrEqual(Math.round(db.evaluations.p.xp * PARENT_BUDGET));
  });
  it("many tiny tasks in one day: full for the first 12, half up to 24, then nothing", () => {
    const ts = Array.from({ length: 30 }, (_, i) => done(`t${i}`, { title: `משימה ${"אבגדהוזחטי"[i % 10]}${"קלמ"[Math.floor(i / 10)]}ץ`, estimatedMinutes: 5, goalId: `g${i}`, completedAt: `2026-11-03T${String(6 + Math.floor(i / 3)).padStart(2, "0")}:${String((i % 3) * 10).padStart(2, "0")}:00.000Z` }));
    const r = taskRewards(dbWith(ts));
    const full = r[0].amount;
    expect(r.slice(0, 12).every((x) => x.amount === full)).toBe(true);
    expect(r[12].amount).toBe(Math.round(full / 2));
    expect(r.slice(24).every((x) => x.amount === 0)).toBe(true);
  });
  it("XP from 10 tiny pieces ≤ XP of one honest big task of the same total work (with a parent)", () => {
    const big = done("big", { title: "פרויקט שלם" });
    const db1 = dbWith([big]);
    withEval(db1, big, { estimatedMinutes: 300, complexity: 4, effort: 4, scope: 4 });
    const bigXp = taskRewards(db1)[0].amount;
    const p = task({ id: "p", title: "פרויקט שלם" });
    const kids = Array.from({ length: 10 }, (_, i) => done(`k${i}`, { title: `חתיכה ${i} ${"אבגדהוזחטי"[i]}`, parentTaskId: "p", completedAt: `2026-11-03T1${i % 10}:00:00.000Z` }));
    const db2 = dbWith([p, ...kids]);
    withEval(db2, p, { estimatedMinutes: 300, complexity: 4, effort: 4, scope: 4 });
    for (const k of kids) withEval(db2, k, { estimatedMinutes: 30, complexity: 2, effort: 2, scope: 2 });
    expect(taskRewards(db2).reduce((s, r) => s + r.amount, 0)).toBeLessThanOrEqual(Math.round(bigXp * PARENT_BUDGET));
  });
  it("missed tasks are never penalized (no negative XP)", () => {
    const db = dbWith([task({ id: "late", date: "2026-10-01" }), done("a")]);
    expect(taskRewards(db).every((r) => r.amount >= 0)).toBe(true);
    expect(computeEarned(db, defaultProfile("2026-11-03", T0), "2026-11-03").every((e) => e.amount >= 0)).toBe(true);
  });
});

describe("milestones & goals", () => {
  function msDb(taskCount: number, level: Partial<Assessment>) {
    const ts = Array.from({ length: taskCount }, (_, i) => done(`t${i}`, { title: `שלב ${"אבגדהוזחטיכלמ"[i]} בעבודה ${i}`, milestoneId: "m1", goalId: "g", completedAt: `2026-11-0${1 + (i % 3)}T1${i % 10}:00:00.000Z` }));
    const db = dbWith(ts);
    db.goals.g = goal("g");
    db.milestones = { m1: ms("m1", 0, "done", "סיום פרק ראשון בקורס") };
    for (const t of ts) withEval(db, t, level);
    return db;
  }
  it("tiers come from the real work behind the milestone", () => {
    expect(milestoneEvaluation(msDb(1, { estimatedMinutes: 10, complexity: 1, effort: 1, scope: 1 }), ms("m1", 0)).tier).toBe("minor");
    const big = milestoneEvaluation(msDb(8, { estimatedMinutes: 150, complexity: 4, effort: 4, scope: 4 }), ms("m1", 0));
    expect(["epic", "epic_plus"]).toContain(big.tier);
    expect(big.unlocks.some((u) => u.kind === "hero" && u.rarity === "epic")).toBe(true);
  });
  it("a minor milestone unlocks no hero; rewards are granted once per milestone (deterministic ids)", () => {
    const db = msDb(4, { estimatedMinutes: 60, complexity: 3, effort: 3, scope: 3 });
    const e1 = computeEarned(db, null, "2026-11-03").filter((e) => e.kind === "unlock");
    const e2 = computeEarned(db, null, "2026-11-03").filter((e) => e.kind === "unlock");
    expect(e1.length).toBeGreaterThan(0);
    expect(e1.map((e) => e.id)).toEqual(e2.map((e) => e.id));
    expect(new Set(e1.map((e) => e.id)).size).toBe(e1.length);
    expect(computeEarned(msDb(1, { estimatedMinutes: 5, complexity: 1, effort: 1, scope: 1 }), null, "2026-11-03").some((e) => e.kind === "unlock")).toBe(false);
  });
  it("a duplicate milestone (same achievement) is not rewarded again; a locked one isn't rewarded", () => {
    const db = msDb(4, { estimatedMinutes: 60 });
    db.milestones.m2 = { ...ms("m2", 1, "done", "סיום פרק ראשון בקורס"), updatedAt: "2026-11-03T11:00:00.000Z" };
    expect(milestoneEvaluation(db, db.milestones.m2).eligible).toBe(false);
    db.milestones.m0 = ms("m0", -1, "pending", "שלב מוקדם");
    expect(milestoneEvaluation(db, db.milestones.m1).eligible).toBe(false);
  });
  it("legendary unlock only for a goal with real work behind it", () => {
    const db = dbWith([]);
    db.goals.g = goal("g", "done");
    expect(goalEvaluation(db, "g").unlocks).toEqual([]);
    const db2 = msDb(4, { estimatedMinutes: 60 });
    db2.goals.g = goal("g", "done");
    expect(goalEvaluation(db2, "g").unlocks.some((u) => u.rarity === "legendary")).toBe(true);
  });
});

describe("personal calibration", () => {
  it("pace adapts the personal duration estimate, not the XP", () => {
    const hist = [0, 1, 2, 3].map((i) => done(`h${i}`, { title: `קריאה ${i}`, estimatedMinutes: 60, actualMinutes: 30 }));
    const t = task({ id: "new", title: "קריאה חדשה", estimatedMinutes: 60 });
    const db = dbWith([...hist, t]);
    expect(paceRatio(db).ratio).toBe(0.5);
    const ev = evaluationFromAssessment({ db, task: t, now: NOW }, assess({ estimatedMinutes: 60 }));
    const evNew = evaluationFromAssessment({ db: dbWith([t]), task: t, now: NOW }, assess({ estimatedMinutes: 60 }));
    expect(ev.personalMinutes).toBe(30);
    expect(ev.xp).toBe(evNew.xp);
    expect(ev.familiarity).not.toBe("new");
  });
});
