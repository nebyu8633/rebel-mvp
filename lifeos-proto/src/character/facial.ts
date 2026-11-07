/**
 * Facial animation on morph targets (ARKit-style names baked by the asset build).
 * Pure: produces influence values; the adapter writes them to mesh.morphTargetInfluences.
 * Layers: procedural blinks + an expression preset (eased) + exertion (jaw/brows while running).
 */
export type Expression = "neutral" | "happy" | "focused" | "surprised";

export const EXPRESSIONS: Record<Expression, Record<string, number>> = {
  neutral: {},
  happy: { mouthSmileLeft: 0.75, mouthSmileRight: 0.75, browInnerUp: 0.15, eyeWideLeft: 0.05, eyeWideRight: 0.05 },
  focused: { browDownLeft: 0.45, browDownRight: 0.45, mouthPucker: 0.12 },
  surprised: { browInnerUp: 0.8, eyeWideLeft: 0.6, eyeWideRight: 0.6, jawOpen: 0.25, mouthFunnel: 0.2 },
};

/** Deterministic PRNG (so tests are reproducible). */
function lcg(seed: number) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export class FacialController {
  private rnd: () => number;
  private t = 0;
  private nextBlink: number;
  private blinkStart = -1;
  private expression: Expression = "neutral";
  private expressionUntil = Infinity;
  private values: Record<string, number> = {};
  static readonly BLINK = 0.16;

  constructor(seed = 7) {
    this.rnd = lcg(seed);
    this.nextBlink = 1 + this.rnd() * 2;
  }

  /** Show an expression; `seconds` = how long before easing back to neutral (Infinity = keep). */
  setExpression(e: Expression, seconds = Infinity) {
    this.expression = e;
    this.expressionUntil = this.t + seconds;
  }
  get currentExpression() {
    return this.expression;
  }

  /** exertion 0..1 (e.g. running speed fraction). */
  update(dt: number, exertion = 0): Record<string, number> {
    this.t += dt;
    if (this.t > this.expressionUntil) {
      this.expression = "neutral";
      this.expressionUntil = Infinity;
    }
    // blink: ~every 2-5 s, quick close/open, occasionally a double blink
    if (this.blinkStart < 0 && this.t >= this.nextBlink) this.blinkStart = this.t;
    let blink = 0;
    if (this.blinkStart >= 0) {
      const p = (this.t - this.blinkStart) / FacialController.BLINK;
      if (p >= 1) {
        this.blinkStart = -1;
        this.nextBlink = this.t + (this.rnd() < 0.15 ? 0.18 : 2 + this.rnd() * 3);
      } else blink = Math.sin(Math.PI * p);
    }
    const target: Record<string, number> = { ...EXPRESSIONS[this.expression] };
    target.eyeBlinkLeft = Math.max(target.eyeBlinkLeft ?? 0, blink);
    target.eyeBlinkRight = Math.max(target.eyeBlinkRight ?? 0, blink);
    if (exertion > 0) {
      target.jawOpen = Math.max(target.jawOpen ?? 0, 0.12 * exertion + 0.05 * exertion * Math.sin(this.t * 9));
      target.browDownLeft = Math.max(target.browDownLeft ?? 0, 0.2 * exertion);
      target.browDownRight = Math.max(target.browDownRight ?? 0, 0.2 * exertion);
    }
    const k = 1 - Math.exp(-dt * 8);
    const keys = new Set([...Object.keys(this.values), ...Object.keys(target)]);
    for (const key of keys) {
      const tgt = target[key] ?? 0;
      // blinks are not smoothed (they'd never fully close)
      const v = key.startsWith("eyeBlink") ? tgt : (this.values[key] ?? 0) + (tgt - (this.values[key] ?? 0)) * k;
      this.values[key] = v < 1e-3 ? 0 : Math.min(1, v);
    }
    return this.values;
  }
}
