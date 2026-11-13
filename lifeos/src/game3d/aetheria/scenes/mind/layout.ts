/**
 * The Kingdom of the Mind — the Hall of Reflections. Metres. White floating islands; an inverted
 * mirror-world above (mirrored across MIRROR_Y). Bridges are straight in plan and gently sloped.
 */
import type { P3 } from "../shared/LightPath";

// low enough that the inverted world is in view from a third-person camera
export const MIRROR_Y = 20;
export const SPAWN = { x: 0, y: 0, z: 24, yaw: Math.PI };
export const ISLANDS = {
  first: { x: 0, y: 0, z: 22, r: 6.5 },
  second: { x: -17, y: 2, z: 6, r: 5.5 },
  third: { x: -4, y: 4, z: -12, r: 5.5 },
  core: { x: 15, y: 6, z: -4, r: 7.5 },
};
export const WAYSTONE = { x: 3, z: 25 };
export const FALL_Y = -14;

function bridge(a: { x: number; y: number; z: number; r: number }, b: { x: number; y: number; z: number; r: number }): P3[] {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  const ux = dx / d;
  const uz = dz / d;
  const p: P3 = [a.x + ux * (a.r - 0.6), a.y, a.z + uz * (a.r - 0.6)];
  const q: P3 = [b.x - ux * (b.r - 0.6), b.y, b.z - uz * (b.r - 0.6)];
  return [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2], q];
}
/** lantern i realises BRIDGES[i] (first: first->second, second: second->third, third: third->core) */
export const BRIDGES: P3[][] = [bridge(ISLANDS.first, ISLANDS.second), bridge(ISLANDS.second, ISLANDS.third), bridge(ISLANDS.third, ISLANDS.core)];
/** each lantern stands on its island, at the edge where its bridge leaves */
export const LANTERN_SPOTS = BRIDGES.map((b, i) => {
  const isl = [ISLANDS.first, ISLANDS.second, ISLANDS.third][i];
  const dx = b[0][0] - isl.x;
  const dz = b[0][2] - isl.z;
  const d = Math.hypot(dx, dz);
  // beside the bridge head, not on it
  return { x: isl.x + (dx / d) * (isl.r - 2.2) + (dz / d) * 2.2, y: isl.y, z: isl.z + (dz / d) * (isl.r - 2.2) - (dx / d) * 2.2 };
});

/** The Door of Works (to the Kingdom of Career): stands on the core island once the Mind is awake. */
export const WORKS_DOOR = { x: ISLANDS.core.x + 3.2, y: ISLANDS.core.y, z: ISLANDS.core.z + 3.6 };
/** coming back from the Works: in front of the door, facing the eye */
export const WORKS_DOOR_ARRIVAL = { x: WORKS_DOOR.x - 1.4, y: WORKS_DOOR.y + 0.2, z: WORKS_DOOR.z - 1.4, yaw: Math.atan2(ISLANDS.core.x - WORKS_DOOR.x, ISLANDS.core.z - WORKS_DOOR.z) };
