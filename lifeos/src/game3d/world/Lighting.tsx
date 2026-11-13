/**
 * Lighting: physical sky + CC0 HDRI (Poly Haven "esplanade" via @pmndrs/assets) for image-based
 * lighting, one shadow-casting sun. The shadow frustum follows the player and snaps to shadow-map
 * texels (no shimmering) — controlled, small shadow area instead of one huge low-res map.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Sky } from "@react-three/drei";
import { CelestialSky } from "./CelestialSky";
import { HDRI } from "../config";
import { telemetry } from "../player/Player";
import type { Quality } from "../store";

export type LightPreset = "day" | "dusk" | "dawn" | "celestial" | "astral" | "verdant" | "dream" | "ember" | "hearth";
const PRESETS = {
  day: { sun: new THREE.Vector3(0.7, 0.6, 0.38).normalize(), color: 0xfff0d8, intensity: 3.8, env: HDRI.day, envI: 0.1, hemi: [0xcfe3ff, 0x5a5040, 0.12] as const, fog: [0xc9d6e2, 45, 140] as const, sky: { turbidity: 6, rayleigh: 1.2 } },
  // late golden hour from the west, cool sky fill — the look of the reference image
  dusk: { sun: new THREE.Vector3(-0.48, 0.7, 0.53).normalize(), color: 0xffc08a, intensity: 4.6, env: HDRI.dusk, envI: 0.5, hemi: [0xa9bcff, 0x4a3a32, 0.45] as const, fog: [0xa7aac4, 110, 480] as const, sky: { turbidity: 7, rayleigh: 2.2 } },
  // AETHERIA dawn: low cool-gold sun over a misty mountain plateau
  dawn: { sun: new THREE.Vector3(0.55, 0.42, -0.72).normalize(), color: 0xffd2a0, intensity: 3.6, env: HDRI.dawn, envI: 0.42, hemi: [0xbcc8ff, 0x3b4230, 0.4] as const, fog: [0xc4c7d8, 35, 190] as const, sky: { turbidity: 4, rayleigh: 2.8 } },
  // AETHERIA visual bible: a low gold sun in the west (behind the Sleeping Gate), violet sky fill,
  // lilac haze, and the fractured celestial sky instead of a daylight sky
  celestial: { sun: new THREE.Vector3(-0.84, 0.26, -0.2).normalize(), color: 0xffa868, intensity: 2.7, env: HDRI.dusk, envI: 0.26, hemi: [0x8a7fc8, 0x3a2c28, 0.5] as const, fog: [0x7e6a8c, 38, 240] as const, sky: { turbidity: 7, rayleigh: 2.2 }, celestial: "dusk" as const },
  // the Village of the Hearth: last warm light from the west, a cool blue evening fill
  hearth: { sun: new THREE.Vector3(-0.8, 0.2, 0.3).normalize(), color: 0xffb27a, intensity: 2.3, env: HDRI.dusk, envI: 0.3, hemi: [0x7f8fd0, 0x2a2420, 0.6] as const, fog: [0x3a3a5c, 34, 230] as const, sky: { turbidity: 5, rayleigh: 2 }, celestial: "hearth" as const },
  // the Great Works: a low furnace-orange sun, warm smoky fill
  ember: { sun: new THREE.Vector3(0.7, 0.22, 0.4).normalize(), color: 0xffa060, intensity: 2.8, env: HDRI.dusk, envI: 0.3, hemi: [0x8a6a5a, 0x2a1810, 0.55] as const, fog: [0x3a2218, 30, 220] as const, sky: { turbidity: 8, rayleigh: 1.5 }, celestial: "ember" as const },
  // the Hall of Reflections: a soft pink sidelight, lavender fill, violet haze
  dream: { sun: new THREE.Vector3(-0.35, 0.45, 0.65).normalize(), color: 0xffd0e8, intensity: 2.2, env: HDRI.dusk, envI: 0.35, hemi: [0xb8a0ff, 0x2a1c34, 0.7] as const, fog: [0x4a3a66, 34, 230] as const, sky: { turbidity: 3, rayleigh: 2 }, celestial: "dream" as const },
  // the Living Grove: a high morning sun through the canopy, green fill, forest haze
  verdant: { sun: new THREE.Vector3(0.45, 0.62, 0.35).normalize(), color: 0xffdcaa, intensity: 2.1, env: HDRI.dawn, envI: 0.32, hemi: [0x86c49a, 0x1f2a18, 0.62] as const, fog: [0x47604a, 22, 150] as const, sky: { turbidity: 3, rayleigh: 1.5 }, celestial: "verdant" as const },
  // the Kingdom of Knowledge: high pale moonlight, deep blue fill and haze, the astral sky
  astral: { sun: new THREE.Vector3(0.35, 0.62, -0.55).normalize(), color: 0xbfd0ff, intensity: 1.9, env: HDRI.dusk, envI: 0.22, hemi: [0x5a6cc8, 0x14122a, 0.6] as const, fog: [0x0c1434, 34, 240] as const, sky: { turbidity: 2, rayleigh: 1 }, celestial: "astral" as const },
};

export function Lighting({ quality, preset = "day" }: { quality: Quality; preset?: LightPreset }) {
  const P = PRESETS[preset];
  const SUN_DIR = P.sun;
  const sun = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  const size = quality === "high" ? 2048 : 1024;
  const extent = quality === "low" ? 16 : 24;
  const target = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    scene.add(target);
    return () => void scene.remove(target);
  }, [scene, target]);
  useEffect(() => {
    const l = sun.current!;
    l.target = target;
    l.shadow.mapSize.set(size, size);
    const c = l.shadow.camera;
    c.left = c.bottom = -extent;
    c.right = c.top = extent;
    c.near = 1;
    c.far = 140;
    c.updateProjectionMatrix();
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.035;
    l.shadow.map?.dispose();
    l.shadow.map = null as unknown as THREE.WebGLRenderTarget;
  }, [size, extent, target, preset]);
  useFrame(() => {
    const l = sun.current;
    if (!l) return;
    const texel = (extent * 2) / size;
    const cx = Math.round(telemetry.x / texel) * texel;
    const cz = Math.round(telemetry.z / texel) * texel;
    target.position.set(cx, 0, cz);
    l.position.set(cx + SUN_DIR.x * 60, SUN_DIR.y * 60, cz + SUN_DIR.z * 60);
  });
  return (
    <>
      {"celestial" in P ? (
        <CelestialSky sunDir={SUN_DIR} detail={quality === "low" ? 3 : quality === "medium" ? 4 : 5} palette={P.celestial} />
      ) : (
        <Sky distance={4500} sunPosition={[SUN_DIR.x, SUN_DIR.y, SUN_DIR.z]} turbidity={P.sky.turbidity} rayleigh={P.sky.rayleigh} mieCoefficient={0.006} mieDirectionalG={0.85} />
      )}
      <Environment files={P.env} environmentIntensity={P.envI} />
      <directionalLight ref={sun} castShadow intensity={P.intensity} color={P.color} />
      <hemisphereLight args={[P.hemi[0], P.hemi[1], P.hemi[2]]} />
      <fog attach="fog" args={[P.fog[0], P.fog[1], P.fog[2]]} />
    </>
  );
}
