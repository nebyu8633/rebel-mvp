/**
 * The Kingdom of Health — the Living Grove. Metres; bearings 0 = north (-Z), clockwise.
 * A forest basin ringed by cliffs and waterfalls; the Heart Tree at its centre.
 */
export const SPAWN = { x: 0, y: 0, z: 28, yaw: Math.PI };
export const BOUND_R = 34;
export const HEART = { x: 0, z: -4, r: 2.6, h: 26 };
export const WAYSTONE = { x: 2.8, z: 29 };

const at = (bearing: number, r: number) => {
  const a = (bearing * Math.PI) / 180;
  return { x: HEART.x + Math.sin(a) * r, z: HEART.z - Math.cos(a) * r };
};
export const SPRING_SPOTS = {
  west: { ...at(-105, 15), r: 2.2 },
  north: { ...at(15, 15), r: 2.2 },
  east: { ...at(120, 15), r: 2.2 },
};
/** Giant trees around the basin (never on the springs' channels or the path). */
export const GIANTS = [
  { b: -150, d: 24, h: 30, r: 1.8 },
  { b: -60, d: 26, h: 34, r: 2.2 },
  { b: 50, d: 25, h: 28, r: 1.7 },
  { b: 85, d: 29, h: 32, r: 2.0 },
  { b: 160, d: 23, h: 27, r: 1.6 },
  { b: -20, d: 29, h: 30, r: 1.9 },
].map((g) => ({ ...g, ...at(g.b, g.d) }));
