/**
 * The Kingdom of Knowledge — the Hall of Patterns (first slice). Metres; bearings 0 = north (-Z),
 * clockwise. Floating platforms joined by paths of light, over a void of stars.
 */
import type { P3 } from "../shared/LightPath";

export const LANDING = { x: 0, y: 0, z: 26, r: 4.5 };
export const HALL = { x: 0, y: 0, z: 0, r: 9 };
export const SPAWN = { x: 0, y: 0, z: 27.5, yaw: Math.PI };
export const WAYSTONE = { x: 2.6, z: 27.8 };

const at = (bearing: number, r: number) => {
  const a = (bearing * Math.PI) / 180;
  return { x: Math.sin(a) * r, z: -Math.cos(a) * r };
};
/** Three satellite platforms around the hall (the pattern dials will stand on them). */
export const SATELLITES = [
  { id: "west", bearing: -72, y: 2.2 },
  { id: "north", bearing: 0, y: 4.0 },
  { id: "east", bearing: 72, y: 3.0 },
].map((s) => ({ ...s, ...at(s.bearing, 23), r: 4.5 }));

/** Straight paths (in plan) from one platform's edge to the next. */
function edgePath(from: { x: number; z: number; y: number; r: number }, to: { x: number; z: number; y: number; r: number }): P3[] {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dz);
  const ux = dx / d;
  const uz = dz / d;
  const a: P3 = [from.x + ux * (from.r - 0.6), from.y, from.z + uz * (from.r - 0.6)];
  const b: P3 = [to.x - ux * (to.r - 0.6), to.y, to.z - uz * (to.r - 0.6)];
  return [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], b];
}
export const PATHS: P3[][] = [edgePath(LANDING, HALL), ...SATELLITES.map((s) => edgePath(HALL, s))];

/** The Gate of the Living (to the Kingdom of Health): its path appears when the codex opens. */
export const LIVING_GATE = { ...at(144, 22), y: 1, r: 4 };
export const LIVING_PATH: P3[] = edgePath(HALL, LIVING_GATE);
/** coming back from the Grove: stand on the gate's platform, facing the hall */
export const LIVING_GATE_ARRIVAL = {
  x: LIVING_GATE.x * 0.88,
  y: LIVING_GATE.y + 0.2,
  z: LIVING_GATE.z * 0.88,
  yaw: Math.atan2(-LIVING_GATE.x, -LIVING_GATE.z),
};

/** Falling below this brings you back to the landing. */
export const FALL_Y = -12;
