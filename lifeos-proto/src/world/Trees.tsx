/**
 * Procedural deciduous trees: tapered bark trunk + branches (merged) and alpha-tested leaf cards
 * (CC0 ambientCG Leaf001 with opacity). Three LOD levels per tree via drei <Detailed>:
 *   L0 (< 16 m)  ~420 leaf cards       L1 (< 38 m) ~110 larger cards       L2 ~28 large cards
 * Trunk collider only (cylinder).
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Detailed } from "@react-three/drei";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { usePBR } from "./materials";
import { rng, worldCylinder } from "./geometry";

interface TreeShape {
  wood: THREE.BufferGeometry;
  crowns: THREE.Vector3[]; // cluster centres
  radius: number;
}

function makeShape(seed: number, height: number): TreeShape {
  const r = rng(seed);
  const trunkH = height * 0.55;
  const parts: THREE.BufferGeometry[] = [];
  const trunk = worldCylinder(0.13, 0.22, trunkH, 1.2, 10);
  trunk.translate(0, trunkH / 2, 0);
  parts.push(trunk);
  const crowns: THREE.Vector3[] = [];
  const n = 5 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.6;
    const len = height * (0.28 + r() * 0.12);
    const tilt = 0.55 + r() * 0.35;
    const b = worldCylinder(0.035, 0.09, len, 1.2, 6);
    b.translate(0, len / 2, 0);
    b.rotateZ(tilt);
    b.rotateY(a);
    const y0 = trunkH * (0.75 + r() * 0.25);
    b.translate(0, y0, 0);
    parts.push(b);
    const dir = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), tilt).applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
    crowns.push(dir.multiplyScalar(len).add(new THREE.Vector3(0, y0, 0)));
  }
  crowns.push(new THREE.Vector3(0, trunkH + height * 0.25, 0));
  const wood = mergeGeometries(parts.map((p) => p.toNonIndexed()), false)!;
  return { wood, crowns, radius: height * 0.24 };
}

function Leaves({ shape, count, size, seed }: { shape: TreeShape; count: number; size: number; seed: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = usePBR("leaf", { tint: 0xc8d8b0, normalScale: 0.6 });
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(size, size);
    // bend normals outward a little so cards don't look flat-lit
    return g;
  }, [size]);
  useLayoutEffect(() => {
    const m = ref.current!;
    const r = rng(seed);
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const c = shape.crowns[i % shape.crowns.length];
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const rad = shape.radius * Math.cbrt(r());
      const s = Math.sqrt(1 - u * u);
      o.position.set(c.x + rad * s * Math.cos(th), c.y + rad * u * 0.7, c.z + rad * s * Math.sin(th));
      o.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
      o.scale.setScalar(0.7 + r() * 0.6);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [count, seed, shape]);
  return <instancedMesh ref={ref} args={[geo, mat, count]} castShadow receiveShadow />;
}

export function Tree({ x, z, seed, height = 6.5, shadows = true }: { x: number; z: number; seed: number; height?: number; shadows?: boolean }) {
  const shape = useMemo(() => makeShape(seed, height), [seed, height]);
  const bark = usePBR("bark");
  return (
    <group position={[x, 0, z]} rotation-y={seed}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1.6, 0.24]} position={[0, 1.6, 0]} />
      </RigidBody>
      <Detailed distances={[0, 16, 38]}>
        <group>
          <mesh geometry={shape.wood} material={bark} castShadow={shadows} receiveShadow />
          <Leaves shape={shape} count={420} size={0.34} seed={seed * 7 + 1} />
        </group>
        <group>
          <mesh geometry={shape.wood} material={bark} castShadow={shadows} />
          <Leaves shape={shape} count={110} size={0.7} seed={seed * 7 + 2} />
        </group>
        <group>
          <mesh geometry={shape.wood} material={bark} />
          <Leaves shape={shape} count={28} size={1.4} seed={seed * 7 + 3} />
        </group>
      </Detailed>
    </group>
  );
}
