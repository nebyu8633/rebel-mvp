import type { CollectionName, DB, FinanceAccount, Goal, Settings, Task } from "./types";
import { addMonths, addDays, weekday } from "./dates";
import { MotorcycleInfo } from "./types";

export const SEED_IDS = {
  motorcycle: "goal-motorcycle",
  weight: "goal-weight",
  portfolio: "goal-portfolio",
  motoAccount: "acct-motorcycle",
  portfolioAccount: "acct-portfolio",
  grocery: "routine-grocery",
  mealPrep: "routine-meal-prep",
  review: "routine-weekly-review",
};

/** Next date on/after `from` that falls on `wd`. */
export function nextWeekday(from: string, wd: number): string {
  return addDays(from, (wd - weekday(from) + 7) % 7);
}

/**
 * Initial data for a brand-new account. Only things the user asked for — no invented
 * finances, weights or meal times. Each piece is created only if missing, so re-running is safe.
 */
export function buildSeed(db: DB, today: string, timezone: string, nowIso: string): Array<[CollectionName, unknown]> {
  const out: Array<[CollectionName, unknown]> = [];
  const ts = { createdAt: nowIso, updatedAt: nowIso };
  const has = (c: CollectionName, id: string) => Boolean((db[c] as Record<string, unknown>)[id]);
  const firstRun = Object.keys(db.settings).length === 0;

  if (firstRun) {
    const settings: Settings = {
      id: "settings",
      displayName: "",
      timezone,
      weekStartsOn: 0,
      availability: [null, null, null, null, null, null, null],
      mealReminders: [],
      notifyInApp: true,
      notifyBrowser: false,
      defaultReminderMinutes: 15,
      mealPrepDay: 2,
      mealPrepBackupDay: 6,
      onboarded: false,
      ...ts,
    };
    out.push(["settings", settings]);
  } else return out; // seed only once per account

  const target = addMonths(today, 12);
  const baseGoal = {
    description: "",
    startDate: today,
    startConfirmed: false,
    targetDate: target,
    manualValue: null,
    ...ts,
  };
  const goals: Goal[] = [
    {
      ...baseGoal,
      id: SEED_IDS.motorcycle,
      title: "לקנות אופנוע",
      why: "חופש תנועה ועצמאות",
      kind: "motorcycle",
      status: "planning",
      unit: "₪",
      startValue: null,
      targetValue: null,
      financeAccountId: SEED_IDS.motoAccount,
      info: MotorcycleInfo.parse({}),
      color: "amber",
      order: 0,
    },
    {
      ...baseGoal,
      id: SEED_IDS.weight,
      title: "לעלות 10 ק״ג",
      why: "גוף חזק יותר ואנרגיה",
      kind: "weight",
      status: "planning",
      unit: "ק״ג",
      startValue: null,
      targetValue: null,
      financeAccountId: null,
      info: { targetGain: 10 },
      color: "teal",
      order: 1,
    },
    {
      ...baseGoal,
      id: SEED_IDS.portfolio,
      title: "תיק השקעות בשווי ₪30,000",
      why: "ביטחון כלכלי לטווח ארוך",
      kind: "portfolio",
      status: "planning",
      unit: "₪",
      startValue: null,
      targetValue: 30000,
      financeAccountId: SEED_IDS.portfolioAccount,
      info: {},
      color: "indigo",
      order: 2,
    },
  ];
  for (const g of goals) if (!has("goals", g.id)) out.push(["goals", g]);

  const accounts: FinanceAccount[] = [
    { id: SEED_IDS.motoAccount, name: "חיסכון לאופנוע", kind: "savings", goalId: SEED_IDS.motorcycle, target: null, ...ts },
    { id: SEED_IDS.portfolioAccount, name: "תיק השקעות", kind: "portfolio", goalId: SEED_IDS.portfolio, target: 30000, ...ts },
  ];
  for (const a of accounts) if (!has("financeAccounts", a.id)) out.push(["financeAccounts", a]);

  const baseTask = {
    notes: "",
    milestoneId: null,
    objectiveId: null,
    date: null,
    startTime: null,
    deadline: null,
    status: "planned" as const,
    reminderMinutes: null,
    dependsOn: [],
    source: "seed" as const,
    completedAt: null,
    history: [],
    ...ts,
  };
  const routines: Task[] = [
    {
      ...baseTask,
      id: SEED_IDS.grocery,
      title: "קניות שבועיות",
      goalId: SEED_IDS.weight,
      priority: "medium",
      estimatedMinutes: 60,
      rationale: "קונים בדיוק את מה שהתפריט המאושר דורש — בלי כפילויות.",
      routine: "grocery",
      recurrence: {
        freq: "weekly",
        interval: 1,
        byWeekday: [4],
        startDate: nextWeekday(today, 4),
        endDate: null,
        count: null,
        paused: false,
        exceptions: [],
        missedPolicy: "carry",
        backupWeekday: null,
      },
    },
    {
      ...baseTask,
      id: SEED_IDS.mealPrep,
      title: "הכנת אוכל לימים הקרובים",
      goalId: SEED_IDS.weight,
      priority: "medium",
      estimatedMinutes: 90,
      rationale: "אוכל מוכן מראש מקל לאכול מספיק גם בימים עמוסים.",
      routine: "meal_prep",
      recurrence: {
        freq: "weekly",
        interval: 1,
        byWeekday: [2],
        startDate: nextWeekday(today, 2),
        endDate: null,
        count: null,
        paused: false,
        exceptions: [],
        missedPolicy: "backup",
        backupWeekday: 6,
      },
    },
    {
      ...baseTask,
      id: SEED_IDS.review,
      title: "סיכום שבועי",
      goalId: null,
      priority: "medium",
      estimatedMinutes: 20,
      rationale: "רגע לראות מה הושלם, מה נתקע ומה הכי חשוב בשבוע הבא.",
      routine: "weekly_review",
      recurrence: {
        freq: "weekly",
        interval: 1,
        byWeekday: [5],
        startDate: nextWeekday(today, 5),
        endDate: null,
        count: null,
        paused: false,
        exceptions: [],
        missedPolicy: "carry",
        backupWeekday: null,
      },
    },
  ];
  for (const r of routines) if (!has("tasks", r.id)) out.push(["tasks", r]);
  return out;
}
