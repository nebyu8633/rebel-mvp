/** The First Sanctuary: terrain (plateau above a sea of clouds) and the distant sky silhouettes. */
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, BallCollider, RigidBody } from "@react-three/rapier";
import { usePBR } from "../../../world/materials";
import { rng } from "../../../world/geometry";
import { BOUND_R, OBS, nearGate, GATE_VIEW, angDist } from "./layout";

/** Where the plateau ends and the cliff falls into the clouds (beyond the 40 m walkable boundary). */
const ISLAND_EDGE = 46;
import { smooth } from "./shared";
import { CloudSea } from "./Life";

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
      // a floating island: a gentle lip just past the walkable boundary (40 m), then a sheer cliff
      // into the sea of clouds. The edge wanders with the ripple; in front of the Sleeping Gate it
      // stays low so its bridge and the isles are in view.
      const notch = 1 - 0.7 * (1 - smooth(0.16, 0.36, angDist(ang, GATE_VIEW)));
      const edge = ISLAND_EDGE + ripple * 1.1;
      // the ground dips gently toward the edge, so from eye height you see the rim and the void
      // (only beyond the walkable boundary: the physics floor is flat at y = 0 up to BOUND_R)
      const lip = -smooth(BOUND_R + 0.5, edge - 1, d) * (1.4 + ripple * 0.25) + smooth(edge - 3, edge - 1.2, d) * 0.35 * notch;
      const drop = -smooth(edge - 0.5, edge + 5, d) * 34 - smooth(edge + 5, edge + 30, d) * 30;
      p.setY(i, d < 34 ? Math.sin(x * 0.15) * Math.cos(z * 0.13) * 0.04 : lip + drop);
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
    // broken spires along the island's edge, in clusters with open gaps between them (so the
    // island reads as floating: you see the drop and the sky through the gaps)
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + r() * 0.1;
      const d = ISLAND_EDGE - 3 + r() * 3;
      const s = 1.4 + r() * 2.6;
      const keep = Math.sin(a * 3 + 0.7) > 0.2; // clusters, with wide open view corridors
      if (angDist(a, GATE_VIEW) < 0.34 || !keep) continue;
      out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: s * 0.5 - 1.2, s: [s * 0.55, s * (1.6 + r() * 1.2), s * 0.55], rot: r() * 6, geo: make(300 + i), collide: false });
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
/**
 * A floating isle: a carved rock body (lathe profile, noise-displaced) tapering to a point below,
 * with a meadow cap. Some carry a broken column.
 */
function isleGeometry(seed: number) {
  const r = rng(seed);
  const prof: THREE.Vector2[] = [];
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const t = i / N; // 0 = bottom tip, 1 = top rim
    const rad = Math.pow(t, 0.55) * (0.85 + r() * 0.3);
    prof.push(new THREE.Vector2(Math.max(0.02, rad), -1.8 + t * 1.8));
  }
  prof.push(new THREE.Vector2(0.98, 0.08), new THREE.Vector2(0.001, 0.12));
  const g = new THREE.LatheGeometry(prof, 14);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.y < 0.05) {
      const n = Math.sin(v.x * 4.1 + seed) * Math.cos(v.z * 3.7 - seed) * 0.12 + Math.sin(v.y * 6 + v.x * 2) * 0.08;
      v.x *= 1 + n;
      v.z *= 1 + n;
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Floating isles around the plateau + the sea of clouds below the cliffs. */
export function Sky() {
  const rock = usePBR("rock", { tint: 0x8f8a86 });
  const meadow = usePBR("meadow", { tint: 0xb9c49a });
  const ruin = usePBR("ruinwall", { tint: 0xcfc6b8 });
  const isles = useMemo(() => {
    const r = rng(41);
    const out: { x: number; z: number; y: number; s: number; phase: number; g: THREE.BufferGeometry; column: boolean }[] = [];
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + r() * 0.4;
      if (angDist(a, GATE_VIEW) < 0.22) continue; // the gate's own isle sits there
      const d = 85 + r() * 110;
      // some float below the plateau's horizon: you see their undersides from the edge
      out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: -14 + r() * 46, s: 6 + r() * 12, phase: r() * 6, g: isleGeometry(50 + i), column: r() < 0.45 });
    }
    return out;
  }, []);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => (c.position.y = isles[i].y + Math.sin(clock.elapsedTime * 0.3 + isles[i].phase) * 0.8));
  });
  const capGeo = useMemo(() => {
    const g = new THREE.CircleGeometry(0.97, 14);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const colGeo = useMemo(() => new THREE.CylinderGeometry(0.05, 0.06, 0.5, 8), []);
  return (
    <group userData={{ noBatch: true }}>
      <CloudSea />
      <group ref={ref}>
        {isles.map((s, i) => (
          <group key={i} position={[s.x, s.y, s.z]} scale={[s.s, s.s * 0.9, s.s]}>
            <mesh geometry={s.g} material={rock} />
            <mesh geometry={capGeo} material={meadow} position-y={0.121} />
            {s.column && <mesh geometry={colGeo} material={ruin} position={[0.3, 0.37, -0.2]} rotation-z={0.15} />}
          </group>
        ))}
      </group>
    </group>
  );
}
