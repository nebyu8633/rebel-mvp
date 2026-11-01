import { z } from "zod";
import { GoalPlan, Question, FactKind } from "./schema";

/** What the client sends for one AI conversation turn (bounded). */
export const GoalTurnInput = z.object({
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  goal: z.object({ title: z.string().max(200), kind: z.string().max(20) }),
  phase: z.enum(["discovery", "plan_draft", "active", "revising"]),
  facts: z.array(z.object({ key: z.string().max(60), label: z.string().max(120), display: z.string().max(400), kind: FactKind })).max(60),
  skipped: z.array(z.string().max(60)).max(60),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) })).max(30),
  userMessage: z.string().max(2000),
  availability: z.string().max(300),
});
export type GoalTurnInput = z.infer<typeof GoalTurnInput>;

/** Structured output of one AI conversation turn. */
export const GoalTurnOutput = z.object({
  reply: z.string().describe("Short Hebrew reply: acknowledge, explain assumptions if any. No questions here — put the question in `question`."),
  factUpdates: z.array(
    z.object({
      key: z.string(),
      label: z.string().describe("Hebrew label"),
      value: z.string().describe("Machine value as text: digits for numbers, YYYY-MM-DD for dates, comma-separated for lists"),
      valueType: z.enum(["number", "text", "date", "list"]),
      display: z.string().describe("Hebrew human-readable value"),
      kind: FactKind.describe("confirmed only if the user explicitly said it; estimate if the user said it approximately"),
    }),
  ),
  question: Question.nullable().describe("The ONE next question, or null when enough information was collected"),
  stage: z.number().describe("Current planning stage 1-8"),
  readyForPlan: z.boolean(),
  contradictions: z.array(z.string()),
  separateGoals: z.array(z.object({ title: z.string(), description: z.string() })).describe("Non-empty only if the user described several distinct goals"),
});
export type GoalTurnOutput = z.infer<typeof GoalTurnOutput>;

export const GoalPlanInput = z.object({
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  goal: z.object({ title: z.string().max(200), kind: z.string().max(20) }),
  facts: GoalTurnInput.shape.facts,
  unresolved: z.array(z.string().max(200)).max(30),
  /** For revisions: the current plan and what the user asked to change. */
  currentPlan: GoalPlan.nullable(),
  changeRequest: z.string().max(2000).nullable(),
  /** Keys of tasks the user completed — must be kept unchanged. */
  completedKeys: z.array(z.string()).max(200),
});
export type GoalPlanInput = z.infer<typeof GoalPlanInput>;
