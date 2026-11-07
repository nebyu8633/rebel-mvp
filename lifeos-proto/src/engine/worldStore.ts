/**
 * Which world is active, and transitions between worlds (reality layer <-> AETHERIA).
 * A transition fades out, swaps the world (scene + physics + player are remounted), fades in.
 * Styles are visual only; narrative code decides *when* to call transitionTo().
 */
import { create } from "zustand";

export type WorldId = string;
export type TransitionStyle = "fade" | "resonance";
export type TransitionPhase = "idle" | "out" | "in";

export interface TransitionOpts {
  style?: TransitionStyle;
  outMs?: number;
  inMs?: number;
}

interface WorldState {
  current: WorldId;
  phase: TransitionPhase;
  target: WorldId | null;
  style: TransitionStyle;
  durationMs: number;
  /** ids accepted by transitionTo (set by the registry) */
  known: Set<WorldId>;
  setKnown(ids: WorldId[]): void;
  /** Start a transition. Returns false (and does nothing) for unknown worlds, the current world, or while busy. */
  transitionTo(id: WorldId, opts?: TransitionOpts): boolean;
  /** Immediate switch without a transition (initial world, tests). */
  setCurrent(id: WorldId): void;
}

const DEFAULTS: Record<TransitionStyle, { out: number; in: number }> = {
  fade: { out: 450, in: 550 },
  resonance: { out: 1400, in: 1800 },
};

export const useWorlds = create<WorldState>((set, get) => ({
  current: "city",
  phase: "idle",
  target: null,
  style: "fade",
  durationMs: 0,
  known: new Set(),
  setKnown: (ids) => set({ known: new Set(ids) }),
  setCurrent: (id) => set({ current: id, phase: "idle", target: null }),
  transitionTo(id, opts = {}) {
    const s = get();
    if (!s.known.has(id) || id === s.current || s.phase !== "idle") return false;
    const style = opts.style ?? "fade";
    const outMs = opts.outMs ?? DEFAULTS[style].out;
    const inMs = opts.inMs ?? DEFAULTS[style].in;
    set({ phase: "out", target: id, style, durationMs: outMs });
    setTimeout(() => {
      set({ current: id, phase: "in", target: null, durationMs: inMs });
      setTimeout(() => set({ phase: "idle", durationMs: 0 }), inMs);
    }, outMs);
    return true;
  },
}));

/**
 * Hosts where each world is a separate page (the LifeOS app: /city, /aetheria) plug in a navigator.
 * Scenes call goToWorld()/worldAvailable() and stay agnostic of how worlds are hosted.
 */
export interface WorldNavigator {
  has(id: WorldId): boolean;
  go(id: WorldId, opts?: TransitionOpts): void;
}
let navigator: WorldNavigator | null = null;
export function setWorldNavigator(n: WorldNavigator | null) {
  navigator = n;
}
export const worldAvailable = (id: WorldId) => useWorlds.getState().known.has(id) || !!navigator?.has(id);
export function goToWorld(id: WorldId, opts?: TransitionOpts): boolean {
  if (useWorlds.getState().known.has(id)) return useWorlds.getState().transitionTo(id, opts);
  if (navigator?.has(id)) {
    navigator.go(id, opts);
    return true;
  }
  return false;
}
