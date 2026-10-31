import { describe, expect, it } from "vitest";
import { fallbackPlan, PlanInputError } from "../planner/fallback";
import { validatePlan, schedulePlanTasks, findCycle } from "../planner/validate";
import { PlanInput, type PlanTask } from "../planner/schema";
import { buildRecoveryPlan } from "../recovery";
import { dbWith, task, rule, T0 } from "./helpers";

const today = "2026-11-01";
const base = (p: Partial<PlanInput>) =>
  PlanInput.parse({ kind: "custom", title: "ללמוד גיטרה", startDate: today, targetDate: "2027-11-01", ...p });

describe("deterministic planner", () => {
  it("motorcycle plan requires the key financial information first", () => {
    expect(() => fallbackPlan(base({ kind: "motorcycle", title: "אופנוע" }), today)).toThrow(PlanInputError);
  });

  it("produces a valid hierarchy with deadlines inside the window", () => {
    for (const kind of ["motorcycle", "weight", "portfolio", "custom"] as const) {
      const p = fallbackPlan(
        base({ kind, data: { model: "Yamaha", price: 40000, savedSoFar: 5000, monthlySavingCapacity: 2000, currentWeight: 62, currentValue: 8000 } }),
        today,
      );
      const v = validatePlan(p, { today, targetDate: "2027-11-01" });
      expect(v.errors).toEqual([]);
      expect(v.ok).toBe(true);
      const tasks = v.plan!.milestones.flatMap((m) => m.tasks);
      expect(tasks.length).toBeGreaterThan(0);
      for (const t of tasks) {
        expect(t.deadline >= today && t.deadline <= "2027-11-01").toBe(true);
        expect(t.rationale.length).toBeGreaterThan(0);
        expect(t.durationMinutes).toBeGreaterThan(0);
      }
    }
  });

  it("separates user-provided data from assumptions and warns when savings capacity is insufficient", () => {
    const p = fallbackPlan(base({ kind: "motorcycle", data: { model: "X", price: 60000, savedSoFar: 0, monthlySavingCapacity: 1000 } }), today);
    expect(p.userProvided.join(" ")).toContain("1,000");
    expect(p.assumptions.length).toBeGreaterThan(0);
    expect(p.warnings.join(" ")).toMatch(/יותר מיכולת החיסכון/);
  });

  it("portfolio plan without a current value does not invent one", () => {
    const p = fallbackPlan(base({ kind: "portfolio", data: {} }), today);
    expect(p.warnings.join(" ")).toContain("לא הוזן");
    expect(p.milestones[0].tasks[0].title).toContain("לרשום את שווי התיק");
  });

  it("regenerating one milestone keeps the others", () => {
    const p = fallbackPlan(base({}), today);
    const key = p.milestones[1].key;
    const r = fallbackPlan(base({ regenerateMilestoneKey: key, previous: p }), today);
    expect(r.milestones[0]).toEqual(p.milestones[0]);
    expect(r.milestones[2]).toEqual(p.milestones[2]);
    const keys = r.milestones.flatMap((m) => m.tasks.map((t) => t.key));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("plan validation", () => {
  const t = (key: string, deps: string[] = [], deadline = "2026-11-10"): PlanTask => ({ key, title: key, durationMinutes: 30, deadline, priority: "medium", rationale: "r", dependsOn: deps });
  const plan = (tasks: PlanTask[]) => ({
    summary: "", facts: [], userProvided: [], assumptions: [], recommendations: [], warnings: [], habits: [],
    milestones: [{ key: "m", title: "m", description: "", targetDate: "2026-12-01", monthlyObjectives: [], weeklyObjectives: [], tasks }],
  });

  it("rejects garbage and dependency cycles", () => {
    expect(validatePlan({ nope: 1 }, { today, targetDate: "2027-01-01" }).ok).toBe(false);
    expect(findCycle([t("a", ["b"]), t("b", ["a"])])).not.toBeNull();
    expect(validatePlan(plan([t("a", ["b"]), t("b", ["a"])]), { today, targetDate: "2027-01-01" }).ok).toBe(false);
  });

  it("repairs out-of-range dates and unknown dependencies", () => {
    const v = validatePlan(plan([t("a", ["ghost"], "2020-01-01"), t("b", [], "2030-01-01")]), { today, targetDate: "2027-01-01" });
    expect(v.ok).toBe(true);
    const [a, b] = v.plan!.milestones[0].tasks;
    expect(a.deadline).toBe(today);
    expect(a.dependsOn).toEqual([]);
    expect(b.deadline).toBe("2027-01-01");
    expect(v.fixes.length).toBeGreaterThanOrEqual(3);
  });
});

describe("scheduling within availability", () => {
  const t = (key: string, dur: number, deadline: string, deps: string[] = []): PlanTask => ({ key, title: key, durationMinutes: dur, deadline, priority: "medium", rationale: "", dependsOn: deps });
  const avail = [60, 60, 60, 60, 60, 60, 60];

  it("schedules dependencies before dependents and never exceeds capacity silently", () => {
    const { scheduled, warnings } = schedulePlanTasks([t("b", 45, "2026-11-05", ["a"]), t("a", 45, "2026-11-05")], {
      today, availability: avail, existingMinutes: () => 0,
    });
    const date = Object.fromEntries(scheduled.map((s) => [s.task.key, s.date]));
    expect(date.a < date.b).toBe(true);
    expect(warnings).toEqual([]);
  });

  it("does not front-load far-future tasks", () => {
    const { scheduled } = schedulePlanTasks([t("q", 30, "2027-02-01")], { today, availability: avail, existingMinutes: () => 0 });
    expect(scheduled[0].date).toBe("2027-01-22");
  });

  it("warns when work does not fit before the deadline", () => {
    const { scheduled, warnings } = schedulePlanTasks([t("a", 50, "2026-11-01"), t("b", 50, "2026-11-01")], {
      today, availability: avail, existingMinutes: () => 0,
    });
    expect(scheduled.filter((s) => s.overloaded)).toHaveLength(1);
    expect(warnings.length).toBe(1);
  });
});

describe("recovery plan", () => {
  it("spreads missed work over the week instead of piling it on tomorrow", () => {
    const missed = ["a", "b", "c", "d", "e"].map((id) => task({ id, date: "2026-10-28", estimatedMinutes: 60, priority: "high" }));
    const routine = task({ id: "r", recurrence: rule({ freq: "daily", startDate: "2026-10-30" }) });
    const db = dbWith([...missed, routine]);
    db.settings.settings = {
      id: "settings", displayName: "", timezone: "Asia/Jerusalem", weekStartsOn: 0,
      availability: [90, 90, 90, 90, 90, 90, 90], mealReminders: [], notifyInApp: true, notifyBrowser: false,
      defaultReminderMinutes: 15, mealPrepDay: 2, mealPrepBackupDay: 6, onboarded: true, createdAt: T0, updatedAt: T0,
    };
    const plan = buildRecoveryPlan(db, today);
    const moves = plan.actions.filter((a) => a.action === "move");
    expect(moves).toHaveLength(5);
    const perDay = new Map<string, number>();
    for (const m of moves) perDay.set(m.date!, (perDay.get(m.date!) ?? 0) + 1);
    expect(Math.max(...perDay.values())).toBe(1);
    expect(plan.actions.filter((a) => a.action === "skip").every((a) => a.key.startsWith("r:"))).toBe(true);
  });
});
