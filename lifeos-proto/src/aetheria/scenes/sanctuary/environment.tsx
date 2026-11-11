/** The First Sanctuary: terrain (plateau above a sea of clouds) and the distant sky silhouettes. */
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, BallCollider, RigidBody } from "@react-three/rapier";
import { usePBR } from "../../../world/materials";
import { rng } from "../../../world/geometry";
import { BOUND_R, OBS, nearGate, GATE_VIEW, angDist } from "./layout";
import { smooth } from "./shared";

// ------------------------------------------------------------------ terrain: plateau above a sea of clouds
export function Terrain() {
  const meadow = usePBR("meadow", { tint: 0xc9d3b2 });
  const rock = usePBR("rock", { tint: 0xb9b4aa });
  const path = usePBR("mosspath");
  const geo = useMemo(() => {
    const S = 260;
    const g = new THREE.PlaneGeometry(S, S, 130, 130);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const r = rng(5);
    const bumps = Array.from({ length: 24 }, () => ({ a: r() * Math.PI * 2, f: 1 + Math.floor(r() * 5), amp: r() }));
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const d = Math.hypot(x, z);
      const ang = Math.atan2(z, x);
      let ripple = 0;
      for (const b of bumps) ripple += Math.sin(ang * b.f + b.a) * b.amp;
      // the rim parts in front of the Sleeping Gate so its bridge and the isles are visible
      const notch = 1 - 0.85 * (1 - smooth(0.16, 0.36, angDist(ang, GATE_VIEW)));
      const hills = smooth(38, 52, d) * (3 + ripple * 0.9) * notch;
      const cliff = -smooth(62, 78, d) * 60;
      p.setY(i, d < 34 ? Math.sin(x * 0.15) * Math.cos(z * 0.13) * 0.04 : hills + cliff);
      uv.setXY(i, x / 4, z / 4);
    }
    g.computeVertexNormals();
    const pathGeo = new THREE.PlaneGeometry(3.4, 33, 1, 1);
    pathGeo.rotateX(-Math.PI / 2);
    const puv = pathGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < puv.count; i++) puv.setXY(i, (puv.getX(i) * 3.4) / 2, (puv.getY(i) * 33) / 2);
    return { ground: g, path: pathGeo };
  }, []);
  const rocks = useMemo(() => {
    const r = rng(17);
    const out: { x: number; z: number; y: number; s: [number, number, number]; rot: number; geo: THREE.BufferGeometry; collide: boolean }[] = [];
    const make = (seed: number) => {
      const g = new THREE.IcosahedronGeometry(1, 2);
      const p = g.attributes.position as THREE.BufferAttribute;
      const rr = rng(seed);
      const amp = Array.from({ length: 6 }, () => rr());
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i);
        const n = 1 + 0.18 * (Math.sin(v.x * 3 + amp[0] * 6) + Math.sin(v.y * 4 + amp[1] * 6) + Math.sin(v.z * 3.5 + amp[2] * 6)) / 3 - (v.y < -0.3 ? 0.25 : 0);
        v.multiplyScalar(n);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
      return g;
    };
    // boulders on the plateau (colliders) — keep the path and observatory clear
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const d = 14 + r() * 22;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (Math.abs(x) < 6 && z > -2) continue;
      if (Math.hypot(x - OBS.x, z - OBS.z) < 11) continue;
      if (nearGate(x, z)) continue;
      const s = 0.6 + r() * 1.6;
      out.push({ x, z, y: s * 0.35, s: [s * (1 + r() * 0.6), s * (0.7 + r() * 0.5), s * (1 + r() * 0.5)], rot: r() * 6, geo: make(100 + i), collide: true });
    }
    // crags on the rim
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + r() * 0.1;
      const d = 44 + r() * 14;
      const s = 4 + r() * 8;
      if (angDist(a, GATE_VIEW) < 0.34) continue;
      out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: s * 0.4 + 2, s: [s, s * (1.2 + r()), s], rot: r() * 6, geo: make(300 + i), collide: false });
    }
    return out;
  }, []);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[60, 0.5, 60]} position={[0, -0.5, 0]} />
        {/* edge of the walkable plateau */}
        {Array.from({ length: 28 }, (_, i) => {
          const a = (i / 28) * Math.PI * 2;
          return <CuboidCollider key={i} args={[4.6, 4, 0.5]} position={[Math.cos(a) * BOUND_R, 4, Math.sin(a) * BOUND_R]} rotation={[0, -a + Math.PI / 2, 0]} />;
        })}
        {rocks
          .filter((k) => k.collide)
          .map((k, i) => (
            <BallCollider key={i} args={[Math.min(k.s[0], k.s[2]) * 0.85]} position={[k.x, k.y, k.z]} />
          ))}
      </RigidBody>
      <mesh geometry={geo.ground} material={meadow} receiveShadow />
      <mesh geometry={geo.path} material={path} position={[0, 0.015, 34 - 33 / 2]} receiveShadow />
      {rocks.map((k, i) => (
        <mesh key={i} geometry={k.geo} material={rock} position={[k.x, k.y, k.z]} scale={k.s} rotation-y={k.rot} castShadow={k.collide} receiveShadow />
      ))}
    </group>
  );
}

/** Distant floating isles + a sea of clouds below the cliffs (fantasy silhouette). */
export function Sky() {
  const rock = usePBR("rock", { tint: 0x9d9a94 });
  const isles = useMemo(() => {
    const r = rng(41);
    return Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2 + r();
      const d = 95 + r() * 70;
      const g = new THREE.ConeGeometry(1, 1.6, 7, 3);
      g.rotateX(Math.PI);
      return { x: Math.cos(a) * d, z: Math.sin(a) * d, y: 18 + r() * 40, s: 5 + r() * 9, phase: r() * 6, g };
    });
  }, []);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => (c.position.y = isles[i].y + Math.sin(clock.elapsedTime * 0.3 + isles[i].phase) * 0.8));
  });
  const clouds = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xe9e6f2, roughness: 1, emissive: 0x6c6f88, emissiveIntensity: 0.25 }), []);
  return (
    <group userData={{ noBatch: true }}>
      <mesh rotation-x={-Math.PI / 2} position={[0, -22, 0]} material={clouds}>
        <circleGeometry args={[600, 48]} />
      </mesh>
      <group ref={ref}>
        {isles.map((s, i) => (
          <mesh key={i} geometry={s.g} material={rock} position={[s.x, s.y, s.z]} scale={[s.s, s.s, s.s]} />
        ))}
      </group>
    </group>
  );
}
