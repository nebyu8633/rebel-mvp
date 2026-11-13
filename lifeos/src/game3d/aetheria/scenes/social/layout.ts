/**
 * The Kingdom of Social — the Village of the Hearth. Metres; bearings 0 = north (-Z), clockwise.
 * A plaza island with the Common Flame, three hamlet islands around it, bridges between.
 */
import type { P3 } from "../shared/LightPath";

export const PLAZA = { x: 0, y: 0, z: 0, r: 12 };
export const SPAWN = { x: 0, y: 0, z: 9.5, yaw: Math.PI };
export const WAYSTONE = { x: 3.2, z: 10 };
export const FALL_Y = -12;
/** the Common Flame and its two keepers' stones, on either side of it */
export const HEARTH = { x: 0, z: -1, r: 1.6 };
export const KEEPER_STONES = { player: { x: -4.2, z: -1 }, echo: { x: 4.2, z: -1 } };

const at = (bearing: number, r: number) => {
  const a = (bearing * Math.PI) / 180;
  return { x: Math.sin(a) * r, z: -Math.cos(a) * r };
};
export const HAMLET_SPOTS = {
  west: { ...at(-70, 27), y: 1.5, r: 7 },
  north: { ...at(5, 27), y: 2.5, r: 7 },
  east: { ...at(75, 27), y: 1, r: 7 },
};

export function edgePath(a: { x: number; y: number; z: number; r: number }, b: { x: number; y: number; z: number; r: number }): P3[] {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  const ux = dx / d;
  const uz = dz / d;
  const p: P3 = [a.x + ux * (a.r - 0.6), a.y, a.z + uz * (a.r - 0.6)];
  const q: P3 = [b.x - ux * (b.r - 0.6), b.y, b.z - uz * (b.r - 0.6)];
  return [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2], q];
}
export const VILLAGE_BRIDGES = { west: edgePath(PLAZA, HAMLET_SPOTS.west), north: edgePath(PLAZA, HAMLET_SPOTS.north), east: edgePath(PLAZA, HAMLET_SPOTS.east) };
/** a ring of places where the returned villagers gather around the fire */
export const GATHER = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return { x: HEARTH.x + Math.cos(a) * 5.6, z: HEARTH.z + Math.sin(a) * 5.6, face: Math.atan2(-Math.cos(a), -Math.sin(a)) };
});
/** the Gate of Gold (to the Vault of Value): on the plaza's south-west rim, open once the flame burns */
export const GOLD_GATE = { ...at(-135, 9.6), yaw: (3 * Math.PI) / 4 };
/** where a traveller back from the Vault appears: just inside the gate, facing the hearth */
export const GOLD_GATE_ARRIVAL = { ...at(-135, 7.4), y: 0.2, yaw: Math.PI - Math.PI / 4 };
