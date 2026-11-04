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

export interface CharacterHandle {
  step(i: AnimInput, exertion: number): AnimFrame;
  setExpression(e: Expression, seconds?: number): void;
  readonly controller: CharacterAnimationController;
}

/** Renders any avatar GLB carrying `lifeosProto` clip metadata (placeholder or the user's retargeted avatar). */
export const Character = forwardRef<CharacterHandle, { url: string; castShadow?: boolean }>(function Character({ url, castShadow = true }, ref) {
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
