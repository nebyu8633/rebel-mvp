"use client";
/**
 * Hero from a rigged GLB (when one exists), with the procedural model as fallback while loading
 * and if the file fails. Same imperative rig interface as HeroModel, so the arena Actor animates
 * both the same way (scale for switch/knock-out, emissive flash on hit).
 */
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Component, forwardRef, Suspense, useEffect, useImperativeHandle, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { HeroDef } from "@/lib/arena/types";
import { assetFor, type HeroAsset } from "@/lib/arena/heroAssets";
import { HeroModel, type HeroRig } from "./HeroModel";

export interface Motion {
  speed: number;
  casting: boolean;
}

class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.warn("hero model failed to load, using procedural model", e);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const GlbHero = forwardRef<HeroRig, { asset: HeroAsset; teamColor: string; motion: React.MutableRefObject<Motion> }>(function GlbHero({ asset, teamColor, motion }, ref) {
  const gltf = useGLTF(asset.url, false, true);
  const wrap = useRef<THREE.Group>(null);
  // own copy per hero instance (skeleton + materials), normalized to the target height
  const { scene, mats, scale, lift } = useMemo(() => {
    const s = cloneSkinned(gltf.scene) as THREE.Group;
    const ms: THREE.MeshStandardMaterial[] = [];
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false; // skinned bounds don't follow the animation
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
      const own = mat.clone();
      m.material = own;
      ms.push(own);
    });
    const box = new THREE.Box3().setFromObject(s);
    const h = Math.max(0.01, box.max.y - box.min.y);
    const k = asset.height / h;
    return { scene: s, mats: ms, scale: k, lift: -box.min.y * k };
  }, [gltf.scene, asset.height]);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const actions = useMemo(() => {
    const get = (name?: string) => {
      const clip = name ? gltf.animations.find((a) => a.name === name) : undefined;
      return clip ? mixer.clipAction(clip) : null;
    };
    return { idle: get(asset.clips.idle), run: get(asset.clips.run), attack: get(asset.clips.attack) };
  }, [gltf.animations, mixer, asset.clips]);
  const current = useRef<THREE.AnimationAction | null>(null);
  const attackT = useRef(0);
  useEffect(() => {
    actions.idle?.play();
    current.current = actions.idle;
    if (actions.attack) {
      actions.attack.setLoop(THREE.LoopOnce, 1);
      actions.attack.clampWhenFinished = false;
    }
    return () => {
      mixer.stopAllAction();
    };
  }, [actions, mixer]);
  useImperativeHandle(ref, () => ({ root: wrap.current, legL: null, legR: null, armL: null, armR: null, body: null, mats, glb: true }), [mats]);

  useFrame((_, dt) => {
    const m = motion.current;
    attackT.current = Math.max(0, attackT.current - dt);
    let want = m.speed > 0.6 ? actions.run : actions.idle;
    if (m.casting && actions.attack && attackT.current <= 0) {
      attackT.current = actions.attack.getClip().duration * 0.8;
      actions.attack.reset().setEffectiveWeight(1).fadeIn(0.08).play();
    }
    if (attackT.current > 0 && actions.attack) want = actions.attack;
    if (want && want !== current.current) {
      if (want !== actions.attack) want.reset().play();
      current.current?.fadeOut(0.15);
      want.fadeIn(0.15);
      current.current = want;
    }
    if (actions.run) actions.run.timeScale = Math.max(0.6, Math.min(1.6, m.speed / 5));
    mixer.update(dt);
  });

  return (
    <group ref={wrap}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.62, 0.78, 32]} />
        <meshBasicMaterial color={teamColor} transparent opacity={0.85} />
      </mesh>
      <primitive object={scene} scale={scale} position={[0, lift, 0]} rotation-y={asset.yaw ?? 0} />
    </group>
  );
});

/** Uses the produced GLB when there is one; otherwise (or on failure) the procedural hero. */
export const HeroAvatar = forwardRef<HeroRig, { def: HeroDef; teamColor: string; motion: React.MutableRefObject<Motion> }>(function HeroAvatar({ def, teamColor, motion }, ref) {
  const asset = assetFor(def.id);
  const procedural = <HeroModel ref={ref} def={def} teamColor={teamColor} />;
  if (!asset) return procedural;
  return (
    <Fallback fallback={procedural}>
      <Suspense fallback={procedural}>
        <GlbHero ref={ref} asset={asset} teamColor={teamColor} motion={motion} />
      </Suspense>
    </Fallback>
  );
});
