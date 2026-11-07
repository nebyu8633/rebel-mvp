"use client";
/** Small synthesized sounds (WebAudio) — no audio files to download. Browsers only play after a user gesture. */
export type SoundId = "chime" | "bell" | "pulse" | "fanfare" | "none";

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.18) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ac.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  o.connect(g).connect(ac.destination);
  o.start(ac.currentTime + start);
  o.stop(ac.currentTime + start + dur + 0.05);
}

/** Returns false when sound could not be played (no WebAudio, or blocked). */
export function playSound(id: SoundId): boolean {
  if (id === "none") return true;
  const ac = audio();
  if (!ac) return false;
  try {
    if (id === "chime") [880, 1318.5].forEach((f, i) => tone(ac, f, i * 0.16, 0.6));
    else if (id === "bell") [659.3, 659.3, 987.8].forEach((f, i) => tone(ac, f, i * 0.28, 0.9, "triangle", 0.2));
    else if (id === "pulse") [0, 0.22, 0.44].forEach((t) => tone(ac, 740, t, 0.15, "square", 0.08));
    else if (id === "fanfare") [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(ac, f, i * 0.12, i === 3 ? 0.8 : 0.25, "triangle", 0.16));
    return ac.state === "running";
  } catch {
    return false;
  }
}

export const SOUND_LABEL: Record<Exclude<SoundId, "fanfare">, string> = { chime: "פעמון עדין", bell: "צלצול", pulse: "פולסים", none: "ללא צליל" };
