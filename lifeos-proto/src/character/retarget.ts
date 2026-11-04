/**
 * Retargeting support.
 *
 * All Rocketbox clips share the avatar's skeleton (Bip01 / 3ds Max Biped), so they need no
 * retargeting. Clips from other sources (e.g. Mixamo, for a real jump) use other bone names and
 * rest poses. Two levels are provided:
 *  1. `renameTracks` — pure, name-only mapping (same rest pose, e.g. a re-export of the same rig).
 *  2. `retargetToAvatar` (threeRetarget.ts) — rest-pose aware, via three's SkeletonUtils.retargetClip.
 */
export type BoneMap = Record<string, string>;

/** Mixamo -> Rocketbox (Biped) bone names. Only bones that exist on both rigs. */
export const MIXAMO_TO_ROCKETBOX: BoneMap = {
  Hips: "Bip01_Pelvis",
  Spine: "Bip01_Spine",
  Spine1: "Bip01_Spine1",
  Spine2: "Bip01_Spine2",
  Neck: "Bip01_Neck",
  Head: "Bip01_Head",
  LeftShoulder: "Bip01_L_Clavicle",
  LeftArm: "Bip01_L_UpperArm",
  LeftForeArm: "Bip01_L_Forearm",
  LeftHand: "Bip01_L_Hand",
  RightShoulder: "Bip01_R_Clavicle",
  RightArm: "Bip01_R_UpperArm",
  RightForeArm: "Bip01_R_Forearm",
  RightHand: "Bip01_R_Hand",
  LeftUpLeg: "Bip01_L_Thigh",
  LeftLeg: "Bip01_L_Calf",
  LeftFoot: "Bip01_L_Foot",
  LeftToeBase: "Bip01_L_Toe0",
  RightUpLeg: "Bip01_R_Thigh",
  RightLeg: "Bip01_R_Calf",
  RightFoot: "Bip01_R_Foot",
  RightToeBase: "Bip01_R_Toe0",
};

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
