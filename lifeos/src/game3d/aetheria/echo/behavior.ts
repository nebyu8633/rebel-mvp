/**
 * The Future Echo's behaviour — pure decision logic (rendering lives in FutureEcho.tsx).
 *
 * Identity arc: Silent Observer (watches, withdraws when approached) -> Fragmented Mind (stays,
 * speaks in broken sentences, answers gestures) -> Future Companion (stays close; later phases).
 * The Shifting Presence: its look is chosen per stage (see APPEARANCE).
 */
import type { EchoStage } from "../core/model";

export type EchoMode = "hidden" | "observe" | "withdraw" | "wait" | "converse";
export type EchoReaction = "none" | "wave" | "look_up" | "tilt";
export type PlayerEvent = "wave" | "jump" | "resonance";

export interface EchoInput {
  stage: EchoStage;
  /** horizontal distance to the player (m) and whether they're on the same level */
  dist: number;
  sameLevel: boolean;
  /** the story asks the Echo to wait for the player instead of withdrawing */
  waiting: boolean;
  inDialogue: boolean;
  event: PlayerEvent | null;
}
export interface EchoDecision {
  mode: EchoMode;
  reaction: EchoReaction;
  /** 0..1 how strongly it turns its head to the player */
  attention: number;
}

export const APPROACH_R = 3.2;
export const NOTICE_R = 14;

export function decide(i: EchoInput): EchoDecision {
  if (i.stage === "dormant") return { mode: "hidden", reaction: "none", attention: 0 };
  const near = i.sameLevel && i.dist < APPROACH_R;
  const noticed = i.dist < NOTICE_R;
  let reaction: EchoReaction = "none";
  if (i.event === "resonance") reaction = "look_up";
  else if (i.event === "wave" && noticed) reaction = i.stage === "silent_observer" ? "tilt" : "wave";
  else if (i.event === "jump" && noticed && i.stage !== "silent_observer") reaction = "tilt";

  if (i.inDialogue) return { mode: "converse", reaction: "none", attention: 1 };
  if (i.stage === "silent_observer") {
    if (i.waiting) return { mode: "wait", reaction, attention: noticed ? 1 : 0.4 };
    return { mode: near ? "withdraw" : "observe", reaction, attention: noticed ? 0.8 : 0.3 };
  }
  // fragmented mind and beyond no longer flee; they wait and watch
  return { mode: "wait", reaction, attention: noticed ? 1 : 0.5 };
}

/** The Shifting Presence — per-stage appearance parameters (shader + particles + veils). */
export interface Appearance {
  color: string;
  accent: string;
  opacity: number;
  fresnel: number;
  /** 0..1 vertex glitch strength (fragmented) */
  glitch: number;
  /** 0..1 flicker of the whole figure */
  flicker: number;
  motes: number;
  moteSpeed: number;
  /** veils / ribbons of light trailing from the body (visual bible: "resonance threads") */
  veils: { count: number; length: number; width: number; broken: number; colors: [string, string] };
  /** glass shards orbiting the figure (the Fragmented Mind) */
  shards: number;
}
export const APPEARANCE: Record<Exclude<EchoStage, "dormant">, Appearance> = {
  // a faint wisp: few thin veils, pale and cool
  silent_observer: { color: "#9fe3ff", accent: "#dff6ff", opacity: 0.5, fresnel: 2.0, glitch: 0, flicker: 0.1, motes: 120, moteSpeed: 0.2, veils: { count: 4, length: 1.3, width: 0.13, broken: 0, colors: ["#9fe3ff", "#e6f8ff"] }, shards: 0 },
  // shattered: broken, flickering veils, violet and gold, glass shards circling it
  fragmented_mind: { color: "#c4a7ff", accent: "#ffd27a", opacity: 0.6, fresnel: 2.3, glitch: 0.7, flicker: 0.35, motes: 200, moteSpeed: 0.45, veils: { count: 6, length: 1.5, width: 0.16, broken: 0.5, colors: ["#b48cff", "#ffd27a"] }, shards: 18 },
  // whole: long golden veils with teal threads, calm
  future_companion: { color: "#ffe2a0", accent: "#fff6dd", opacity: 0.7, fresnel: 1.7, glitch: 0, flicker: 0.05, motes: 160, moteSpeed: 0.25, veils: { count: 8, length: 2.2, width: 0.22, broken: 0, colors: ["#ffd98a", "#7ff5e1"] }, shards: 0 },
};
