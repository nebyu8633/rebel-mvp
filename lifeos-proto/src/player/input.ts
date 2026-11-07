/**
 * Input state (mutable, read every physics step — not React state).
 * Keyboard: WASD / arrows move, Shift run, Space jump, E interact, G wave, Q/E-less camera via mouse drag.
 * Touch: left virtual stick (UI), right half drag = camera, on-screen buttons.
 */
export const input = {
  /** move intent, camera space: x = right, y = forward, magnitude 0..1 */
  moveX: 0,
  moveY: 0,
  run: false,
  /** edges (consumed by the player each step) */
  jump: false,
  interact: false,
  gesture: false,
  /** camera orbit deltas in pixels, consumed by the camera */
  lookDX: 0,
  lookDY: 0,
  /** touch stick */
  stickX: 0,
  stickY: 0,
  stickActive: false,
  /** autopilot (bench) overrides */
  auto: null as null | { x: number; y: number; run: boolean },
};

const keys = new Set<string>();
let bound = false;

export function bindKeyboard() {
  if (bound) return () => {};
  bound = true;
  const down = (e: KeyboardEvent) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === "Space") input.jump = true;
    if (e.code === "KeyE" || e.code === "Enter") input.interact = true;
    if (e.code === "KeyG") input.gesture = true;
    if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
  };
  const up = (e: KeyboardEvent) => keys.delete(e.code);
  const blur = () => keys.clear();
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    bound = false;
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
  };
}

/** Resolve the current move intent (keyboard, stick or autopilot). */
export function readMove(): { x: number; y: number; mag: number; run: boolean } {
  if (input.auto) {
    const m = Math.min(1, Math.hypot(input.auto.x, input.auto.y));
    return { x: input.auto.x, y: input.auto.y, mag: m, run: input.auto.run };
  }
  let x = 0;
  let y = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) y += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) y -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
  let run = keys.has("ShiftLeft") || keys.has("ShiftRight") || input.run;
  if (input.stickActive) {
    x = input.stickX;
    y = input.stickY;
    // pushing the stick to the edge runs
    run = run || Math.hypot(x, y) > 0.92;
  }
  const m = Math.hypot(x, y);
  if (m > 1) {
    x /= m;
    y /= m;
  }
  // walk on keyboard by default; Shift to run
  const mag = Math.min(1, m);
  return { x, y, mag: mag < 0.08 ? 0 : mag, run };
}

export function consumeEdges() {
  const e = { jump: input.jump, interact: input.interact, gesture: input.gesture };
  input.jump = input.interact = input.gesture = false;
  return e;
}
