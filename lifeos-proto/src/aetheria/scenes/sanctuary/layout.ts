/**
 * The First Sanctuary — layout in metres. Pure data (used by the scene, triggers and tests).
 * Bearings: 0 = north (-Z), clockwise toward +X.
 */
export const SPAWN = { x: 0, y: 0, z: 34, yaw: Math.PI };
export const BOUND_R = 40;

/** Observatory centre (floor top at y = FLOOR_Y). */
export const OBS = { x: 0, z: -6, floorR: 7.2, wallR: 7.65, wallT: 0.8, wallH: 7.5, doorBearing: 180, doorHalfDeg: 12 };
export const FLOOR_Y = 0.3;

/** Gallery: an arc walkway along the inner wall (north + east), reached by the west stair. */
export const GALLERY = { y: 4.2, rIn: 5.6, rOut: 7.25, from: -75, to: 110, thick: 0.25 };

/** West stair: 13 steps of 0.3 m rise from the floor to the gallery. Steps 4..9 lie broken until the Resonance. */
export const STAIR = { x: -5.9, z0: 3.0, z1: -1.65, width: 1.25, steps: 13, rise: 0.3, broken: [4, 5, 6, 7, 8, 9] };
export const stepRun = () => (STAIR.z0 - STAIR.z1) / STAIR.steps;
/** Top-surface height of step i and its centre z (observatory-relative). */
export const stepAt = (i: number) => ({ topY: FLOOR_Y + STAIR.rise * (i + 1), z: STAIR.z0 - stepRun() * (i + 0.5) });

export const FRAGMENT = { y: 2.3 };
export const PEDESTAL = { r: 0.9, h: 1.0 };
/** Astrolabe consoles (one per primordial force) around the pedestal. */
export const CONSOLES = [
  { force: "form" as const, bearing: 0, r: 3.9 },
  { force: "change" as const, bearing: 120, r: 3.9 },
  { force: "connection" as const, bearing: -120, r: 3.9 },
];
export const SIGIL_WALL = { bearing: 0, r: 6.9 };
export const WAYSTONE = { x: 3.5, z: 30 };

export const dir = (bearingDeg: number) => {
  const a = (bearingDeg * Math.PI) / 180;
  return { x: Math.sin(a), z: -Math.cos(a) };
};
/** World position of a point at (bearing, radius) around the observatory centre. */
export const around = (bearing: number, r: number) => {
  const d = dir(bearing);
  return { x: OBS.x + d.x * r, z: OBS.z + d.z * r };
};
export const insideObservatory = (x: number, z: number) => Math.hypot(x - OBS.x, z - OBS.z) < OBS.floorR - 0.3;
export const onGallery = (x: number, y: number, z: number) => y > GALLERY.y - 0.5 && Math.hypot(x - OBS.x, z - OBS.z) > GALLERY.rIn - 0.4;

/**
 * The Sleeping Gate (Phase 3): a dais at the west edge of the plateau, too high to climb (jump apex
 * ≈ 0.73 m). FORM raises steps on its east side; CHANGE lifts the fallen south pillar; CONNECTION
 * links the two pillar crystals and wakes the gate (an arch facing west, toward the floating isles).
 */
export const GATE = {
  x: -25,
  z: -8,
  half: 3.2,
  h: 1.5,
  pillarX: -26.4,
  pillarZ: 2.3, // ± from the centre
  pillarH: 4.2,
  steps: 5,
  stepRun: 0.55,
};
export const gateStep = (i: number) => ({ topY: (GATE.h / GATE.steps) * (i + 1), x: GATE.x + GATE.half + GATE.stepRun * (GATE.steps - i - 0.5) });
/** Clear ground around the gate (no boulders / trees). */
export const nearGate = (x: number, z: number) => Math.hypot(x - GATE.x, z - GATE.z) < 10;
/** Direction (atan2(z, x)) the gate looks out over the rim: the crags part there to show the isles. */
export const GATE_VIEW = Math.atan2(GATE.z, GATE.x - 30);
export const angDist = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** The floating isle at the end of the Sleeping Gate's light bridge (its walkable top is at `top`). */
export const ISLE = { x: -88, z: -8, top: 25.2, r: 7.5 };
/** The light bridge's path (from the dais's west edge up to the isle). */
export const BRIDGE_PATH: [number, number, number][] = [
  // straight in plan (on a phone you walk it by holding forward), climbing ~28°, then levelling out
  // so it meets the isle's top at its edge with no step, and runs on a little over the isle
  [GATE.x - GATE.half, GATE.h + 0.05, GATE.z],
  [-44, 6, GATE.z],
  [-62, 15.5, GATE.z],
  [-77, 23.6, GATE.z],
  [ISLE.x + ISLE.r - 0.4, ISLE.top, ISLE.z],
  [ISLE.x + ISLE.r - 3, ISLE.top, ISLE.z],
];
/** Hidden memory shards (World Depth). The third appears only when the star lens is whole. */
export const MEMORY_SPOTS = {
  memory_colonnade: { x: 4.6, y: 0, z: 14.2 },
  memory_south_rim: { x: 0, y: 0, z: 37.5 },
  memory_star_chart: { ...around(160, 5.2), y: FLOOR_Y },
};
/** The cracked star lens on the gallery (east), focusing starlight onto the floor's star chart. */
export const STAR_LENS = { ...around(60, 6.45), y: GALLERY.y };
