/**
 * LifeOS hookup — interface only, mock data only.
 *
 * Mirrors the VerifiedLifeEvent v1 contract of lifeos/src/game-core/contracts/events.ts (copied, not
 * imported: this prototype is isolated from the app). The world may *react* to verified events
 * (visual feedback), but it can never award, compute or store Life XP: there is deliberately no
 * API here that returns or mutates XP. Life XP stays a LifeOS-server concern.
 */
import { z } from "zod";

export const DOMAINS = ["wealth", "health", "knowledge", "career", "social", "mind"] as const;
export type Domain = (typeof DOMAINS)[number];

export const VerifiedLifeEvent = z
  .object({
    eventId: z.string().min(1),
    userId: z.string().min(1),
    source: z.literal("lifeos_core"),
    eventType: z.enum(["task_verified", "occurrence_verified", "habit_logged", "milestone_completed", "goal_completed", "verification_corrected"]),
    attestation: z.enum(["self", "external"]),
    sourceEntityId: z.string().min(1),
    domain: z.enum(DOMAINS).nullable(),
    correctsEventId: z.string().min(1).optional(),
    verifiedAt: z.string().datetime(),
    schemaVersion: z.literal(1),
  })
  .superRefine((e, ctx) => {
    if (e.eventType === "verification_corrected" && !e.correctsEventId) ctx.addIssue({ code: "custom", message: "correction requires correctsEventId" });
    if (e.eventType !== "verification_corrected" && e.correctsEventId) ctx.addIssue({ code: "custom", message: "only corrections may reference correctsEventId" });
  });
export type VerifiedLifeEvent = z.infer<typeof VerifiedLifeEvent>;

/** What the world is allowed to do with an event: a purely visual reaction. */
export interface WorldReaction {
  eventId: string;
  kind: "celebrate" | "light_window" | "revert";
  domain: Domain | null;
  label: string;
  /** Marks mock-originated reactions so the UI can label them honestly. */
  mock: boolean;
}

/** Source of verified events. The real implementation (later) reads from the LifeOS server. */
export interface LifeEventSource {
  readonly kind: "mock" | "server";
  subscribe(listener: (e: VerifiedLifeEvent) => void): () => void;
}

/** Turns verified events into world reactions; rejects anything that is not a valid v1 event. Idempotent per eventId. */
export class LifeEventSink {
  private seen = new Set<string>();
  private reverted = new Set<string>();
  constructor(private readonly mock: boolean) {}

  accept(raw: unknown): { ok: true; reaction: WorldReaction | null } | { ok: false; error: string } {
    const parsed = VerifiedLifeEvent.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
    const e = parsed.data;
    if (this.seen.has(e.eventId)) return { ok: true, reaction: null };
    this.seen.add(e.eventId);
    if (e.eventType === "verification_corrected") {
      if (!e.correctsEventId || this.reverted.has(e.correctsEventId)) return { ok: true, reaction: null };
      this.reverted.add(e.correctsEventId);
      return { ok: true, reaction: { eventId: e.eventId, kind: "revert", domain: e.domain, label: "אימות בוטל — התגובה בעולם מבוטלת", mock: this.mock } };
    }
    const label =
      e.eventType === "milestone_completed" || e.eventType === "goal_completed"
        ? "אבן דרך הושלמה"
        : e.attestation === "external"
          ? "פעולה אומתה חיצונית"
          : "פעולה אושרה (אישור עצמי)";
    return { ok: true, reaction: { eventId: e.eventId, kind: e.eventType === "milestone_completed" || e.eventType === "goal_completed" ? "celebrate" : "light_window", domain: e.domain, label, mock: this.mock } };
  }
}

/** Mock source: emits sample events on demand. Clearly labelled; never connected to real data. */
export class MockLifeEventSource implements LifeEventSource {
  readonly kind = "mock" as const;
  private listeners = new Set<(e: VerifiedLifeEvent) => void>();
  private n = 0;
  subscribe(l: (e: VerifiedLifeEvent) => void) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  emit(type: VerifiedLifeEvent["eventType"] = "task_verified", domain: Domain | null = "knowledge", corrects?: string): VerifiedLifeEvent {
    this.n++;
    const e: VerifiedLifeEvent = {
      eventId: type === "verification_corrected" ? `fix:mock-${this.n}` : `task:mock-${this.n}`,
      userId: "mock-user",
      source: "lifeos_core",
      eventType: type,
      attestation: this.n % 3 === 0 ? "external" : "self",
      sourceEntityId: `mock-entity-${this.n}`,
      domain,
      ...(corrects ? { correctsEventId: corrects } : {}),
      verifiedAt: new Date().toISOString(),
      schemaVersion: 1,
    };
    for (const l of this.listeners) l(e);
    return e;
  }
}
