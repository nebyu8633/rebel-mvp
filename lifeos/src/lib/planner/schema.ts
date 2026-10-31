import { z } from "zod";

/**
 * Plan proposal format. Shared by the AI provider (as its structured-output schema)
 * and by the deterministic fallback. Kept free of numeric/length constraints so it
 * can be used as an API structured-output schema; business rules are enforced
 * separately in validate.ts.
 */
export const PlanTask = z.object({
  key: z.string().describe("Unique short id inside this plan, e.g. 't1'"),
  title: z.string().describe("Clear action in Hebrew starting with a verb"),
  durationMinutes: z.number().describe("Suggested duration in minutes"),
  deadline: z.string().describe("YYYY-MM-DD proposed deadline"),
  priority: z.enum(["high", "medium", "low"]),
  rationale: z.string().describe("One short Hebrew sentence: why this task matters for the milestone"),
  dependsOn: z.array(z.string()).describe("Keys of tasks that must be done first"),
});
export type PlanTask = z.infer<typeof PlanTask>;

export const PlanMilestone = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string(),
  targetDate: z.string().describe("YYYY-MM-DD"),
  monthlyObjectives: z.array(z.object({ month: z.string().describe("YYYY-MM-01"), title: z.string() })),
  weeklyObjectives: z.array(z.object({ weekStart: z.string().describe("YYYY-MM-DD (Sunday)"), title: z.string() })),
  tasks: z.array(PlanTask),
});
export type PlanMilestone = z.infer<typeof PlanMilestone>;

export const SuggestedHabit = z.object({
  title: z.string(),
  timesPerWeek: z.number().describe("1-7"),
  rationale: z.string(),
});
export type SuggestedHabit = z.infer<typeof SuggestedHabit>;

export const PlanProposal = z.object({
  summary: z.string(),
  /** Objective, generally-true facts (e.g. licensing exists in Israel). */
  facts: z.array(z.string()),
  /** Restating only what the user actually entered. */
  userProvided: z.array(z.string()),
  /** Anything the plan assumes that the user did not say. */
  assumptions: z.array(z.string()),
  recommendations: z.array(z.string()),
  warnings: z.array(z.string()),
  milestones: z.array(PlanMilestone),
  habits: z.array(SuggestedHabit),
});
export type PlanProposal = z.infer<typeof PlanProposal>;

export const PlanInput = z.object({
  goalId: z.string().nullable().default(null),
  kind: z.enum(["motorcycle", "weight", "portfolio", "custom"]),
  title: z.string().trim().min(2, "יש לתאר את המטרה").max(200),
  description: z.string().max(2000).default(""),
  startDate: z.string(),
  targetDate: z.string(),
  currentState: z.string().max(2000).default(""),
  desiredOutcome: z.string().max(2000).default(""),
  /** Minutes per week the user can dedicate to this goal. */
  weeklyMinutes: z.number().int().min(0).max(7 * 24 * 60).nullable().default(null),
  constraints: z.string().max(2000).default(""),
  commitments: z.string().max(2000).default(""),
  /** Kind-specific numeric data the user entered (e.g. motorcycle costs, current weight, portfolio value). */
  data: z.record(z.string(), z.union([z.number(), z.string(), z.null()])).default({}),
  /** When set, regenerate only this milestone (by key) of `previous`. */
  regenerateMilestoneKey: z.string().nullable().default(null),
  previous: PlanProposal.nullable().default(null),
});
export type PlanInput = z.infer<typeof PlanInput>;
