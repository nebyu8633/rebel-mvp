/**
 * AETHERIA soundscape: every sound is synthesized with Web Audio, so there are no audio files to
 * download and nothing to license.
 *   ambient   wind (breathing filtered noise), the observatory's drone (a low chord that swells
 *             indoors), distant celestial bells every few seconds
 *   events    the Resonance (a rising chord), each force when cast (FORM a crystalline chime,
 *             CHANGE a filter sweep, CONNECTION a plucked arpeggio), a fizzle when a cast is
 *             rejected, learning a force, the Echo speaking
 * Browsers (iOS above all) only allow audio after a user gesture: `unlock()` is called from the
 * first touch / key press. Muting is a per-device preference (localStorage, try/catch).
 */
import type { Force } from "../core/model";

const KEY = "aetheria:sound";
type Ctx = AudioContext;

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let reverb: ConvolverNode | null = null;
let windGain: GainNode | null = null;
let windFilter: BiquadFilterNode | null = null;
let droneGain: GainNode | null = null;
let bellTimer: ReturnType<typeof setTimeout> | null = null;
let muted = readMuted();
const listeners = new Set<(m: boolean) => void>();

function readMuted() {
  try {
    return localStorage.getItem(KEY) === "off";
  } catch {
    return false;
  }
}

export const sound = {
  get muted() {
    return muted;
  },
  setMuted(m: boolean) {
    muted = m;
    try {
      localStorage.setItem(KEY, m ? "off" : "on");
    } catch {
      /* private mode: preference just isn't remembered */
    }
    if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.2);
    listeners.forEach((l) => l(m));
  },
  onChange(l: (m: boolean) => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};

function noiseBuffer(c: Ctx, seconds: number) {
  const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    // brown-ish noise: softer than white, closer to wind
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return b;
}

function impulse(c: Ctx, seconds: number, decay: number) {
  const len = c.sampleRate * seconds;
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

/** Create the audio graph on the first user gesture. Safe to call many times. */
export function unlock() {
  if (typeof window === "undefined") return;
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const c = ctx;
  master = c.createGain();
  master.gain.value = muted ? 0 : 0.55;
  const comp = c.createDynamicsCompressor();
  master.connect(comp).connect(c.destination);
  reverb = c.createConvolver();
  reverb.buffer = impulse(c, 3.2, 2.6);
  const wet = c.createGain();
  wet.gain.value = 0.45;
  reverb.connect(wet).connect(master);

  // wind
  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c, 6);
  n.loop = true;
  windFilter = c.createBiquadFilter();
  windFilter.type = "bandpass";
  windFilter.frequency.value = 500;
  windFilter.Q.value = 0.7;
  windGain = c.createGain();
  windGain.gain.value = 0.25;
  n.connect(windFilter).connect(windGain).connect(master);
  n.start();

  // the observatory's drone: a low open chord, slowly beating
  droneGain = c.createGain();
  droneGain.gain.value = 0;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 600;
  droneGain.connect(lp).connect(master);
  lp.connect(reverb);
  for (const [f, g] of [[55, 0.5], [82.4, 0.35], [110.3, 0.3], [164.8, 0.12]] as const) {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const og = c.createGain();
    og.gain.value = g;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.05 + Math.random() * 0.08;
    const lg = c.createGain();
    lg.gain.value = 0.6;
    lfo.connect(lg).connect(o.detune);
    o.connect(og).connect(droneGain);
    o.start();
    lfo.start();
  }
  scheduleBell();
}

function scheduleBell() {
  if (!ctx) return;
  bellTimer = setTimeout(() => {
    // pentatonic, high and far away
    const notes = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093];
    tone(notes[Math.floor(Math.random() * notes.length)], { dur: 4, gain: 0.035, type: "sine", wetOnly: true });
    scheduleBell();
  }, 5000 + Math.random() * 9000);
}

/** Per-frame ambience: how much the player is inside the observatory (0..1), wind gusts. */
export function setAmbience(indoor: number, t: number) {
  if (!ctx || !windGain || !windFilter || !droneGain) return;
  const now = ctx.currentTime;
  const gust = 0.5 + 0.5 * Math.sin(t * 0.21) * Math.sin(t * 0.13 + 1.3);
  windGain.gain.setTargetAtTime((0.12 + 0.18 * gust) * (1 - 0.6 * indoor), now, 0.6);
  windFilter.frequency.setTargetAtTime(320 + 520 * gust, now, 0.8);
  droneGain.gain.setTargetAtTime(0.025 + 0.11 * indoor, now, 0.8);
}

/** Dev/test introspection. */
export function soundDebug() {
  return { state: ctx?.state ?? "none", muted, master: master?.gain.value ?? null, wind: windGain?.gain.value ?? null, drone: droneGain?.gain.value ?? null };
}

/** Leaving AETHERIA (e.g. back to the city): fade the ambience out; event sounds still work. */
export function silenceAmbience() {
  if (!ctx || !windGain || !droneGain) return;
  windGain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
  droneGain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
}

function tone(freq: number, o: { dur: number; gain: number; type?: OscillatorType; at?: number; attack?: number; wetOnly?: boolean; glideTo?: number }) {
  if (!ctx || !master || !reverb) return;
  const c = ctx;
  const t0 = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, t0 + o.dur * 0.8);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g);
  g.connect(reverb);
  if (!o.wetOnly) g.connect(master);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

function sweep(from: number, to: number, dur: number, gain: number, at = 0) {
  if (!ctx || !master || !reverb) return;
  const c = ctx;
  const t0 = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, dur + 0.2);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 6;
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g);
  g.connect(master);
  g.connect(reverb);
  src.start(t0);
}

export const sfx = {
  /** the First Resonance: a slow rising chord over ~6 s */
  resonance() {
    [110, 164.8, 220, 277.2, 329.6, 440, 659.3].forEach((f, i) => tone(f, { dur: 7 - i * 0.3, gain: 0.07, attack: 1.5 + i * 0.4, at: i * 0.35, type: i < 3 ? "triangle" : "sine" }));
    sweep(200, 2400, 6, 0.08);
  },
  cast(force: Force, ok: boolean) {
    if (!ok) {
      sweep(900, 140, 0.6, 0.12);
      tone(196, { dur: 0.5, gain: 0.05, type: "triangle", glideTo: 98 });
      return;
    }
    if (force === "form") [1318.5, 1760, 2093, 2637].forEach((f, i) => tone(f, { dur: 1.6, gain: 0.06, at: i * 0.07 }));
    if (force === "change") {
      sweep(180, 3200, 1.4, 0.16);
      tone(220, { dur: 1.6, gain: 0.06, type: "triangle", glideTo: 440 });
    }
    if (force === "connection") [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => tone(f, { dur: 1.2, gain: 0.07, at: i * 0.11, type: "triangle" }));
  },
  learn() {
    [392, 523.3, 659.3, 784].forEach((f, i) => tone(f, { dur: 2.2, gain: 0.06, at: i * 0.18, attack: 0.05 }));
  },
  echo() {
    tone(880, { dur: 2.5, gain: 0.035, wetOnly: true, attack: 0.3 });
    tone(1318.5, { dur: 2.8, gain: 0.025, wetOnly: true, attack: 0.5, at: 0.2 });
  },
  dispose() {
    if (bellTimer) clearTimeout(bellTimer);
  },
};
