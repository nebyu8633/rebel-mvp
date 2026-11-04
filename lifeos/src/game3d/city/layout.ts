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
  /** domain progress (0..1) at which the district gate opens in this slice */
  unlockAt: number;
}

export const DISTRICTS: DistrictDef[] = [
  { id: "knowledge", name: "רובע הידע", subtitle: "ספריות, אקדמיה, מעבדות", bearing: -38, color: 0x3f8cff, accent: "#3f8cff", unlockAt: 0.2 },
  { id: "career", name: "רובע הקריירה", subtitle: "מגדלי משרדים, סטודיו", bearing: 38, color: 0x8b5cf6, accent: "#8b5cf6", unlockAt: 0.2 },
  { id: "wealth", name: "רובע העושר", subtitle: "בורסה, בנקים, השקעות", bearing: 95, color: 0xf5b301, accent: "#f5b301", unlockAt: 0.5 },
  { id: "health", name: "רובע הבריאות", subtitle: "פארק, מסלולים, ספא", bearing: 145, color: 0x22c55e, accent: "#22c55e", unlockAt: 0.2 },
  { id: "social", name: "רובע החברה", subtitle: "בתי קפה, אמפיתיאטרון", bearing: -145, color: 0xff5ea8, accent: "#ff5ea8", unlockAt: 0.2 },
  { id: "mind", name: "רובע הנפש", subtitle: "גני זן, מקדש שקט", bearing: -95, color: 0x14b8a6, accent: "#14b8a6", unlockAt: 0.4 },
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

export const isUnlocked = (d: DistrictDef, progress: Record<Domain, number>) => progress[d.id] >= d.unlockAt;
