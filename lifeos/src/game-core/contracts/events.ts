/**
 * Contract between LifeOS Core and the game layer — VerifiedLifeEvent, schema v1.
 *
 * Phase 1: defined and tested only. Nothing produces or stores these events yet (that is the
 * server-side Progression Gateway of phase 2, behind an approved migration). The game client never
 * creates them: it can only read them through the server.
 */
import { z } from "zod";

export const LIFE_EVENT_SCHEMA_VERSION = 1;
export const DOMAINS = ["wealth", "health", "knowledge", "career", "social", "mind"] as const;
export type Domain = (typeof DOMAINS)[number];

export const VerifiedLifeEvent = z
  .object({
    /** Deterministic: task:<id> | occ:<occurrenceId> | ms:<id> | goal:<id> | habit:<logId> | fix:<eventId>. */
    eventId: z.string().min(3).max(200),
    userId: z.string().min(1).max(100),
    source: z.literal("lifeos_core"),
    eventType: z.enum(["task_verified", "occurrence_verified", "habit_logged", "milestone_completed", "goal_completed", "verification_corrected"]),
    /** Who confirmed it. Today every confirmation in LifeOS is the user's own ("self"). */
    attestation: z.enum(["self", "external"]),
    sourceEntityId: z.string().min(1).max(200),
    domain: z.enum(DOMAINS).nullable(),
    /** Only on "verification_corrected": the event whose effect is reversed (history is never deleted). */
    correctsEventId: z.string().max(200).optional(),
    verifiedAt: z.string().datetime(),
    schemaVersion: z.literal(LIFE_EVENT_SCHEMA_VERSION),
  })
  .superRefine((e, ctx) => {
    if (e.eventType === "verification_corrected" && !e.correctsEventId) ctx.addIssue({ code: "custom", message: "correction must reference the corrected event" });
    if (e.eventType !== "verification_corrected" && e.correctsEventId) ctx.addIssue({ code: "custom", message: "only corrections reference another event" });
  });
export type VerifiedLifeEvent = z.infer<typeof VerifiedLifeEvent>;

/** Event ids are derived from the source entity, so the same achievement can't produce two events. */
export function lifeEventId(type: VerifiedLifeEvent["eventType"], sourceEntityId: string, corrects?: string): string {
  switch (type) {
    case "task_verified":
      return `task:${sourceEntityId}`;
    case "occurrence_verified":
      return `occ:${sourceEntityId}`;
    case "habit_logged":
      return `habit:${sourceEntityId}`;
    case "milestone_completed":
      return `ms:${sourceEntityId}`;
    case "goal_completed":
      return `goal:${sourceEntityId}`;
    case "verification_corrected":
      return `fix:${corrects}`;
  }
}
