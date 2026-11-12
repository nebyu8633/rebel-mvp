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

/** Falling below this brings you back to the landing. */
export const FALL_Y = -12;
