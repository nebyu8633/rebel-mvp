/**
 * Realistic character: Rocketbox Male_Adult_01 (MIT) GLB with skinned mesh, 81-bone Biped rig,
 * 18 facial morph targets and Rocketbox mocap clips. Animation is driven by
 * CharacterAnimationController through ThreeAnimator (see those files).
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { CharacterAnimationController, type AnimFrame, type AnimInput } from "./animationController";
import { FacialController, type Expression } from "./facial";
import { ThreeAnimator } from "./threeAnimator";
import type { CharacterMeta } from "./clipMeta";
import { gltfExtensions } from "../lib/loaders";
import { useProto } from "../store";
import { itemById, type Loadout } from "../avatar/loadout";
import { RECIPES, disposeObject } from "../avatar/recipes";
import { attach, attachmentMatrix, findBone } from "../avatar/attach";

export interface CharacterHandle {
  step(i: AnimInput, exertion: number): AnimFrame;
  setExpression(e: Expression, seconds?: number): void;
  readonly controller: CharacterAnimationController;
}

/** Renders any avatar GLB carrying `lifeosProto` clip metadata (placeholder or the user's retargeted avatar). */
export const Character = forwardRef<CharacterHandle, { url: string; castShadow?: boolean; loadout?: Loadout | null; accent?: string }>(function Character({ url, castShadow = true, loadout = null, accent = "#4fc3ff" }, ref) {
  const gl = useThree((s) => s.gl);
  const gltf = useGLTF(url, false, true, gltfExtensions(gl));
  const rootMotionStops = useProto((s) => s.debug.rootMotionStops);

  const rig = useMemo(() => {
    const scene = gltf.scene;
    let meta: CharacterMeta | undefined;
    scene.traverse((o) => {
      if (o.userData?.lifeosProto) meta = o.userData.lifeosProto as CharacterMeta;
      const m = o as THREE.SkinnedMesh;
      if (m.isMesh) {
        m.castShadow = castShadow;
        m.receiveShadow = true;
        // skinned bounds don't follow the animation; the character is always near the camera anyway
        m.frustumCulled = false;
        for (const mat of [m.material].flat() as THREE.MeshStandardMaterial[]) {
          mat.envMapIntensity = 0.9;
          if (mat.alphaTest > 0) mat.alphaToCoverage = true;
        }
      }
    });
    if (!meta) throw new Error(`${url} has no lifeosProto clip metadata — run the asset/avatar build`);
    const animator = new ThreeAnimator(scene, gltf.animations);
    const controller = new CharacterAnimationController(meta);
    const facial = new FacialController();
    return { scene, animator, controller, facial };
  }, [gltf, castShadow]);

  useEffect(() => {
    rig.controller.cfg.rootMotionStops = rootMotionStops;
  }, [rig, rootMotionStops]);
  useEffect(() => {
    rig.animator.start();
    return () => rig.animator.stop();
  }, [rig]);

  // Living Architect equipment: rigid items attached to canonical bones, placed in the shared idle pose
  useEffect(() => {
    if (!loadout) return;
    const ids = Object.values(loadout.equipped).filter((x): x is string => !!x);
    if (!ids.length) return;
    rig.animator.applyReferencePose("idle", 0);
    rig.scene.updateMatrixWorld(true);
    const detachers: (() => void)[] = [];
    for (const id of ids) {
      const item = itemById(id);
      if (!item || item.visual.kind !== "procedural" || item.minTier > loadout.tier) continue;
      const recipe = RECIPES[item.visual.recipe];
      if (!recipe) continue;
      const sides = item.visual.mirror ? [item.visual.bone, item.visual.mirror] : [item.visual.bone];
      sides.forEach((boneName, i) => {
        const bone = findBone(rig.scene, boneName);
        if (!bone) return;
        const built = recipe({ accent, tier: loadout.tier, mirrored: i === 1 });
        built.object.name = `item:${id}`;
        const off = attach(bone, built.object, attachmentMatrix(bone, rig.scene, built.placement));
        detachers.push(() => {
          off();
          disposeObject(built.object);
        });
      });
    }
    return () => detachers.forEach((d) => d());
  }, [rig, loadout, accent]);

  useImperativeHandle(
    ref,
    () => ({
      controller: rig.controller,
      step(i, exertion) {
        const frame = rig.controller.update(i);
        rig.animator.apply(frame);
        rig.animator.applyMorphs(rig.facial.update(i.dt, exertion));
        return frame;
      },
      setExpression(e, seconds) {
        rig.facial.setExpression(e, seconds);
        useProto.getState().set({ expression: e });
      },
    }),
    [rig],
  );

  return <primitive object={rig.scene} />;
});
