import { create } from "zustand";
import type { WorldReaction } from "./progression/lifeEvents";
import type { AnimState } from "./character/animationController";
import type { Expression } from "./character/facial";
import type { LifeOSSnapshot } from "./data/lifeos";

export type Quality = "high" | "medium" | "low";

export interface Interactable {
  id: string;
  label: string;
  /** world position of the interaction point */
  x: number;
  y: number;
  z: number;
  radius: number;
  onContact: () => void;
}

/** Interactables live outside React state (read every physics step). */
export const interactables = new Map<string, Interactable>();

interface ProtoState {
  ready: boolean;
  quality: Quality;
  prompt: string | null;
  animState: AnimState;
  expression: Expression;
  reactions: WorldReaction[];
  litWindows: number;
  doorOpen: boolean;
  debug: { rootMotionStops: boolean; showColliders: boolean };
  avatar: { label: string; placeholder: boolean } | null;
  /** read-only LifeOS view (mock in the prototype) */
  snapshot: LifeOSSnapshot | null;
  towerDoorOpen: boolean;
  /** open HUD panel: overview | inventory | achievements | map | district:<id> */
  panel: string | null;
  set: (p: Partial<ProtoState>) => void;
  pushReaction: (r: WorldReaction) => void;
}

export const useProto = create<ProtoState>((set) => ({
  ready: false,
  quality: "high",
  prompt: null,
  animState: "idle",
  expression: "neutral",
  reactions: [],
  litWindows: 0,
  doorOpen: false,
  debug: { rootMotionStops: true, showColliders: false },
  avatar: null,
  snapshot: null,
  towerDoorOpen: false,
  panel: null,
  set: (p) => set(p),
  pushReaction: (r) =>
    set((s) => ({
      reactions: [r, ...s.reactions].slice(0, 6),
      litWindows: Math.max(0, s.litWindows + (r.kind === "revert" ? -1 : 1)),
    })),
}));

export const params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
