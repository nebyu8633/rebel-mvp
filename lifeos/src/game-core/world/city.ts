/**
 * Phase-1 city: one main street, a central plaza and ONE upgradable building (the Hall of
 * Knowledge). Pure data + pure functions, shared by the 3D client and the tests.
 *
 * The building tier is DERIVED (read-only) from Life XP in the knowledge domain — nothing is
 * written. Persistent world state / snapshots arrive in phase 2 with an approved migration.
 */
import type { Domain } from "../contracts/events";

export interface Box {
  kind: "box";
  x: number;
  z: number;
  w: number;
  d: number;
}
export interface Circle {
  kind: "circle";
  x: number;
  z: number;
  r: number;
}
export type Collider = Box | Circle;

export const CITY_BOUNDS = { minX: -30, maxX: 30, minZ: -32, maxZ: 52 };
export const PLAZA = { x: 0, z: 0, r: 11 };
export const STREET = { x: 0, z0: 10, z1: 52, w: 8 };
export const SPAWN = { x: 0, z: 40, facing: Math.PI }; // looking toward the plaza (-z)
export const FOUNTAIN: Circle = { kind: "circle", x: 0, z: 0, r: 2.8 };

export interface BuildingTier {
  tier: number;
  title: string;
  needXp: number;
  /** Footprint for collisions. */
  w: number;
  d: number;
}
export const HALL = {
  id: "hall-of-knowledge",
  name: "אולם הידע",
  domain: "knowledge" as Domain,
  x: 0,
  z: -19,
  tiers: [
    { tier: 0, title: "אתר בנייה", needXp: 0, w: 8, d: 6 },
    { tier: 1, title: "ספרייה קטנה", needXp: 20, w: 8, d: 6 },
    { tier: 2, title: "אקדמיה", needXp: 100, w: 12, d: 8 },
    { tier: 3, title: "הספרייה הגדולה", needXp: 300, w: 14, d: 10 },
  ] as BuildingTier[],
};

export interface HallState {
  tier: number;
  xp: number;
  current: BuildingTier;
  next: BuildingTier | null;
  /** 0..1 toward the next tier. */
  fraction: number;
}

/** Building tier from knowledge Life XP (read-only derivation). */
export function hallState(knowledgeLifeXp: number): HallState {
  const xp = Math.max(0, knowledgeLifeXp);
  let current = HALL.tiers[0];
  for (const t of HALL.tiers) if (xp >= t.needXp) current = t;
  const next = HALL.tiers.find((t) => t.tier === current.tier + 1) ?? null;
  const fraction = next ? (xp - current.needXp) / (next.needXp - current.needXp) : 1;
  return { tier: current.tier, xp, current, next, fraction: Math.max(0, Math.min(1, fraction)) };
}

/** Deterministic pseudo-random (layout must be identical on every device). */
function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export interface House {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: number;
  roof: number;
}
export interface Prop {
  x: number;
  z: number;
  s: number;
}

export interface CityLayout {
  houses: House[];
  trees: Prop[];
  lamps: Prop[];
  benches: Prop[];
  colliders: Collider[];
}

const PALETTE = [0xe9dcc4, 0xd8c3a5, 0xc9b79c, 0xe6d2b5, 0xbfae97, 0xdccbb0];
const ROOFS = [0x9c4a3a, 0x7a3b2e, 0x5b6b7a, 0x6e5a48, 0x8a5a3c];

export function cityLayout(seed = 7): CityLayout {
  const r = rand(seed);
  const houses: House[] = [];
  for (const side of [-1, 1])
    for (let z = 14; z <= 46; z += 8) {
      const w = 6 + r() * 2;
      const d = 6 + r() * 1.5;
      houses.push({ x: side * (STREET.w / 2 + 3.2 + w / 2), z, w, d, h: 4 + r() * 5, color: Math.floor(r() * PALETTE.length), roof: Math.floor(r() * ROOFS.length) });
    }
  // around the plaza
  for (const [x, z] of [
    [-17, -4],
    [17, -4],
    [-16, 7],
    [16, 7],
  ])
    houses.push({ x, z, w: 7, d: 7, h: 5 + r() * 4, color: Math.floor(r() * PALETTE.length), roof: Math.floor(r() * ROOFS.length) });
  const lamps: Prop[] = [];
  for (let z = 14; z <= 48; z += 7) lamps.push({ x: -STREET.w / 2 - 0.6, z, s: 1 }, { x: STREET.w / 2 + 0.6, z: z + 3.5, s: 1 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    lamps.push({ x: Math.cos(a) * (PLAZA.r - 0.6), z: Math.sin(a) * (PLAZA.r - 0.6), s: 1 });
  }
  const trees: Prop[] = [];
  for (let i = 0; i < 70; i++) {
    const x = (r() * 2 - 1) * 28;
    const z = -30 + r() * 80;
    const inStreet = Math.abs(x) < STREET.w / 2 + 12 && z > 8;
    const inPlaza = Math.hypot(x, z) < PLAZA.r + 4;
    const inHall = Math.abs(x - HALL.x) < 10 && Math.abs(z - HALL.z) < 9;
    if (inStreet || inPlaza || inHall) continue;
    trees.push({ x, z, s: 0.8 + r() * 0.7 });
  }
  const benches: Prop[] = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    return { x: Math.cos(a) * 6, z: Math.sin(a) * 6, s: a };
  });
  const colliders: Collider[] = [
    FOUNTAIN,
    ...houses.map((h): Collider => ({ kind: "box", x: h.x, z: h.z, w: h.w, d: h.d })),
    ...trees.map((t): Collider => ({ kind: "circle", x: t.x, z: t.z, r: 0.45 * t.s })),
    ...lamps.map((l): Collider => ({ kind: "circle", x: l.x, z: l.z, r: 0.2 })),
  ];
  return { houses, trees, lamps, benches, colliders };
}

export const hallCollider = (tier: number): Collider => {
  const t = HALL.tiers[tier];
  return { kind: "box", x: HALL.x, z: HALL.z - (t.d - 6) / 2, w: t.w, d: t.d };
};

/** Push a circle (the avatar) out of colliders and keep it inside the city. Pure. */
export function resolve(pos: { x: number; z: number }, radius: number, colliders: Collider[]): { x: number; z: number } {
  let { x, z } = pos;
  for (let pass = 0; pass < 2; pass++)
    for (const c of colliders) {
      if (c.kind === "circle") {
        const dx = x - c.x;
        const dz = z - c.z;
        const d = Math.hypot(dx, dz);
        const min = c.r + radius;
        if (d < min && d > 1e-6) {
          x = c.x + (dx / d) * min;
          z = c.z + (dz / d) * min;
        }
      } else {
        const hx = c.w / 2 + radius;
        const hz = c.d / 2 + radius;
        const dx = x - c.x;
        const dz = z - c.z;
        if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
          if (hx - Math.abs(dx) < hz - Math.abs(dz)) x = c.x + Math.sign(dx || 1) * hx;
          else z = c.z + Math.sign(dz || 1) * hz;
        }
      }
    }
  x = Math.max(CITY_BOUNDS.minX + radius, Math.min(CITY_BOUNDS.maxX - radius, x));
  z = Math.max(CITY_BOUNDS.minZ + radius, Math.min(CITY_BOUNDS.maxZ - radius, z));
  return { x, z };
}
