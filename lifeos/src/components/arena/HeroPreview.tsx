"use client";
/** Small rotating 3D preview for character inspection. */
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { HERO_BY_ID } from "@/lib/arena/heroes";
import type { HeroRig } from "./HeroModel";
import { HeroAvatar, type Motion } from "./HeroGLB";

function Spin({ heroId }: { heroId: string }) {
  const g = useRef<THREE.Group>(null);
  const rig = useRef<HeroRig>(null);
  const motion = useRef<Motion>({ speed: 0, casting: false });
  useFrame(({ clock }) => {
    if (g.current) g.current.rotation.y = clock.elapsedTime * 0.6;
    const r = rig.current;
    if (r?.body) r.body.position.y = Math.sin(clock.elapsedTime * 2) * 0.04;
    if (r?.armR) r.armR.rotation.x = Math.sin(clock.elapsedTime * 1.3) * 0.25 - 0.2;
  });
  const def = HERO_BY_ID[heroId];
  return (
    <group ref={g} position={[0, -1, 0]}>
      <HeroAvatar ref={rig} def={def} teamColor={def.look.glow} motion={motion} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[1.4, 40]} />
        <meshStandardMaterial color="#1a2236" />
      </mesh>
    </group>
  );
}

export default function HeroPreview({ heroId }: { heroId: string }) {
  return (
    <Canvas camera={{ position: [0, 1.2, 4.2], fov: 35 }} dpr={[1, 2]} data-testid="hero-preview">
      <hemisphereLight args={["#ffffff", "#334", 1]} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <pointLight position={[-2, 2, -2]} intensity={6} color={HERO_BY_ID[heroId].look.glow} />
      <Spin heroId={heroId} />
    </Canvas>
  );
}
