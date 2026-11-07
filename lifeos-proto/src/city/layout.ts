/**
 * LifeOS city — one connected city. Pure layout data shared by the 3D scene, minimap and tests.
 * North (-Z) is the LifeOS tower; six avenues lead from the central plaza to the six districts
 * (the existing LifeOS regions). Spawn is on the south side of the plaza, facing the tower.
 */
import type { Domain } from "../data/lifeos";

export const PLAZA = { r: 24 };
export const FOUNTAIN = { r: 4.2 };
export const AVENUE = { w: 10, gateR: 31, endR: 50 };
export const TOWER = { x: 0, z: -52, w: 22, d: 18, h: 150 };
export const SPAWN = { x: 0, z: 16, yaw: Math.PI };

export interface DistrictDef {
  id: Domain;
  name: string;
  subtitle: string;
  /** bearing from north (-Z), clockwise toward +X, degrees */
  bearing: number;
  color: number;
  accent: string;
}

export const DISTRICTS: DistrictDef[] = [
  { id: "knowledge", name: "רובע הידע", subtitle: "ספריות, אקדמיה, מעבדות", bearing: -38, color: 0x3f8cff, accent: "#3f8cff" },
  { id: "career", name: "רובע הקריירה", subtitle: "מגדלי משרדים, סטודיו", bearing: 38, color: 0x8b5cf6, accent: "#8b5cf6" },
  { id: "wealth", name: "רובע העושר", subtitle: "בורסה, בנקים, השקעות", bearing: 95, color: 0xf5b301, accent: "#f5b301" },
  { id: "health", name: "רובע הבריאות", subtitle: "פארק, מסלולים, ספא", bearing: 145, color: 0x22c55e, accent: "#22c55e" },
  { id: "social", name: "רובע החברה", subtitle: "בתי קפה, אמפיתיאטרון", bearing: -145, color: 0xff5ea8, accent: "#ff5ea8" },
  { id: "mind", name: "רובע הנפש", subtitle: "גני זן, מקדש שקט", bearing: -95, color: 0x14b8a6, accent: "#14b8a6" },
];

/** Unit vector of a bearing (north = -Z, clockwise toward +X). */
export const dirOf = (bearingDeg: number) => {
  const a = (bearingDeg * Math.PI) / 180;
  return { x: Math.sin(a), z: -Math.cos(a) };
};
/** Gate position; `yaw` makes local +Z point outward along the avenue. */
export const gatePos = (d: DistrictDef, r = AVENUE.gateR) => {
  const v = dirOf(d.bearing);
  return { x: v.x * r, z: v.z * r, yaw: Math.atan2(v.x, v.z) };
};

export type Location = { kind: "plaza" } | { kind: "tower" } | { kind: "avenue"; district: DistrictDef } | { kind: "edge" };

/** Where is the player? (current-location card + minimap). */
export function locate(x: number, z: number): Location {
  if (Math.abs(x - TOWER.x) < TOWER.w / 2 + 6 && z < TOWER.z + TOWER.d / 2 + 10 && z > TOWER.z - TOWER.d / 2 - 4) return { kind: "tower" };
  if (Math.hypot(x, z) <= PLAZA.r + 1) return { kind: "plaza" };
  let best: DistrictDef | null = null;
  let bestOff = Infinity;
  for (const d of DISTRICTS) {
    const v = dirOf(d.bearing);
    const along = x * v.x + z * v.z;
    const off = Math.abs(x * v.z - z * v.x);
    if (along > 0 && off < AVENUE.w / 2 + 3 && off < bestOff) {
      best = d;
      bestOff = off;
    }
  }
  return best ? { kind: "avenue", district: best } : { kind: "edge" };
}

/**
 * District development stage from real-life progress. Purely visual and informational: every
 * district is always open (no access is ever gated by real-life activity).
 */
export const STAGES = [
  { level: 0, label: "יסודות", from: 0 },
  { level: 1, label: "בבנייה", from: 0.25 },
  { level: 2, label: "מתפתח", from: 0.5 },
  { level: 3, label: "פורח", from: 0.8 },
] as const;
export type Stage = (typeof STAGES)[number];
export function developmentStage(progress: number): Stage {
  let s: Stage = STAGES[0];
  for (const st of STAGES) if (progress >= st.from) s = st;
  return s;
}
