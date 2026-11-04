/**
 * Retargeting support.
 *
 * All Rocketbox clips share the avatar's skeleton (Bip01 / 3ds Max Biped), so they need no
 * retargeting. Clips from other sources (e.g. Mixamo, for a real jump) use other bone names and
 * rest poses. Two levels are provided:
 *  1. `renameTracks` — pure, name-only mapping (same rest pose, e.g. a re-export of the same rig).
 *  2. `retargetToAvatar` (threeRetarget.ts) — rest-pose aware, via three's SkeletonUtils.retargetClip.
 */
import boneMap from "./boneMap.mixamo-rocketbox.json";

export type BoneMap = Record<string, string>;

/** Mixamo-style (also Avaturn) -> Rocketbox (Biped) bone names, incl. fingers. Shared with scripts/build-avatar.mjs. */
export const MIXAMO_TO_ROCKETBOX: BoneMap = boneMap;

/** Strip the common "mixamorig:" / "mixamorig" prefixes. */
export const normalizeBoneName = (n: string) => n.replace(/^mixamorig[:_]?/i, "");

export interface TrackLike {
  name: string;
}

/**
 * Rename tracks "<bone>.<property>" through a bone map. Unmapped bones are dropped and reported,
 * so a wrong map fails loudly instead of silently playing nothing.
 */
export function renameTracks<T extends TrackLike>(tracks: T[], map: BoneMap): { tracks: T[]; dropped: string[] } {
  const out: T[] = [];
  const dropped = new Set<string>();
  for (const t of tracks) {
    const dot = t.name.lastIndexOf(".");
    const bone = normalizeBoneName(t.name.slice(0, dot));
    const prop = t.name.slice(dot + 1);
    const target = map[bone];
    if (!target) {
      dropped.add(bone);
      continue;
    }
    out.push(Object.assign(Object.create(Object.getPrototypeOf(t)), t, { name: `${target}.${prop}` }));
  }
  return { tracks: out, dropped: [...dropped] };
}

/** Bones of the target the map covers (coverage check before accepting an external clip). */
export function mapCoverage(map: BoneMap, targetBones: Iterable<string>) {
  const have = new Set(targetBones);
  const mapped = Object.values(map).filter((b) => have.has(b));
  return { mapped: mapped.length, missing: Object.values(map).filter((b) => !have.has(b)) };
}
