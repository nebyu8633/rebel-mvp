/**
 * Wires the mock LifeOS event source to the world. Visual reactions only (lit hall windows,
 * a smile, a feed entry). Nothing here computes or stores Life XP.
 */
import { LifeEventSink, MockLifeEventSource, type Domain } from "./lifeEvents";
import { useProto } from "../store";
import { playerReactions } from "../engine/events";

const source = new MockLifeEventSource();
const sink = new LifeEventSink(true);
const emitted: string[] = [];
source.subscribe((e) => {
  const r = sink.accept(e);
  if (!r.ok || !r.reaction) return;
  useProto.getState().pushReaction(r.reaction);
  playerReactions.emit(r.reaction.kind === "revert" ? "surprise" : r.reaction.kind === "celebrate" ? "celebrate" : "acknowledge");
});

const DOMS: Domain[] = ["knowledge", "health", "career", "social", "mind", "wealth"];
/** Kiosk interaction: emit one sample verified event (every 4th is a milestone). */
export function emitMockEvent() {
  const n = emitted.length;
  const e = source.emit(n % 4 === 3 ? "milestone_completed" : "task_verified", DOMS[n % DOMS.length]);
  emitted.push(e.eventId);
}
/** Debug: send a correction for the latest event (reverts its visual reaction). */
export function emitMockCorrection() {
  const last = emitted.pop();
  if (last) source.emit("verification_corrected", null, last);
}
