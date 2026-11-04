/** Clip metadata written by scripts/build-assets.mjs into the GLB (scene extras: lifeosProto). */
export type ClipKind = "loop" | "oneshot" | "pose";
/** Root-motion sample: [t, dx, dz, yaw] in the clip's start frame (character faces +Z, metres, radians). */
export type RootKey = [number, number, number, number];

export interface ClipInfo {
  kind: ClipKind;
  duration: number;
  /** Loops: ground speed of the cycle (m/s) measured from the original root motion. */
  speed?: number;
  /** One-shots: extracted root motion. */
  root?: RootKey[];
  rootTotal?: { dx: number; dz: number; yaw: number };
  /** Turn clips: root yaw was removed from the pose and lives in `root` (applied to the character). */
  yawExtracted?: boolean;
  placeholder?: boolean;
}

export interface CharacterMeta {
  units: "m";
  clips: Record<string, ClipInfo>;
}

/** Linear sample of a root curve at time t (clamped). */
export function sampleRoot(root: RootKey[], t: number): [number, number, number] {
  if (root.length === 0) return [0, 0, 0];
  if (t <= root[0][0]) return [root[0][1], root[0][2], root[0][3]];
  const last = root[root.length - 1];
  if (t >= last[0]) return [last[1], last[2], last[3]];
  let lo = 0;
  let hi = root.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (root[mid][0] <= t) lo = mid;
    else hi = mid;
  }
  const a = root[lo];
  const b = root[hi];
  const f = (t - a[0]) / (b[0] - a[0] || 1);
  return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
}
