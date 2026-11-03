import { z } from "zod";
import type { PlanInput, PlanProposal } from "../planner/schema";
import type { GoalTurnInput, GoalTurnOutput, GoalPlanInput } from "../goalplan/ai-schema";
import type { GoalPlan } from "../goalplan/schema";

/** Compact, user-scoped snapshot the client sends with a question. Bounded in size. */
export const AIContext = z.object({
  today: z.string(),
  timezone: z.string().max(64),
  goals: z
    .array(
      z.object({
        title: z.string().max(200),
        kind: z.string().max(20),
        targetDate: z.string(),
        progress: z.string().max(300),
        milestones: z.array(z.string().max(250)).max(20),
      }),
    )
    .max(20),
  today_tasks: z.array(z.string().max(300)).max(60),
  overdue: z.array(z.string().max(300)).max(60),
  upcoming_week: z.array(z.string().max(300)).max(120),
  week_stats: z.string().max(400),
  availability: z.string().max(300),
  meal_plan: z.array(z.string().max(300)).max(60),
  grocery: z.array(z.string().max(200)).max(150),
  /** Game layer summary (levels, regions, challenges) — present when asked from the game. */
  game: z.string().max(3000).optional(),
});
export type AIContext = z.infer<typeof AIContext>;

export const EvidenceInput = z.object({
  taskTitle: z.string().trim().min(1).max(300),
  criteria: z.string().max(500),
  /** JPEG data, base64 (no data: prefix). ~1.5MB max after client compression. */
  imageBase64: z.string().min(100).max(2_200_000),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});
export type EvidenceInput = z.infer<typeof EvidenceInput>;
export const EvidenceVerdict = z.object({
  verdict: z.enum(["likely", "unclear", "unlikely"]),
  reason: z.string().max(300),
});
export type EvidenceVerdict = z.infer<typeof EvidenceVerdict>;

export class AIError extends Error {
  constructor(
    public code: "not_configured" | "rate_limited" | "auth" | "bad_request" | "unavailable" | "invalid_output" | "refused",
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export interface AIProvider {
  readonly name: string;
  plan(input: PlanInput, today: string): Promise<PlanProposal>;
  ask(question: string, context: AIContext): Promise<string>;
  assessEvidence(input: EvidenceInput): Promise<EvidenceVerdict>;
  goalTurn(input: GoalTurnInput): Promise<GoalTurnOutput>;
  goalPlan(input: GoalPlanInput): Promise<GoalPlan>;
}
