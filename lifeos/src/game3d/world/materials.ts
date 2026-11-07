/**
 * PBR materials from CC0 KTX2 texture sets (public/assets/env/<set>/{color,normal,roughness,ao,...}.ktx2).
 * Geometry carries world-scale UVs (see geometry.ts), so one shared material per surface type.
 */
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { suspend } from "suspend-react";
import { asset, getKTX2 } from "../lib/loaders";

export type SetName = "plaza" | "street" | "sidewalk" | "plaster" | "brick" | "granite" | "wood" | "bark" | "grass" | "leaf" | "metal" | "ruinwall" | "ruinfloor" | "rock" | "meadow" | "mosspath";
const MAPS: Record<SetName, string[]> = {
  plaza: ["color", "normal", "roughness", "ao"],
  street: ["color", "normal", "roughness", "ao"],
  sidewalk: ["color", "normal", "roughness", "ao"],
  plaster: ["color", "normal", "roughness", "ao"],
  brick: ["color", "normal", "roughness", "ao"],
  granite: ["color", "normal", "roughness", "ao"],
  wood: ["color", "normal", "roughness", "ao"],
  bark: ["color", "normal", "roughness", "ao"],
  grass: ["color", "normal", "roughness", "ao"],
  leaf: ["color", "normal", "roughness", "opacity"],
  metal: ["color", "normal", "roughness", "metalness"],
  ruinwall: ["color", "normal", "roughness", "ao"],
  ruinfloor: ["color", "normal", "roughness", "ao"],
  rock: ["color", "normal", "roughness", "ao"],
  meadow: ["color", "normal", "roughness", "ao"],
  mosspath: ["color", "normal", "roughness", "ao"],
};

export interface MatOpts {
  tint?: number;
  roughness?: number;
  metalness?: number;
  normalScale?: number;
  aoIntensity?: number;
  /** use only the surface maps (normal/roughness), not the albedo — e.g. neutral metal from a painted set */
  noColor?: boolean;
}

async function loadSet(gl: THREE.WebGLRenderer, set: SetName, anisotropy: number) {
  const loader = getKTX2(gl);
  const entries = await Promise.all(
    MAPS[set].map(async (m) => {
      const t = (await loader.loadAsync(asset(`env/${set}/${m}.ktx2`))) as THREE.Texture;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = anisotropy;
      t.colorSpace = m === "color" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.needsUpdate = true;
      return [m, t] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<string, THREE.Texture>;
}

export function useTextureSet(set: SetName) {
  const gl = useThree((s) => s.gl);
  const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
  return suspend(() => loadSet(gl, set, aniso), ["pbr", set]);
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function usePBR(set: SetName, o: MatOpts = {}) {
  const maps = useTextureSet(set);
  const key = `${set}|${JSON.stringify(o)}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      name: set,
      map: o.noColor ? null : maps.color,
      normalMap: maps.normal,
      roughnessMap: maps.roughness,
      aoMap: maps.ao ?? null,
      aoMapIntensity: o.aoIntensity ?? 1,
      roughness: o.roughness ?? 1,
      metalnessMap: o.noColor ? null : (maps.metalness ?? null),
      metalness: o.metalness ?? (maps.metalness ? 1 : 0),
      color: o.tint ?? 0xffffff,
      normalScale: new THREE.Vector2(o.normalScale ?? 1, o.normalScale ?? 1),
    });
    if (maps.opacity) {
      m.alphaMap = maps.opacity;
      m.alphaTest = 0.5;
      m.side = THREE.DoubleSide;
    }
    matCache.set(key, m);
  }
  return m;
}
