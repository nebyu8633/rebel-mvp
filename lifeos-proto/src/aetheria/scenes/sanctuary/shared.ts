/** Shared helpers and the Resonance clock for the First Sanctuary modules. */
import * as THREE from "three";

export const RESONANCE_S = 10;
export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const glowMat = (color: string | number, i = 2) => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: color, emissiveIntensity: i, roughness: 0.5 });

/** Shared resonance clock (0..1), read by every animated part. */
export const resonance = { p: 0, running: false, t: 0 };
