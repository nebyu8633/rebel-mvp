/**
 * Real-life enrichment: verified LifeOS events may grant OPTIONAL extras in AETHERIA (memories,
 * cosmetics, world details, small bonuses). The engine validates every grant:
 *  - only events that pass the VerifiedLifeEvent v1 contract are considered;
 *  - each event is applied at most once (idempotent by eventId);
 *  - grants only write `life:` flags, so essential content can never depend on them;
 *  - a verification_corrected event revokes what the corrected event granted (history is kept);
 *  - no grant touches combat balance, economy or physics (kinds are a closed set).
 */
import { VerifiedLifeEvent } from "../../progression/lifeEvents";
import { LIFE_FLAG_PREFIX } from "./model";
import { apply, type WorldState } from "./state";
import type { KingdomId } from "./model";

export type GrantKind = "memory" | "cosmetic" | "world_detail" | "bonus";
const ALLOWED: ReadonlySet<GrantKind> = new Set(["memory", "cosmetic", "world_detail", "bonus"]);

export interface EnrichmentRule {
  id: string;
  when: { eventTypes: VerifiedLifeEvent["eventType"][]; kingdom?: KingdomId | null };
  grant: { kind: GrantKind; id: string };
}

export interface EnrichmentLedger {
  /** eventId -> flag granted (or null when the event matched no rule) */
  applied: Record<string, string | null>;
}
export const emptyLedger = (): EnrichmentLedger => ({ applied: {} });

export function validateRules(rules: EnrichmentRule[]): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const r of rules) {
    if (ids.has(r.id)) errs.push(`duplicate rule ${r.id}`);
    ids.add(r.id);
    if (!ALLOWED.has(r.grant.kind)) errs.push(`${r.id}: grant kind not allowed`);
    if (!/^[a-z0-9_.-]{1,48}$/.test(r.grant.id)) errs.push(`${r.id}: invalid grant id`);
    if (!r.when.eventTypes.length || r.when.eventTypes.includes("verification_corrected")) errs.push(`${r.id}: invalid event types`);
  }
  return errs;
}

export const grantFlag = (g: EnrichmentRule["grant"]) => `${LIFE_FLAG_PREFIX}${g.kind}.${g.id}`;

export type EnrichmentResult = { state: WorldState; ledger: EnrichmentLedger; granted: string | null; revoked: string | null; rejected?: string };

export function applyLifeEvent(state: WorldState, ledger: EnrichmentLedger, raw: unknown, rules: EnrichmentRule[], now?: string): EnrichmentResult {
  const parsed = VerifiedLifeEvent.safeParse(raw);
  if (!parsed.success) return { state, ledger, granted: null, revoked: null, rejected: "not a valid VerifiedLifeEvent v1" };
  const e = parsed.data;
  if (e.eventId in ledger.applied) return { state, ledger, granted: null, revoked: null };
  const nextLedger: EnrichmentLedger = { applied: { ...ledger.applied, [e.eventId]: null } };

  if (e.eventType === "verification_corrected") {
    const flag = e.correctsEventId ? ledger.applied[e.correctsEventId] : null;
    if (!flag) return { state, ledger: nextLedger, granted: null, revoked: null };
    // revoke only if no other still-valid event granted the same flag
    const stillGranted = Object.entries(ledger.applied).some(([id, f]) => f === flag && id !== e.correctsEventId);
    if (stillGranted) return { state, ledger: nextLedger, granted: null, revoked: null };
    const r = apply(state, { type: "clearFlag", flag, source: "life" }, now);
    return { state: r.state, ledger: nextLedger, granted: null, revoked: r.ok && r.changed ? flag : null };
  }

  const rule = rules.find((r) => r.when.eventTypes.includes(e.eventType) && (r.when.kingdom === undefined || r.when.kingdom === e.domain));
  if (!rule) return { state, ledger: nextLedger, granted: null, revoked: null };
  const flag = grantFlag(rule.grant);
  const r = apply(state, { type: "setFlag", flag, source: "life" }, now);
  if (!r.ok) return { state, ledger, granted: null, revoked: null, rejected: r.reason };
  nextLedger.applied[e.eventId] = flag;
  return { state: r.state, ledger: nextLedger, granted: r.changed ? flag : null, revoked: null };
}
