/**
 * Rig-agnostic attachment of rigid items to a character's skeleton.
 *
 * Bones are found by canonical name (Rocketbox Biped or Mixamo/Avaturn naming). Placement is
 * authored in CHARACTER space (metres; +Y up, +Z forward, +X = character's left) relative to the
 * bone's position in a reference pose (the shared idle clip, identical across rigs after
 * retargeting). The local transform is derived once at attach time, so the item then follows the
 * bone through every animation, whatever the rig's bone axes or unit scale are.
 */
import * as THREE from "three";
import type { CanonicalBone } from "./loadout";

const NAMES: Record<CanonicalBone, string[]> = {
  head: ["Bip01_Head", "Head"],
  neck: ["Bip01_Neck", "Neck"],
  chest: ["Bip01_Spine2", "Spine2"],
  hips: ["Bip01_Pelvis", "Hips"],
  leftHand: ["Bip01_L_Hand", "LeftHand"],
  rightHand: ["Bip01_R_Hand", "RightHand"],
  leftUpperArm: ["Bip01_L_UpperArm", "LeftArm"],
  rightUpperArm: ["Bip01_R_UpperArm", "RightArm"],
};
const norm = (n: string) => n.replace(/^mixamorig[:_]?/i, "");

export function findBone(root: THREE.Object3D, c: CanonicalBone): THREE.Object3D | null {
  const want = new Set(NAMES[c]);
  let hit: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!hit && (o as THREE.Bone).isBone && want.has(norm(o.name))) hit = o;
  });
  return hit;
}

export interface Placement {
  /** offset from the bone position, character space, metres */
  offset: [number, number, number];
  /** orientation in character space (Euler XYZ, radians) */
  rotation?: [number, number, number];
}

/**
 * Local matrix that puts an item at `placement` (character space) given the CURRENT pose.
 * Call while the reference pose is applied and matrices are up to date.
 */
export function attachmentMatrix(bone: THREE.Object3D, characterRoot: THREE.Object3D, p: Placement): THREE.Matrix4 {
  const rootInv = characterRoot.matrixWorld.clone().invert();
  const boneInChar = new THREE.Matrix4().multiplyMatrices(rootInv, bone.matrixWorld);
  const bonePos = new THREE.Vector3().setFromMatrixPosition(boneInChar);
  const itemInChar = new THREE.Matrix4().compose(
    bonePos.add(new THREE.Vector3(...p.offset)),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rotation ?? [0, 0, 0]))),
    new THREE.Vector3(1, 1, 1),
  );
  // local = bone⁻¹ · root · item   (all in world terms)
  return new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(characterRoot.matrixWorld).multiply(itemInChar);
}

/** Attach `object` to `bone` with a precomputed local matrix. Returns a detach function. */
export function attach(bone: THREE.Object3D, object: THREE.Object3D, local: THREE.Matrix4): () => void {
  object.matrixAutoUpdate = false;
  object.matrix.copy(local);
  bone.add(object);
  return () => {
    bone.remove(object);
  };
}
