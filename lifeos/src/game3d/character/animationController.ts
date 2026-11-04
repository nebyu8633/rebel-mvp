/**
 * CharacterAnimationController — pure, engine-agnostic animation state machine.
 *
 * It owns the *pose description* (which clips, at what time and weight) and the root motion the
 * movement system should apply. It never moves the character itself: movement/physics feed it the
 * measured speed + grounded state, and consume `root` when `lockMovement` is set. A thin adapter
 * (threeAnimator.ts) applies the frame to a THREE.AnimationMixer.
 *
 * - Crossfades: per-clip weights move linearly toward per-state targets over a fade time, then are
 *   normalised (sum = 1) so the skeleton never falls back to the bind pose.
 * - Locomotion: idle / walk / run blended by *measured* speed. Walk and run share one normalised
 *   phase, and the cycle rate is speed / blended stride length, so feet stay planted (no foot
 *   sliding) across the whole walk-run range. Below ~0.4 m/s the blend is mostly idle.
 * - Root motion: one-shot clips (stops, turns) carry extracted root curves; the controller outputs
 *   per-frame deltas in the character's local frame.
 */
import { sampleRoot, type CharacterMeta, type ClipInfo } from "./clipMeta";

export type AnimState = "idle" | "locomotion" | "stop" | "turn" | "air" | "interact" | "gesture";

export interface AnimInput {
  dt: number;
  /** Measured horizontal speed (m/s) from movement/physics. */
  speed: number;
  /** Player intent 0..1 (stick magnitude / keys). */
  inputMag: number;
  grounded: boolean;
  /** Vertical velocity (m/s). */
  vy: number;
  /** Signed angle (rad) from current facing to the desired move direction; 0 without input. +left. */
  turnAngle: number;
  interact?: boolean;
  gesture?: boolean;
}

export interface ClipPose {
  weight: number;
  time: number;
}

export interface AnimFrame {
  state: AnimState;
  clips: Record<string, ClipPose>;
  /** Root motion to apply this frame, character-local (dx: +left, dz: +forward, dyaw: +left). */
  root: { dx: number; dz: number; dyaw: number } | null;
  /** When true the movement system must not apply input velocity (root motion / action in progress). */
  lockMovement: boolean;
  events: string[];
}

export interface ControllerConfig {
  /** Use the stop clips' root motion when the player releases input while moving. */
  rootMotionStops: boolean;
  /** Minimum angle (rad) between facing and requested direction that triggers a turn-in-place from idle. */
  turnThreshold: number;
  turnRate: number;
  interactRate: number;
  /** Clip time (s) at which the interaction "contact" event fires (hand reaches the handle). */
  interactContact: number;
  fade: number;
}

export const DEFAULT_CONFIG: ControllerConfig = {
  rootMotionStops: true,
  turnThreshold: (75 * Math.PI) / 180,
  turnRate: 1.7,
  interactRate: 1.25,
  interactContact: 1.9,
  fade: 0.22,
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const MOVE_EPS = 0.12;

export class CharacterAnimationController {
  readonly cfg: ControllerConfig;
  private meta: Record<string, ClipInfo>;
  private state: AnimState = "idle";
  private stateTime = 0;
  private weights = new Map<string, number>();
  private times = new Map<string, number>();
  private rates = new Map<string, number>();
  private phase = 0;
  private fade: number;
  private airTime = 0;
  /** active one-shot */
  private shot: { clip: string; t: number; rate: number; yawScale: number; useRoot: boolean } | null = null;
  private lastSpeed = 0;
  readonly walk: { speed: number; dur: number; stride: number };
  readonly run: { speed: number; dur: number; stride: number };

  constructor(meta: CharacterMeta, cfg: Partial<ControllerConfig> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
    this.meta = meta.clips;
    for (const need of ["idle", "walk", "run"]) if (!this.meta[need]) throw new Error(`missing clip ${need}`);
    const w = this.meta.walk;
    const r = this.meta.run;
    this.walk = { speed: w.speed ?? 1, dur: w.duration, stride: (w.speed ?? 1) * w.duration };
    this.run = { speed: r.speed ?? 3, dur: r.duration, stride: (r.speed ?? 3) * r.duration };
    this.weights.set("idle", 1);
    this.times.set("idle", 0);
    this.fade = this.cfg.fade;
  }

  get current(): AnimState {
    return this.state;
  }
  has(clip: string) {
    return !!this.meta[clip];
  }

  private enter(s: AnimState, fade: number, events: string[]) {
    if (s === this.state) return;
    this.state = s;
    this.stateTime = 0;
    this.fade = fade;
    events.push(`state:${s}`);
  }

  private startShot(clip: string, rate: number, opts: { yawScale?: number; useRoot?: boolean } = {}) {
    this.shot = { clip, t: 0, rate, yawScale: opts.yawScale ?? 1, useRoot: opts.useRoot ?? true };
    this.times.set(clip, 0);
    this.rates.set(clip, rate);
  }

  /** Locomotion blend for a measured speed: target weights + cycle rate (cycles/s). */
  locomotionBlend(s: number): { idle: number; walk: number; run: number; rate: number } {
    const { walk, run } = this;
    let a = 0;
    if (s > walk.speed) a = clamp((s - walk.speed) / (run.speed - walk.speed), 0, 1);
    const moving = clamp(s / 0.4, 0, 1);
    const stride = walk.stride + (run.stride - walk.stride) * a;
    const rate = Math.max(s / stride, 0.45 / walk.dur);
    return { idle: 1 - moving, walk: moving * (1 - a), run: moving * a, rate };
  }

  update(i: AnimInput): AnimFrame {
    const dt = clamp(i.dt, 0, 0.1);
    const events: string[] = [];
    let root: AnimFrame["root"] = null;
    this.stateTime += dt;
    this.airTime = i.grounded ? 0 : this.airTime + dt;
    const airborne = !i.grounded && (this.airTime > 0.12 || i.vy > 1.2);
    const moving = i.speed > MOVE_EPS || i.inputMag > 0.1;

    // ---------------------------------------------------------------- transitions
    if (airborne && this.state !== "air") {
      this.shot = null;
      this.enter("air", i.vy > 1.2 ? 0.1 : 0.18, events);
      if (i.vy > 1.2) events.push("jump");
    }
    switch (this.state) {
      case "air":
        if (i.grounded) {
          events.push("land");
          this.enter(moving ? "locomotion" : "idle", 0.16, events);
        }
        break;
      case "idle":
        if (i.interact && this.has("interact")) {
          this.enter("interact", 0.25, events);
          this.startShot("interact", this.cfg.interactRate, { useRoot: false });
        } else if (i.gesture && this.has("wave")) {
          this.enter("gesture", 0.25, events);
          this.startShot("wave", 1, { useRoot: false });
        } else if (i.inputMag > 0.2 && Math.abs(i.turnAngle) > this.cfg.turnThreshold && this.has("turn_left_90")) {
          const clip = i.turnAngle > 0 ? "turn_left_90" : "turn_right_90";
          const total = Math.abs(this.meta[clip].rootTotal?.yaw ?? Math.PI / 2) || Math.PI / 2;
          this.enter("turn", 0.15, events);
          this.startShot(clip, this.cfg.turnRate, { yawScale: clamp(Math.abs(i.turnAngle) / total, 0.5, 2) });
        } else if (moving) this.enter("locomotion", 0.2, events);
        break;
      case "locomotion":
        if (i.interact && this.has("interact") && i.speed < 0.8) {
          this.enter("interact", 0.25, events);
          this.startShot("interact", this.cfg.interactRate, { useRoot: false });
        } else if (i.inputMag <= 0.05) {
          const fast = this.lastSpeed > (this.walk.speed + this.run.speed) / 2;
          const clip = fast ? "run_stop" : "walk_stop";
          if (this.cfg.rootMotionStops && this.lastSpeed > 0.8 && this.has(clip)) {
            const ref = fast ? this.run.speed : this.walk.speed;
            this.enter("stop", 0.18, events);
            this.startShot(clip, clamp(this.lastSpeed / ref, 0.8, 1.4));
          } else if (i.speed < MOVE_EPS) this.enter("idle", 0.25, events);
        }
        break;
      case "stop":
        if (i.inputMag > 0.1) {
          this.shot = null;
          this.enter("locomotion", 0.2, events);
        }
        break;
      case "interact":
      case "gesture":
        if (this.shot && i.inputMag > 0.3 && (this.state === "gesture" || this.shot.t > this.cfg.interactContact)) {
          this.shot = null;
          this.enter("locomotion", 0.2, events);
        }
        break;
      case "turn":
        break;
    }

    // ---------------------------------------------------------------- advance one-shot + root motion
    if (this.shot && (this.state === "stop" || this.state === "turn" || this.state === "interact" || this.state === "gesture")) {
      const s = this.shot;
      const info = this.meta[s.clip];
      const t0 = s.t;
      const t1 = Math.min(info.duration, t0 + dt * s.rate);
      s.t = t1;
      this.times.set(s.clip, t1);
      if (s.clip === "interact" && t0 < this.cfg.interactContact && t1 >= this.cfg.interactContact) events.push("contact");
      if (s.useRoot && info.root) {
        const a = sampleRoot(info.root, t0);
        const b = sampleRoot(info.root, t1);
        // delta in the clip start frame -> rotate into the character's current local frame (yaw at t0)
        const ddx = b[0] - a[0];
        const ddz = b[1] - a[1];
        const yaw0 = a[2] * s.yawScale;
        const c = Math.cos(-yaw0);
        const sn = Math.sin(-yaw0);
        root = { dx: ddx * c + ddz * sn, dz: -ddx * sn + ddz * c, dyaw: (b[2] - a[2]) * s.yawScale };
      }
      const exitAt = info.duration - (this.state === "turn" ? 0.35 * s.rate : 0.3);
      if (t1 >= exitAt) {
        if (this.state === "turn" && info.root) {
          // hand over the remaining rotation so the total turn is exact
          const rest = (sampleRoot(info.root, info.duration)[2] - sampleRoot(info.root, t1)[2]) * s.yawScale;
          root = root ? { ...root, dyaw: root.dyaw + rest } : { dx: 0, dz: 0, dyaw: rest };
        }
        this.shot = null;
        this.enter(i.inputMag > 0.1 ? "locomotion" : "idle", 0.25, events);
      }
    }

    // ---------------------------------------------------------------- targets
    const target = new Map<string, number>();
    const loco = this.locomotionBlend(i.speed);
    switch (this.state) {
      case "idle":
        target.set("idle", 1);
        break;
      case "locomotion":
        target.set("idle", loco.idle);
        target.set("walk", loco.walk);
        target.set("run", loco.run);
        break;
      case "air":
        target.set(this.has("jump_air") ? "jump_air" : "idle", 1);
        break;
      default:
        if (this.shot) target.set(this.shot.clip, 1);
        else target.set("idle", 1);
    }

    // ---------------------------------------------------------------- clocks
    // shared walk/run phase (feet planted); only advances while locomotion clips matter
    const locoActive = (this.weights.get("walk") ?? 0) + (this.weights.get("run") ?? 0) > 0 || this.state === "locomotion";
    if (locoActive) this.phase = (this.phase + loco.rate * dt) % 1;
    this.times.set("walk", this.phase * this.walk.dur);
    this.times.set("run", this.phase * this.run.dur);
    this.times.set("idle", ((this.times.get("idle") ?? 0) + dt) % this.meta.idle.duration);
    if (this.meta.jump_air) this.times.set("jump_air", 0);
    // one-shots that are fading out keep playing at their last rate
    for (const [clip, w] of this.weights) {
      if (w <= 0 || clip === this.shot?.clip) continue;
      const info = this.meta[clip];
      if (info?.kind === "oneshot") this.times.set(clip, Math.min(info.duration, (this.times.get(clip) ?? 0) + dt * (this.rates.get(clip) ?? 1)));
    }

    // ---------------------------------------------------------------- crossfade weights
    const step = this.fade > 0 ? dt / this.fade : 1;
    const keys = new Set([...this.weights.keys(), ...target.keys()]);
    let sum = 0;
    for (const k of keys) {
      const cur = this.weights.get(k) ?? 0;
      const tgt = target.get(k) ?? 0;
      // inside locomotion the walk/run/idle mix follows speed directly (already smooth); only fade across states
      const fast = this.state === "locomotion" && (k === "walk" || k === "run" || k === "idle") && this.stateTime > this.fade;
      const next = fast ? tgt : cur < tgt ? Math.min(tgt, cur + step) : Math.max(tgt, cur - step);
      if (next <= 1e-4) this.weights.delete(k);
      else {
        this.weights.set(k, next);
        sum += next;
      }
    }
    if (sum <= 0) {
      this.weights.set("idle", 1);
      sum = 1;
    }
    const clips: Record<string, ClipPose> = {};
    for (const [k, w] of this.weights) clips[k] = { weight: w / sum, time: this.times.get(k) ?? 0 };

    this.lastSpeed = i.speed;
    const lockMovement = this.state === "turn" || this.state === "interact" || (this.state === "stop" && !!this.shot);
    return { state: this.state, clips, root, lockMovement, events };
  }
}
