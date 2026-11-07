import { z } from "zod";

/**
 * Schemas for the conversational goal-planning workflow.
 * Kept free of numeric/length constraints where they double as AI structured-output
 * schemas; business rules are enforced in validate.ts.
 */

// ───────── Conversation questions ─────────
export const QuestionInput = z.enum(["single", "multi", "number", "currency", "date", "text", "weekdays"]);
export type QuestionInput = z.infer<typeof QuestionInput>;

export const Question = z.object({
  /** Profile key this question fills. */
  key: z.string(),
  stage: z.number().describe("1-8 planning stage"),
  text: z.string().describe("The question, in Hebrew"),
  help: z.string().describe("Short Hebrew hint or why we ask; empty string if none"),
  input: QuestionInput,
  options: z.array(z.object({ value: z.string(), label: z.string() })),
  allowCustom: z.boolean(),
  unit: z.string().describe("Unit label for number inputs, e.g. ק״ג; empty if none"),
  /** Critical questions must be answered before a plan can be finalised. */
  critical: z.boolean(),
  /** Whether the user may skip it ("לא יודע/ת"). */
  skippable: z.boolean(),
});
export type Question = z.infer<typeof Question>;

export const FactKind = z.enum(["confirmed", "estimate", "assumption", "recommendation"]);
export type FactKind = z.infer<typeof FactKind>;

export const ProfileFact = z.object({
  key: z.string(),
  label: z.string(),
  /** Machine value: number, ISO date, string, or array of strings. */
  value: z.union([z.string(), z.number(), z.array(z.string()), z.null()]),
  /** Human-readable value in Hebrew. */
  display: z.string(),
  kind: FactKind,
  source: z.enum(["user", "ai", "app"]),
  updatedAt: z.string(),
});
export type ProfileFact = z.infer<typeof ProfileFact>;

// ───────── Plan ─────────
export const GPTask = z.object({
  key: z.string(),
  milestoneKey: z.string().nullable(),
  title: z.string(),
  notes: z.string(),
  durationMinutes: z.number(),
  deadline: z.string().describe("YYYY-MM-DD"),
  priority: z.enum(["high", "medium", "low"]),
  rationale: z.string(),
  dependsOn: z.array(z.string()),
  /** Proposed schedule (filled by the scheduler; user-editable). */
  date: z.string().nullable(),
  startTime: z.string().nullable(),
  reminderMinutes: z.number().nullable(),
  /** User removed it from the draft (kept so it can be restored). */
  excluded: z.boolean(),
  /** User edited it by hand — regeneration keeps it. */
  userEdited: z.boolean(),
});
export type GPTask = z.infer<typeof GPTask>;

export const GPRoutine = z.object({
  key: z.string(),
  milestoneKey: z.string().nullable(),
  title: z.string(),
  rationale: z.string(),
  freq: z.enum(["daily", "weekly", "monthly"]),
  interval: z.number(),
  byWeekday: z.array(z.number()).describe("0=Sunday..6=Saturday; for weekly"),
  /** Alternative day (not an extra session). */
  backupWeekday: z.number().nullable(),
  byMonthDay: z.number().nullable(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  durationMinutes: z.number(),
  startTime: z.string().nullable(),
  reminderMinutes: z.number().nullable(),
  excluded: z.boolean(),
  userEdited: z.boolean(),
});
export type GPRoutine = z.infer<typeof GPRoutine>;

export const GPMilestone = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string(),
  targetDate: z.string(),
  monthlyObjectives: z.array(z.object({ key: z.string(), month: z.string(), title: z.string() })),
  weeklyObjectives: z.array(z.object({ key: z.string(), weekStart: z.string(), title: z.string() })),
  excluded: z.boolean(),
});
export type GPMilestone = z.infer<typeof GPMilestone>;

export const GPMetric = z.object({
  key: z.string(),
  name: z.string(),
  unit: z.string(),
  baseline: z.number().nullable(),
  target: z.number().nullable(),
  /** Where measurements come from. */
  source: z.enum(["weight", "finance", "manual", "milestones"]),
  /** Outcome metric (goal achievement) vs. activity metric (effort). */
  type: z.enum(["outcome", "activity"]),
});
export type GPMetric = z.infer<typeof GPMetric>;

export const GoalPlan = z.object({
  summary: z.string(),
  outcome: z.string(),
  baseline: z.string(),
  targetDate: z.string(),
  successCriteria: z.array(z.string()),
  strategy: z.string(),
  rationale: z.string(),
  milestones: z.array(GPMilestone),
  tasks: z.array(GPTask),
  routines: z.array(GPRoutine),
  resources: z.array(z.string()),
  risks: z.array(z.object({ risk: z.string(), mitigation: z.string() })),
  assumptions: z.array(z.object({ text: z.string(), kind: FactKind })),
  metrics: z.array(GPMetric),
  review: z.object({ freq: z.enum(["weekly", "monthly"]), weekday: z.number(), startTime: z.string().nullable() }),
  unresolved: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type GoalPlan = z.infer<typeof GoalPlan>;
