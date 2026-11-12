/**
 * Where the player appears when entering a world through a passage (e.g. coming back from the
 * Kingdom of Knowledge lands you at its threshold, not at the Sanctuary's start). Module state, so it
 * survives in-app navigation between pages; consumed once by the destination world.
 */
import type { WorldId } from "./worldStore";

export interface ArrivalPoint {
  x: number;
  y: number;
  z: number;
  yaw: number;
}
let pending: { world: WorldId; at: ArrivalPoint } | null = null;

export function setArrival(world: WorldId, at: ArrivalPoint) {
  pending = { world, at };
}
/** Returns (and clears) the arrival point for `world`, if one is waiting. */
export function takeArrival(world: WorldId): ArrivalPoint | null {
  if (!pending || pending.world !== world) return null;
  const a = pending.at;
  pending = null;
  return a;
}
