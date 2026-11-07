/** Resonance casts (presentation only): the scene's FX layer draws them; the engine never reads them. */
import type { Force } from "../core/model";

export interface Cast {
  force: Force;
  ok: boolean;
  at: { x: number; y: number; z: number };
  /** where the energy comes from (the player's hands) */
  from: { x: number; y: number; z: number };
}
type H = (c: Cast) => void;
const hs = new Set<H>();
export const casts = {
  emit(c: Cast) {
    for (const h of hs) h(c);
  },
  on(h: H): () => void {
    hs.add(h);
    return () => void hs.delete(h);
  },
};

/** Each force reads differently: gold assembling (FORM), violet spiral (CHANGE), teal stream (CONNECTION). */
export const FORCE_FX: Record<Force, { color: string; glow: string }> = {
  form: { color: "#ffd27a", glow: "rgba(255,210,122,.75)" },
  change: { color: "#c4a7ff", glow: "rgba(196,167,255,.75)" },
  connection: { color: "#7ff5e1", glow: "rgba(127,245,225,.75)" },
};
