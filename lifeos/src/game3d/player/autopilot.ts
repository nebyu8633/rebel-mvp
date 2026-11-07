/**
 * Bench autopilot (?bench=1): walks/runs a fixed route through the scene so FPS numbers from
 * different devices are comparable (same views, same animation load). It only feeds the same
 * input path a player would use.
 */
import { input } from "./input";
import { telemetry } from "./Player";

export interface Waypoint {
  x: number;
  z: number;
  run?: boolean;
  jump?: boolean;
  wait?: number;
}

/** Route: plaza loop -> stairs up/down -> ramp -> street and back. Coordinates match World.tsx. */
export const BENCH_ROUTE: Waypoint[] = [
  { x: 0, z: 8 },
  { x: 5.5, z: 4, run: true },
  { x: 5.5, z: -7, run: true },
  { x: 3.2, z: -11.2 },
  { x: 3.2, z: -15.65, wait: 1.5 },
  { x: -3.8, z: -15.65 },
  { x: -6.6, z: -15.65 },
  { x: -7.5, z: -14.6 },
  { x: -7.5, z: -10.6 },
  { x: -6, z: -1, jump: true },
  { x: -3.5, z: 22, run: true },
  { x: 3.5, z: 40, run: true },
  { x: 0, z: 26 },
  { x: 0, z: 12, wait: 1 },
];

export const autopilot = {
  active: false,
  i: 0,
  waitLeft: 0,
  elapsed: 0,
  done: false,
  onDone: null as null | (() => void),
};

export function startAutopilot(onDone?: () => void) {
  Object.assign(autopilot, { active: true, i: 0, waitLeft: 0, elapsed: 0, done: false, onDone: onDone ?? null });
}

export function autopilotStep(dt: number) {
  if (!autopilot.active) {
    input.auto = null;
    return;
  }
  autopilot.elapsed += dt;
  const wp = BENCH_ROUTE[autopilot.i];
  if (!wp || autopilot.elapsed > 180) {
    autopilot.active = false;
    autopilot.done = true;
    input.auto = null;
    autopilot.onDone?.();
    return;
  }
  const dx = wp.x - telemetry.x;
  const dz = wp.z - telemetry.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.6) {
    if (autopilot.waitLeft <= 0 && wp.wait) autopilot.waitLeft = wp.wait;
    if (autopilot.waitLeft > 0) {
      autopilot.waitLeft -= dt;
      input.auto = { x: 0, y: 0, run: false };
      if (autopilot.waitLeft > 0) return;
    }
    if (wp.jump) input.jump = true;
    autopilot.i++;
    return;
  }
  // world dir -> camera space (x right, y forward)
  const cy = telemetry.camYaw;
  const fx = -Math.sin(cy);
  const fz = -Math.cos(cy);
  const nx = dx / d;
  const nz = dz / d;
  const y = nx * fx + nz * fz;
  const x = nx * -fz + nz * fx;
  const slow = Math.min(1, d / 1.2);
  input.auto = { x: x * Math.max(0.5, slow), y: y * Math.max(0.5, slow), run: !!wp.run && d > 2 };
}
