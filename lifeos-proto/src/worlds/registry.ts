/**
 * World registry. Each world plugs its scene + HUD into the shared engine host (canvas, physics,
 * player, camera, lighting). Layers: "reality" (the modern city — connection to real life),
 * "aetheria" (the fantasy universe), "dev" (test scenes).
 */
import type { ComponentType } from "react";
import type { LightPreset } from "../world/Lighting";
import type { Quality } from "../store";
import { useWorlds, type WorldId } from "../engine/worldStore";

export type WorldLayer = "reality" | "aetheria" | "dev";

export interface WorldDef {
  id: WorldId;
  title: string;
  layer: WorldLayer;
  light: LightPreset;
  spawn: { x: number; y: number; z: number; yaw: number };
  /** The Living Architect's fantasy loadout is worn only in AETHERIA worlds. */
  wearsLoadout: boolean;
  Scene: ComponentType<{ quality: Quality }>;
  Hud: ComponentType<{ touch: boolean }>;
}

const worlds = new Map<WorldId, WorldDef>();

export function registerWorld(def: WorldDef) {
  if (worlds.has(def.id)) throw new Error(`world "${def.id}" already registered`);
  worlds.set(def.id, def);
  useWorlds.getState().setKnown([...worlds.keys()]);
}
export const getWorld = (id: WorldId) => worlds.get(id) ?? null;
export const listWorlds = () => [...worlds.values()];
