/**
 * Lighting: physical sky + CC0 HDRI (Poly Haven "esplanade" via @pmndrs/assets) for image-based
 * lighting, one shadow-casting sun. The shadow frustum follows the player and snaps to shadow-map
 * texels (no shimmering) — controlled, small shadow area instead of one huge low-res map.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Sky } from "@react-three/drei";
import esplanade from "@pmndrs/assets/hdri/esplanade.exr";
import { telemetry } from "../player/Player";
import type { Quality } from "../store";

const SUN_DIR = new THREE.Vector3(0.7, 0.6, 0.38).normalize();

export function Lighting({ quality }: { quality: Quality }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  const size = quality === "high" ? 2048 : 1024;
  const extent = quality === "low" ? 14 : 20;
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
    c.far = 90;
    c.updateProjectionMatrix();
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.035;
    l.shadow.map?.dispose();
    l.shadow.map = null as unknown as THREE.WebGLRenderTarget;
  }, [size, extent, target]);
  useFrame(() => {
    const l = sun.current;
    if (!l) return;
    const texel = (extent * 2) / size;
    const cx = Math.round(telemetry.x / texel) * texel;
    const cz = Math.round(telemetry.z / texel) * texel;
    target.position.set(cx, 0, cz);
    l.position.set(cx + SUN_DIR.x * 40, SUN_DIR.y * 40, cz + SUN_DIR.z * 40);
  });
  return (
    <>
      <Sky distance={4500} sunPosition={[SUN_DIR.x, SUN_DIR.y, SUN_DIR.z]} turbidity={6} rayleigh={1.2} mieCoefficient={0.006} mieDirectionalG={0.85} />
      <Environment files={esplanade} environmentIntensity={0.1} />
      <directionalLight ref={sun} castShadow intensity={3.8} color={0xfff0d8} />
      <hemisphereLight args={[0xcfe3ff, 0x5a5040, 0.12]} />
      <fog attach="fog" args={[0xc9d6e2, 45, 140]} />
    </>
  );
}
