/**
 * Which heroes have a produced 3D model (GLB in /public/models/heroes) and how to use it.
 * Heroes without an entry keep the procedural model — nothing breaks while assets are produced
 * one by one. Files come from scripts/assets/prepare-hero.mjs (merged clips, meshopt-compressed).
 */
export interface HeroAsset {
  url: string;
  /** Target height in metres (models are auto-scaled to it and placed on the ground). */
  height: number;
  /** Extra Y rotation if the source model doesn't face +Z. */
  yaw?: number;
  /** Clip names inside the GLB for each game state. */
  clips: { idle: string; run: string; attack: string; cast?: string; hit?: string; death?: string };
}

export const HERO_ASSETS: Record<string, HeroAsset> = {
  // produced heroes are added here, e.g.:
  // aegis: { url: "/models/heroes/aegis.glb", height: 1.9, clips: { idle: "idle", run: "run", attack: "attack" } },
};

/** Pipeline test character (no paid assets). `?heroasset=test` renders every hero with it. */
export const TEST_ASSET: HeroAsset = { url: "/models/heroes/test-hero.glb", height: 1.8, clips: { idle: "idle", run: "run", attack: "attack" } };

export function assetFor(heroId: string): HeroAsset | null {
  const q = typeof window !== "undefined" ? new URLSearchParams(location.search).get("heroasset") : null;
  if (q === "test") return TEST_ASSET;
  if (q === "missing") return { ...TEST_ASSET, url: "/models/heroes/does-not-exist.glb" }; // fallback check
  return HERO_ASSETS[heroId] ?? null;
}
