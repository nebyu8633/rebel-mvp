import { describe, expect, it } from "vitest";
import { detectKind, extractFacts, nextQuestion, normalizeAnswer, makeFact, missingCritical, splitGoals, contradictions, type Facts } from "../goalplan/interview";
import { buildGoalPlan, regenerate } from "../goalplan/builder";
import { validateGoalPlan } from "../goalplan/validate";
import { schedulePlan } from "../goalplan/scheduler";
import { buildActivation, ids } from "../goalplan/activation";
import { emptyDB, type DB, type Goal, type PlanVersion, type Settings } from "../types";
import type { BatchOp } from "../store/repo";
import { instancesInRange } from "../tasks";
import { T0, task } from "./helpers";

const today = "2026-11-01"; // Sunday
const now = "2026-11-01T08:00:00.000Z";

function answerAll(kind: Parameters<typeof nextQuestion>[0], answers: Record<string, unknown>, start: Facts = {}): Facts {
  const f: Facts = { ...start };
  const skipped: string[] = [];
  for (let i = 0; i < 40; i++) {
    const q = nextQuestion(kind, f, skipped);
    if (!q) break;
    if (!(q.key in answers)) {
      skipped.push(q.key);
      continue;
    }
    const n = normalizeAnswer(q, answers[q.key] as never, today);
    expect(n.error).toBeUndefined();
    f[q.key] = makeFact(q, n.value, now);
  }
  return f;
}

function settings(av: Array<number | null>): Settings {
  return { id: "settings", displayName: "", timezone: "Asia/Jerusalem", weekStartsOn: 0, availability: av, mealReminders: [], notifyInApp: true, notifyBrowser: false, defaultReminderMinutes: 15, mealPrepDay: 2, mealPrepBackupDay: 6, onboarded: true, createdAt: T0, updatedAt: T0 };
}

function applyOps(db: DB, ops: BatchOp[]): DB {
  const next = structuredClone(db) as DB;
  for (const o of ops) {
    const col = next[o.collection] as Record<string, unknown>;
    if (o.op === "put") col[o.entity.id] = structuredClone(o.entity);
    else delete col[o.id];
  }
  return next;
}

describe("interview", () => {
  it("detects kinds and extracts stated facts so they are not asked again", () => {
    expect(detectKind("אני רוצה לעלות 10 קילו בתוך שנה")).toBe("weight");
    expect(detectKind("להגיע לתיק השקעות בשווי 30,000 ₪")).toBe("portfolio");
    expect(detectKind("אני רוצה ללמוד שפה חדשה")).toBe("learning");
    expect(detectKind("להגדיל את ההכנסה החודשית")).toBe("income");
    const f = extractFacts("אני רוצה לעלות 10 קילו בתוך שנה", "weight", today, now);
    expect(f.targetChange.value).toBe(10);
    expect(f.targetDate.value).toBe("2027-11-01");
    const q = nextQuestion("weight", f, []);
    expect(q?.key).toBe("currentWeight");
    const keys: string[] = [];
    const ff = { ...f };
    for (let i = 0; i < 20; i++) {
      const n = nextQuestion("weight", ff, keys);
      if (!n) break;
      keys.push(n.key);
    }
    expect(keys).not.toContain("targetChange");
    expect(keys).not.toContain("targetDate");
  });

  it("offers to split multiple distinct goals", () => {
    const s = splitGoals("אני רוצה לעלות 5 קילו וגם להגיע לתיק השקעות של 20 אלף ₪");
    expect(s.map((x) => x.kind).sort()).toEqual(["portfolio", "weight"]);
    expect(splitGoals("אני רוצה לעלות 5 קילו")).toEqual([]);
  });

  it("adapts follow-ups (license timeline only without a license) and validates answers", () => {
    const base = answerAll("motorcycle", { model: "Yamaha MT-07", savedSoFar: 5000, hasLicense: "yes", price: 40000, targetDate: "12", monthlySaving: 2000, weeklyHours: 2 }, extractFacts("אני רוצה לקנות אופנוע", "motorcycle", today, now));
    expect(base.licenseTimeline).toBeUndefined();
    const noLic = answerAll("motorcycle", { model: "X", savedSoFar: 0, hasLicense: "no", licenseTimeline: "parallel", price: 40000, targetDate: "12", monthlySaving: 2000, weeklyHours: 2 }, extractFacts("לקנות אופנוע", "motorcycle", today, now));
    expect(noLic.licenseTimeline.value).toBe("parallel");
    const q = nextQuestion("weight", {}, [])!;
    expect(normalizeAnswer(q, "abc", today).error).toBeTruthy();
    const dq = nextQuestion("custom", { outcome: base.model, baseline: base.model, metric: base.model, metricTarget: base.model }, [])!;
    expect(dq.key).toBe("targetDate");
    expect(normalizeAnswer(dq, "2020-01-01", today).error).toBeTruthy();
    expect(normalizeAnswer(dq, "6", today).value).toBe("2027-05-01");
  });

  it("reports missing critical info and contradictions", () => {
    const f = answerAll("portfolio", { currentValue: 40000, targetValue: 30000 });
    expect(missingCritical("portfolio", f)).toContain("תאריך יעד");
    expect(contradictions("portfolio", f, today).join()).toContain("לא גבוה");
  });
});

describe("plan builder", () => {
  const kinds = {
    weight: { currentWeight: 62, targetChange: 10, targetDate: "12", weeklyHours: 3, preferredDays: ["0", "2", "4"], preferredTime: "evening", reviewDay: "5" },
    portfolio: { currentValue: 8000, targetValue: 30000, targetDate: "12", monthlyContribution: 1000, weeklyHours: 1 },
    motorcycle: { model: "MT-07", savedSoFar: 5000, hasLicense: "no", licenseTimeline: "parallel", price: 40000, targetDate: "12", monthlySaving: 2000, weeklyHours: 2 },
    income: { outcome: "יותר ביטחון", currentIncome: 9000, targetIncome: 13000, targetDate: "12", weeklyHours: 5, incomePath: ["job", "side"] },
    learning: { subject: "ספרדית", outcome: "שיחה", currentLevel: "none", targetLevel: "conversation", targetDate: "12", weeklyHours: 3, method: ["app", "tutor"] },
    custom: { outcome: "לרוץ 10 ק״מ", baseline: "רץ 2 ק״מ", metric: "ק״מ ברצף", metricTarget: 10, targetDate: "6", weeklyHours: 3 },
  } as const;
  for (const [kind, ans] of Object.entries(kinds)) {
    it(`${kind}: valid structured plan with stable keys and labelled assumptions`, () => {
      const f = answerAll(kind as never, ans as never);
      const plan = buildGoalPlan({ kind: kind as never, title: "מטרה", facts: f, today });
      const v = validateGoalPlan(plan, { today });
      expect(v.errors).toEqual([]);
      expect(plan.milestones.length).toBeGreaterThan(0);
      expect(plan.tasks.every((t) => t.rationale && t.deadline >= today && t.deadline <= plan.targetDate)).toBe(true);
      expect(plan.metrics.length).toBeGreaterThan(0);
      const again = buildGoalPlan({ kind: kind as never, title: "מטרה", facts: f, today });
      expect(again.tasks.map((t) => t.key)).toEqual(plan.tasks.map((t) => t.key));
    });
  }

  it("never invents a missing price; marks estimates", () => {
    const f = answerAll("purchase", { item: "מחשב נייד", savedSoFar: 0, targetDate: "6", monthlySaving: 500, weeklyHours: 1 });
    const plan = buildGoalPlan({ kind: "purchase", title: "מחשב", facts: f, today });
    expect(plan.unresolved).toContain("מחיר");
    expect(plan.tasks.some((t) => t.key === "b-research")).toBe(true);
    f.savedSoFar = { ...f.savedSoFar, kind: "estimate" };
    const p2 = buildGoalPlan({ kind: "purchase", title: "מחשב", facts: f, today });
    expect(p2.assumptions.some((a) => a.kind === "estimate")).toBe(true);
  });

  it("regeneration keeps user-edited and excluded items", () => {
    const f = answerAll("learning", kinds.learning as never);
    const p = buildGoalPlan({ kind: "learning", title: "ספרדית", facts: f, today });
    p.tasks[0] = { ...p.tasks[0], title: "כותרת שלי", userEdited: true };
    p.tasks[1] = { ...p.tasks[1], excluded: true };
    const r = regenerate(p, buildGoalPlan({ kind: "learning", title: "ספרדית", facts: f, today }));
    expect(r.tasks[0].title).toBe("כותרת שלי");
    expect(r.tasks[1].excluded).toBe(true);
  });
});

describe("scheduler", () => {
  const f = answerAll("learning", { subject: "ספרדית", outcome: "x", currentLevel: "none", targetLevel: "conversation", targetDate: "12", weeklyHours: 3, method: ["app"], preferredDays: ["1", "3"], preferredTime: "evening" });
  const plan = buildGoalPlan({ kind: "learning", title: "ספרדית", facts: f, today });

  it("without any availability info: leaves tasks unscheduled and says so", () => {
    const db = emptyDB();
    const { plan: p, report } = schedulePlan(plan, { db, today, goalId: "g", weeklyMinutes: null, preferredDays: [], preferredTime: null });
    expect(report.needsAvailability).toBe(true);
    expect(p.tasks.every((t) => t.date === null)).toBe(true);
  });

  it("respects preferred days, existing events and dependencies; never over the daily buffer", () => {
    const db = emptyDB();
    db.settings.settings = settings([0, 120, 0, 120, 0, 0, 0]);
    db.events.e1 = { id: "e1", title: "פגישה", date: "2026-11-02", startTime: "18:00", endTime: "19:30", location: "", notes: "", recurrence: null, reminderMinutes: null, createdAt: T0, updatedAt: T0 };
    const { plan: p, report } = schedulePlan(plan, { db, today, goalId: "g", weeklyMinutes: 180, preferredDays: [1, 3], preferredTime: "evening" });
    const dated = p.tasks.filter((t) => t.date && !report.overloaded.some((o) => o.key === t.key));
    expect(dated.every((t) => [1, 3].includes(new Date(t.date! + "T00:00:00Z").getUTCDay()))).toBe(true);
    for (const t of p.tasks.filter((x) => x.date === "2026-11-02" && x.startTime)) {
      const s = Number(t.startTime!.slice(0, 2)) * 60 + Number(t.startTime!.slice(3));
      expect(s >= 19 * 60 + 45 || s + t.durationMinutes <= 17 * 60 + 45).toBe(true);
    }
    const byKey = Object.fromEntries(p.tasks.map((t) => [t.key, t]));
    for (const t of p.tasks) for (const d of t.dependsOn) if (byKey[d].date && t.date) expect(byKey[d].date! < t.date!).toBe(true);
  });

  it("flags overload and proposes alternatives instead of silently cramming", () => {
    const db = emptyDB();
    db.settings.settings = settings([30, 30, 30, 30, 30, 30, 30]);
    const { report } = schedulePlan(plan, { db, today, goalId: "g", weeklyMinutes: 30, preferredDays: [], preferredTime: null });
    expect(report.overloaded.length).toBeGreaterThan(0);
    expect(report.alternatives.map((a) => a.id)).toContain("extend");
  });
});

describe("activation", () => {
  const goal: Goal = { id: "g1", title: "ספרדית", description: "", why: "", kind: "learning", status: "planning", startDate: today, startConfirmed: false, targetDate: "2027-11-01", unit: "", startValue: null, targetValue: null, manualValue: null, financeAccountId: null, info: {}, color: "teal", order: 0, createdAt: T0, updatedAt: T0 };
  const f = answerAll("learning", { subject: "ספרדית", outcome: "x", currentLevel: "none", targetLevel: "conversation", targetDate: "12", weeklyHours: 3, method: ["app"], preferredDays: ["1", "3"] });
  const mkVersion = (id: string, v: number, plan = buildGoalPlan({ kind: "learning", title: "ספרדית", facts: f, today })): PlanVersion => ({ id, goalId: "g1", version: v, status: "draft", plan, basedOnVersionId: null, approvedAt: null, createdAt: T0, updatedAt: T0 });

  function setup() {
    let db = emptyDB();
    db.goals.g1 = goal;
    db.settings.settings = settings([60, 60, 60, 60, 60, 60, 60]);
    const v1 = mkVersion("v1", 1);
    v1.plan = schedulePlan(v1.plan, { db, today, goalId: "g1", weeklyMinutes: 180, preferredDays: [1, 3], preferredTime: null }).plan;
    db.planVersions.v1 = v1;
    const { ops, summary } = buildActivation({ db, goal, version: v1, facts: f, today, now });
    db = applyOps(db, ops);
    return { db, v1, summary };
  }

  it("creates linked milestones, tasks, routines and a review series; version becomes approved", () => {
    const { db, v1, summary } = setup();
    const goalTasks = Object.values(db.tasks).filter((t) => t.goalId === "g1");
    expect(goalTasks.length).toBe(v1.plan.tasks.length + v1.plan.routines.length + 1);
    expect(goalTasks.every((t) => t.planVersionId === "v1")).toBe(true);
    expect(goalTasks.filter((t) => t.milestoneId).every((t) => db.milestones[t.milestoneId!]?.goalId === "g1")).toBe(true);
    expect(db.planVersions.v1.status).toBe("approved");
    expect(db.goals.g1.status).toBe("active");
    expect(summary.created.length).toBe(goalTasks.length);
    // the same records feed the calendar / dashboard
    expect(instancesInRange(db, today, "2026-11-30", today).some((i) => i.task.goalId === "g1")).toBe(true);
  });

  it("is idempotent: re-running activation creates no duplicates", () => {
    const { db } = setup();
    const before = Object.keys(db.tasks).length;
    const again = applyOps(db, buildActivation({ db, goal: db.goals.g1, version: db.planVersions.v1, facts: f, today, now }).ops);
    expect(Object.keys(again.tasks).length).toBe(before);
    expect(Object.keys(again.milestones).length).toBe(Object.keys(db.milestones).length);
  });

  it("revision preserves completed tasks and occurrence history; removes only open obsolete tasks", () => {
    let { db } = setup();
    const placement = ids.task("g1", "l-placement");
    db.tasks[placement] = { ...db.tasks[placement], status: "completed", completedAt: now };
    const study = ids.routine("g1", "l-study");
    db.occurrences[`${study}:2026-11-02`] = { id: `${study}:2026-11-02`, taskId: study, originalDate: "2026-11-02", status: "completed", date: null, startTime: null, title: null, notes: null, completedAt: now, createdAt: T0, updatedAt: T0 };
    // v2: drop placement + materials, move study to Tue/Thu
    const p2 = structuredClone(db.planVersions.v1.plan);
    p2.tasks = p2.tasks.filter((t) => t.key !== "l-placement" && t.key !== "l-materials");
    p2.tasks.forEach((t) => (t.dependsOn = t.dependsOn.filter((d) => d !== "l-placement")));
    p2.routines = p2.routines.map((r) => (r.key === "l-study" ? { ...r, byWeekday: [2, 4] } : r));
    const v2 = { ...mkVersion("v2", 2, p2), basedOnVersionId: "v1" };
    db.planVersions.v2 = v2;
    const { ops, summary } = buildActivation({ db, goal: db.goals.g1, version: v2, facts: f, today, now });
    db = applyOps(db, ops);
    expect(db.tasks[placement].status).toBe("completed");
    expect(summary.removed).toContain(db.planVersions.v1.plan.tasks.find((t) => t.key === "l-materials")!.title);
    expect(db.tasks[ids.task("g1", "l-materials")]).toBeUndefined();
    expect(db.tasks[study].recurrence!.byWeekday).toEqual([2, 4]);
    const nov = instancesInRange(db, "2026-11-01", "2026-11-07", today).filter((i) => i.task.id === study);
    expect(nov.map((i) => [i.date, i.status])).toEqual([["2026-11-02", "completed"], ["2026-11-03", "planned"], ["2026-11-05", "planned"]]);
    expect(db.planVersions.v1.status).toBe("superseded");
    expect(db.planVersions.v2.status).toBe("approved");
  });

  it("revision keeps dates the user changed in the calendar", () => {
    let { db } = setup();
    const id = ids.task("g1", "l-materials");
    db.tasks[id] = { ...db.tasks[id], date: "2026-12-24", startTime: "19:00" };
    const v2 = { ...mkVersion("v2", 2, structuredClone(db.planVersions.v1.plan)), basedOnVersionId: "v1" };
    db.planVersions.v2 = v2;
    db = applyOps(db, buildActivation({ db, goal: db.goals.g1, version: v2, facts: f, today, now }).ops);
    expect(db.tasks[id].date).toBe("2026-12-24");
    expect(db.tasks[id].startTime).toBe("19:00");
    expect(Object.values(db.tasks).filter((t) => t.id === id)).toHaveLength(1);
  });

  it("does not touch tasks that belong to other goals or were created by hand", () => {
    let { db } = setup();
    db.tasks.manual = task({ id: "manual", goalId: "g1", date: today });
    db = applyOps(db, buildActivation({ db, goal: db.goals.g1, version: { ...db.planVersions.v1, id: "v3", version: 3 }, facts: f, today, now }).ops);
    expect(db.tasks.manual).toBeDefined();
  });
});

describe("titles", () => {
  it("keeps the infinitive intact", async () => {
    const { suggestTitle } = await import("../goalplan/interview");
    expect(suggestTitle("אני רוצה ללמוד ספרדית בתוך שנה.", "learning")).toBe("ללמוד ספרדית בתוך שנה");
    expect(suggestTitle("אני רוצה לקנות אופנוע", "motorcycle")).toBe("לקנות אופנוע");
  });
});
