import { z } from "zod";
import { GoalPlan, ProfileFact, Question } from "./goalplan/schema";

/** Calendar date in the user's time zone, "YYYY-MM-DD". */
export const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");
/** Wall-clock time in the user's time zone, "HH:mm". */
export const TimeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "שעה לא תקינה");

const id = z.string().min(1);
const timestamps = { createdAt: z.string(), updatedAt: z.string() };

// ───────────────────────── Recurrence ─────────────────────────
export const RecurrenceRule = z.object({
  freq: z.enum(["daily", "weekly", "monthly"]),
  /** Every N days/weeks/months. */
  interval: z.number().int().min(1).max(365).default(1),
  /** Weekly: days of week, 0=Sunday … 6=Saturday. */
  byWeekday: z.array(z.number().int().min(0).max(6)).optional(),
  /** Monthly: day of month 1-31 (clamped to month length). */
  byMonthDay: z.number().int().min(1).max(31).optional(),
  startDate: DateStr,
  endDate: DateStr.nullable().optional(),
  /** Stop after N occurrences. */
  count: z.number().int().min(1).max(5000).nullable().optional(),
  paused: z.boolean().default(false),
  /** Dates (original occurrence dates) that are cancelled for this series only. */
  exceptions: z.array(DateStr).default([]),
  /**
   * What happens when an occurrence's day passes without completion:
   * - skip: mark as missed, it disappears from "today".
   * - carry: stays in the overdue list until done/skipped.
   * - backup: move to the backup weekday (same week) once, then treat as missed.
   */
  missedPolicy: z.enum(["skip", "carry", "backup"]).default("carry"),
  backupWeekday: z.number().int().min(0).max(6).nullable().optional(),
});
export type RecurrenceRule = z.infer<typeof RecurrenceRule>;

// ───────────────────────── Goals ─────────────────────────
export const GoalKind = z.enum(["motorcycle", "weight", "portfolio", "purchase", "income", "learning", "custom"]);
export type GoalKind = z.infer<typeof GoalKind>;

export const MotorcycleInfo = z.object({
  model: z.string().default(""),
  price: z.number().nonnegative().nullable().default(null),
  licenseCost: z.number().nonnegative().nullable().default(null),
  licenseNotes: z.string().default(""),
  insuranceYearly: z.number().nonnegative().nullable().default(null),
  gearCost: z.number().nonnegative().nullable().default(null),
  maintenanceYearly: z.number().nonnegative().nullable().default(null),
  otherCosts: z.number().nonnegative().nullable().default(null),
  monthlySavingCapacity: z.number().nonnegative().nullable().default(null),
});
export type MotorcycleInfo = z.infer<typeof MotorcycleInfo>;

export const Goal = z.object({
  id,
  title: z.string().min(2, "כותרת קצרה מדי").max(120),
  description: z.string().max(2000).default(""),
  why: z.string().max(500).default(""),
  kind: GoalKind,
  status: z.enum(["planning", "active", "paused", "done"]),
  startDate: DateStr,
  startConfirmed: z.boolean().default(false),
  targetDate: DateStr,
  unit: z.string().max(20).default(""),
  startValue: z.number().nullable().default(null),
  targetValue: z.number().nullable().default(null),
  /** For custom goals: manually reported current value. */
  manualValue: z.number().nullable().default(null),
  financeAccountId: z.string().nullable().default(null),
  info: z.record(z.string(), z.unknown()).default({}),
  color: z.string().default("teal"),
  order: z.number().default(0),
  ...timestamps,
});
export type Goal = z.infer<typeof Goal>;

export const Milestone = z.object({
  id,
  goalId: id,
  title: z.string().min(2).max(200),
  description: z.string().max(2000).default(""),
  targetDate: DateStr.nullable().default(null),
  status: z.enum(["pending", "active", "done"]),
  order: z.number().default(0),
  planVersionId: z.string().nullable().default(null),
  ...timestamps,
});
export type Milestone = z.infer<typeof Milestone>;

export const Objective = z.object({
  id,
  goalId: id,
  milestoneId: z.string().nullable().default(null),
  level: z.enum(["month", "week"]),
  /** First day of the month / week. */
  periodStart: DateStr,
  title: z.string().min(2).max(300),
  status: z.enum(["pending", "done"]),
  ...timestamps,
});
export type Objective = z.infer<typeof Objective>;

// ───────────────────────── Tasks ─────────────────────────
export const TaskStatus = z.enum(["planned", "in_progress", "completed", "skipped", "postponed"]);
export type TaskStatus = z.infer<typeof TaskStatus>;
export const Priority = z.enum(["high", "medium", "low"]);
export type Priority = z.infer<typeof Priority>;
export const RoutineKind = z.enum(["grocery", "meal_prep", "weekly_review"]);
export type RoutineKind = z.infer<typeof RoutineKind>;

export const HistoryEntry = z.object({
  at: z.string(),
  action: z.enum(["created", "rescheduled", "status", "edited"]),
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
});

export const Task = z.object({
  id,
  title: z.string().trim().min(1, "חובה לכתוב מה המשימה").max(200),
  notes: z.string().max(4000).default(""),
  goalId: z.string().nullable().default(null),
  milestoneId: z.string().nullable().default(null),
  objectiveId: z.string().nullable().default(null),
  priority: Priority.default("medium"),
  estimatedMinutes: z.number().int().min(0).max(24 * 60).nullable().default(null),
  /** Scheduled day. Null = inbox / unscheduled. For recurring tasks this is ignored (rule.startDate rules). */
  date: DateStr.nullable().default(null),
  startTime: TimeStr.nullable().default(null),
  /** Hard deadline (optional, separate from the scheduled day). */
  deadline: DateStr.nullable().default(null),
  status: TaskStatus.default("planned"),
  recurrence: RecurrenceRule.nullable().default(null),
  /** Minutes before startTime. Null = no reminder. */
  reminderMinutes: z.number().int().min(0).max(24 * 60).nullable().default(null),
  rationale: z.string().max(600).default(""),
  dependsOn: z.array(z.string()).default([]),
  routine: RoutineKind.nullable().default(null),
  source: z.enum(["user", "planner", "ai", "seed"]).default("user"),
  completedAt: z.string().nullable().default(null),
  history: z.array(HistoryEntry).default([]),
  /** Approved plan version that created/last updated this task (null = created by hand). */
  planVersionId: z.string().nullable().default(null),
  ...timestamps,
});
export type Task = z.infer<typeof Task>;

/**
 * Per-occurrence state of a recurring task. The id is deterministic
 * (`${taskId}:${originalDate}`) so the same occurrence can never be duplicated.
 */
export const Occurrence = z.object({
  id,
  taskId: id,
  originalDate: DateStr,
  status: TaskStatus,
  /** "This occurrence only" overrides. */
  date: DateStr.nullable().default(null),
  startTime: TimeStr.nullable().default(null),
  title: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  completedAt: z.string().nullable().default(null),
  ...timestamps,
});
export type Occurrence = z.infer<typeof Occurrence>;

// ───────────────────────── Calendar events ─────────────────────────
export const CalendarEvent = z.object({
  id,
  title: z.string().trim().min(1, "חובה לתת שם לאירוע").max(200),
  date: DateStr,
  startTime: TimeStr.nullable().default(null),
  endTime: TimeStr.nullable().default(null),
  location: z.string().max(200).default(""),
  notes: z.string().max(2000).default(""),
  recurrence: RecurrenceRule.nullable().default(null),
  reminderMinutes: z.number().int().min(0).max(24 * 60).nullable().default(null),
  ...timestamps,
});
export type CalendarEvent = z.infer<typeof CalendarEvent>;

// ───────────────────────── Habits ─────────────────────────
export const Habit = z.object({
  id,
  title: z.string().trim().min(1, "חובה לתת שם להרגל").max(120),
  goalId: z.string().nullable().default(null),
  frequency: z.discriminatedUnion("type", [
    z.object({ type: z.literal("daily") }),
    z.object({ type: z.literal("weekdays"), days: z.array(z.number().int().min(0).max(6)).min(1) }),
    z.object({ type: z.literal("times_per_week"), count: z.number().int().min(1).max(7) }),
  ]),
  startDate: DateStr,
  paused: z.boolean().default(false),
  reminderTime: TimeStr.nullable().default(null),
  order: z.number().default(0),
  ...timestamps,
});
export type Habit = z.infer<typeof Habit>;

export const HabitLog = z.object({
  /** `${habitId}:${date}` */
  id,
  habitId: id,
  date: DateStr,
  status: z.enum(["done", "skipped"]),
  ...timestamps,
});
export type HabitLog = z.infer<typeof HabitLog>;

// ───────────────────────── Meals & groceries ─────────────────────────
export const Ingredient = z.object({
  name: z.string().trim().min(1).max(80),
  quantity: z.number().nonnegative(),
  unit: z.string().trim().max(20).default(""),
});
export type Ingredient = z.infer<typeof Ingredient>;

export const Meal = z.object({
  id,
  name: z.string().trim().min(1, "חובה לתת שם למנה").max(120),
  portions: z.number().int().min(1).max(100).default(1),
  ingredients: z.array(Ingredient).default([]),
  prepNotes: z.string().max(2000).default(""),
  ...timestamps,
});
export type Meal = z.infer<typeof Meal>;

export const MealSlot = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export type MealSlot = z.infer<typeof MealSlot>;

export const MealPlanEntry = z.object({
  id,
  date: DateStr,
  slot: MealSlot,
  mealId: id,
  portions: z.number().min(0.25).max(100).default(1),
  /** Which day this meal will be prepared (cooked ahead). */
  prepDate: DateStr.nullable().default(null),
  prepared: z.boolean().default(false),
  ...timestamps,
});
export type MealPlanEntry = z.infer<typeof MealPlanEntry>;

export const MealWeek = z.object({
  /** id = weekStart date */
  id,
  weekStart: DateStr,
  approved: z.boolean(),
  approvedAt: z.string().nullable().default(null),
  ...timestamps,
});
export type MealWeek = z.infer<typeof MealWeek>;

export const GroceryItem = z.object({
  id,
  weekStart: DateStr,
  name: z.string().trim().min(1).max(80),
  quantity: z.number().nonnegative().nullable().default(null),
  unit: z.string().max(20).default(""),
  purchased: z.boolean().default(false),
  source: z.enum(["plan", "manual"]),
  /** Normalized aggregation key (name|unit) for plan items, used for de-duplication. */
  key: z.string().default(""),
  /** Quantity computed from the plan (kept even when the user adjusts `quantity`). */
  planQuantity: z.number().nullable().default(null),
  adjusted: z.boolean().default(false),
  ...timestamps,
});
export type GroceryItem = z.infer<typeof GroceryItem>;

export const PantryItem = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  quantity: z.number().nonnegative(),
  unit: z.string().max(20).default(""),
  ...timestamps,
});
export type PantryItem = z.infer<typeof PantryItem>;

// ───────────────────────── Finance ─────────────────────────
export const FinanceAccount = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["savings", "portfolio"]),
  goalId: z.string().nullable().default(null),
  target: z.number().nonnegative().nullable().default(null),
  ...timestamps,
});
export type FinanceAccount = z.infer<typeof FinanceAccount>;

export const FinanceEntry = z.object({
  id,
  accountId: id,
  date: DateStr,
  /**
   * deposit / withdrawal = money moved in or out.
   * valuation = the account's total value on that date as reported by the user
   *             (for a portfolio: market value; for savings: a balance correction).
   */
  kind: z.enum(["deposit", "withdrawal", "valuation"]),
  amount: z.number().nonnegative("סכום חייב להיות חיובי").max(100_000_000),
  note: z.string().max(300).default(""),
  ...timestamps,
});
export type FinanceEntry = z.infer<typeof FinanceEntry>;

export const WeightLog = z.object({
  id,
  date: DateStr,
  kg: z.number().min(20, "משקל לא סביר").max(400, "משקל לא סביר"),
  note: z.string().max(300).default(""),
  ...timestamps,
});
export type WeightLog = z.infer<typeof WeightLog>;

// ───────────────────────── Settings ─────────────────────────
export const MealReminder = z.object({
  id,
  label: z.string().trim().min(1).max(40),
  time: TimeStr,
  enabled: z.boolean().default(true),
});
export type MealReminder = z.infer<typeof MealReminder>;

export const Settings = z.object({
  id,
  displayName: z.string().max(60).default(""),
  timezone: z.string().default("Asia/Jerusalem"),
  weekStartsOn: z.number().int().min(0).max(6).default(0),
  /** Minutes available for planned work per weekday (0=Sunday). null = not set. */
  availability: z.array(z.number().int().min(0).max(24 * 60).nullable()).length(7),
  mealReminders: z.array(MealReminder).default([]),
  notifyInApp: z.boolean().default(true),
  notifyBrowser: z.boolean().default(false),
  defaultReminderMinutes: z.number().int().min(0).max(24 * 60).default(15),
  /** Meal prep routine preferences (also reflected on the routine task). */
  mealPrepDay: z.number().int().min(0).max(6).nullable().default(2),
  mealPrepBackupDay: z.number().int().min(0).max(6).nullable().default(6),
  onboarded: z.boolean().default(false),
  ...timestamps,
});
export type Settings = z.infer<typeof Settings>;

// ───────────────────────── Conversational goal planning ─────────────────────────
export const GoalConversation = z.object({
  /** One conversation per goal: id = goalId. */
  id,
  goalId: id,
  mode: z.enum(["basic", "ai"]).default("basic"),
  /** discovery → plan_draft → active → revising */
  phase: z.enum(["discovery", "plan_draft", "active", "revising"]),
  stage: z.number().int().min(1).max(8),
  /** Question currently awaiting an answer (null = none). */
  pending: Question.nullable().default(null),
  /** Keys the user explicitly skipped ("לא יודע/ת"). */
  skipped: z.array(z.string()).default([]),
  ...timestamps,
});
export type GoalConversation = z.infer<typeof GoalConversation>;

export const ConversationMessage = z.object({
  id,
  goalId: id,
  role: z.enum(["user", "assistant", "system"]),
  text: z.string().max(8000),
  /** Structured question shown with this assistant message. */
  question: Question.nullable().default(null),
  /** For user messages: which question/key this answers. */
  answerKey: z.string().nullable().default(null),
  source: z.enum(["basic", "ai", "app"]).default("basic"),
  ...timestamps,
});
export type ConversationMessage = z.infer<typeof ConversationMessage>;

export const GoalProfile = z.object({
  /** id = goalId */
  id,
  goalId: id,
  facts: z.record(z.string(), ProfileFact).default({}),
  unresolved: z.array(z.string()).default([]),
  ...timestamps,
});
export type GoalProfile = z.infer<typeof GoalProfile>;

export const PlanVersion = z.object({
  id,
  goalId: id,
  version: z.number().int().min(1),
  /** draft: editable; approved: immutable snapshot; superseded: older approved version. */
  status: z.enum(["draft", "approved", "superseded", "discarded"]),
  plan: GoalPlan,
  basedOnVersionId: z.string().nullable().default(null),
  approvedAt: z.string().nullable().default(null),
  ...timestamps,
});
export type PlanVersion = z.infer<typeof PlanVersion>;

export const Reminder = z.object({
  id,
  taskId: id,
  /** before_start: N minutes before the start time; before_deadline: N minutes before 09:00 on the deadline day; at: absolute date+time. */
  kind: z.enum(["before_start", "before_deadline", "at"]),
  minutes: z.number().int().min(0).max(60 * 24 * 14).nullable().default(null),
  date: DateStr.nullable().default(null),
  time: TimeStr.nullable().default(null),
  enabled: z.boolean().default(true),
  ...timestamps,
});
export type Reminder = z.infer<typeof Reminder>;

export const ProgressRecord = z.object({
  id,
  goalId: id,
  metricKey: z.string().default("main"),
  date: DateStr,
  value: z.number(),
  note: z.string().max(300).default(""),
  ...timestamps,
});
export type ProgressRecord = z.infer<typeof ProgressRecord>;

// ───────────────────────── Database shape ─────────────────────────
export const COLLECTIONS = {
  goals: Goal,
  milestones: Milestone,
  objectives: Objective,
  tasks: Task,
  occurrences: Occurrence,
  events: CalendarEvent,
  habits: Habit,
  habitLogs: HabitLog,
  meals: Meal,
  mealPlan: MealPlanEntry,
  mealWeeks: MealWeek,
  groceries: GroceryItem,
  pantry: PantryItem,
  financeAccounts: FinanceAccount,
  financeEntries: FinanceEntry,
  weightLogs: WeightLog,
  settings: Settings,
  conversations: GoalConversation,
  messages: ConversationMessage,
  profiles: GoalProfile,
  planVersions: PlanVersion,
  reminders: Reminder,
  progressRecords: ProgressRecord,
} as const;

export type CollectionName = keyof typeof COLLECTIONS;
export type EntityOf<C extends CollectionName> = z.infer<(typeof COLLECTIONS)[C]>;
export type DB = { [C in CollectionName]: Record<string, EntityOf<C>> };

export function emptyDB(): DB {
  const db = {} as DB;
  for (const k of Object.keys(COLLECTIONS) as CollectionName[]) (db as Record<string, unknown>)[k] = {};
  return db;
}
