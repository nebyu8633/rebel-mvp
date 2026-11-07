/**
 * Urban test scene (metres, +Y up). Layout:
 *   plaza    — cobblestone disc r=14 around (0,0), fountain, benches, lamps, trees, kiosk, crates
 *   hall     — podium (top y=1.02) z∈[-30,-14]; 6-step stair x∈[-4,4]; 20° ramp (west); 50° wedge (east, must NOT be climbable)
 *              front wall z=-16 with an interactive hinged door → small vestibule
 *   street   — asphalt x∈[-4,4], z∈[13,62]; raised sidewalks (0.15 m curbs) and facades on both sides
 * Every solid has a Rapier collider; crates/ball are dynamic (pushed by the character controller).
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { CuboidCollider, CylinderCollider, BallCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { usePBR } from "./materials";
import { rng, worldBox, worldCylinder, worldDisc, worldPlane } from "./geometry";
import { Tree } from "./Trees";
import { Batched } from "./Batched";
import { asset, gltfExtensions } from "../lib/loaders";
import { useThree } from "@react-three/fiber";
import { interactables, useProto } from "../store";
import { emitMockEvent } from "../progression/useProgression";

export const PODIUM = { top: 1.02, front: -14, back: -30, x0: -9.5, x1: 9.5 };
const STEP = { n: 6, rise: 0.17, run: 0.35, x0: -4, x1: 4 };
const STREET = { x: 4, z0: 13, z1: 62, walk: 3, curb: 0.15 };

// ------------------------------------------------------------------ ground
function Ground() {
  const grass = usePBR("grass", { tint: 0xb8c4a0 });
  const plaza = usePBR("plaza");
  const street = usePBR("street");
  const side = usePBR("sidewalk");
  const granite = usePBR("granite");
  const geo = useMemo(
    () => ({
      grass: worldPlane(80, 110, 3),
      plaza: worldDisc(14, 2.2, 72),
      street: worldPlane(STREET.x * 2, STREET.z1 - STREET.z0, 4),
      walk: worldBox(STREET.walk, STREET.curb, STREET.z1 - STREET.z0, 2.5),
      curb: worldBox(0.25, STREET.curb + 0.02, STREET.z1 - STREET.z0, 1.5),
      ring: worldCylinder(14.25, 14.25, 0.06, 2, 72, true),
    }),
    [],
  );
  const len = STREET.z1 - STREET.z0;
  const zc = (STREET.z0 + STREET.z1) / 2;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[40, 0.5, 55]} position={[0, -0.5, 14]} />
        {/* sidewalks (curb height 0.15 → autostep) */}
        <CuboidCollider args={[STREET.walk / 2, STREET.curb / 2, len / 2]} position={[STREET.x + STREET.walk / 2, STREET.curb / 2, zc]} />
        <CuboidCollider args={[STREET.walk / 2, STREET.curb / 2, len / 2]} position={[-STREET.x - STREET.walk / 2, STREET.curb / 2, zc]} />
        {/* world bounds */}
        <CuboidCollider args={[0.5, 4, 55]} position={[-24, 4, 14]} />
        <CuboidCollider args={[0.5, 4, 55]} position={[24, 4, 14]} />
        <CuboidCollider args={[24, 4, 0.5]} position={[0, 4, -33]} />
        <CuboidCollider args={[24, 4, 0.5]} position={[0, 4, 62]} />
      </RigidBody>
      <mesh geometry={geo.grass} material={grass} position={[0, -0.002, 14]} receiveShadow />
      <mesh geometry={geo.plaza} material={plaza} position={[0, 0.004, 0]} receiveShadow />
      <mesh geometry={geo.ring} material={granite} position={[0, 0.03, 0]} receiveShadow />
      <mesh geometry={geo.street} material={street} position={[0, 0.006, zc]} receiveShadow />
      <mesh geometry={geo.walk} material={side} position={[STREET.x + STREET.walk / 2, STREET.curb / 2, zc]} receiveShadow />
      <mesh geometry={geo.walk} material={side} position={[-STREET.x - STREET.walk / 2, STREET.curb / 2, zc]} receiveShadow />
      <mesh geometry={geo.curb} material={granite} position={[STREET.x + 0.12, (STREET.curb + 0.02) / 2, zc]} receiveShadow />
      <mesh geometry={geo.curb} material={granite} position={[-STREET.x - 0.12, (STREET.curb + 0.02) / 2, zc]} receiveShadow />
    </group>
  );
}

// ------------------------------------------------------------------ fountain
function Fountain() {
  const granite = usePBR("granite");
  const geo = useMemo(() => ({ wall: worldCylinder(2.6, 2.7, 0.55, 1.5, 48), top: worldCylinder(2.75, 2.75, 0.08, 1.5, 48), inner: worldCylinder(0.35, 0.5, 1.6, 1, 20), bowl: worldCylinder(1.1, 0.4, 0.3, 1, 32) }), []);
  const water = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x2b3f45, roughness: 0.04, metalness: 0.2, envMapIntensity: 1.2 }), []);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.4, 2.75]} position={[0, 0.4, 0]} />
      </RigidBody>
      <mesh geometry={geo.wall} material={granite} position={[0, 0.275, 0]} castShadow receiveShadow />
      <mesh geometry={geo.top} material={granite} position={[0, 0.59, 0]} castShadow receiveShadow />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.45, 0]} material={water}>
        <circleGeometry args={[2.55, 48]} />
      </mesh>
      <mesh geometry={geo.inner} material={granite} position={[0, 1.25, 0]} castShadow />
      <mesh geometry={geo.bowl} material={granite} position={[0, 2.1, 0]} castShadow />
    </group>
  );
}

// ------------------------------------------------------------------ hall (stairs, ramps, door)
function Hall() {
  const granite = usePBR("granite");
  const plaster = usePBR("plaster", { tint: 0xf2ebdf });
  const side = usePBR("sidewalk");
  const lit = useProto((s) => s.litWindows);
  const geo = useMemo(() => {
    const W = PODIUM.x1 - PODIUM.x0;
    const D = PODIUM.back - PODIUM.front;
    return {
      podium: worldBox(W, PODIUM.top, Math.abs(D), 2),
      step: worldBox(STEP.x1 - STEP.x0, STEP.rise, STEP.run, 1.5),
      back: worldBox(16, 9, 8.4, 3),
      wing: worldBox(5.7, 9, 3.6, 3),
      vestTop: worldBox(4.6, 5.6, 3.6, 3),
      wallSide: worldBox(7.3, 2.4, 0.4, 3),
      lintel: worldBox(16, 6.6, 0.4, 3),
      column: worldCylinder(0.32, 0.36, 7, 1.2, 20),
      cap: worldBox(0.9, 0.3, 0.9, 1),
      entab: worldBox(13.5, 0.7, 1.4, 2),
      ramp: worldBox(2, 0.12, 3.1, 1.5),
      wedge: worldBox(2, 0.12, 1.4, 1.5),
    };
  }, []);
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x1a232b, roughness: 0.06, metalness: 0.6, envMapIntensity: 1.3 }), []);
  const glassLit = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x3a2a10, emissive: 0xffc46b, emissiveIntensity: 2.2, roughness: 0.3 }), []);
  const winPos: [number, number][] = [
    [-6, 5.2],
    [-3.2, 5.2],
    [3.2, 5.2],
    [6, 5.2],
    [-6, 8.2],
    [-3.2, 8.2],
    [3.2, 8.2],
    [6, 8.2],
  ];
  const rampAngle = Math.atan2(PODIUM.top, 2.8); // ≈20°
  const wedgeAngle = (50 * Math.PI) / 180;
  const wedgeLen = PODIUM.top / Math.sin(wedgeAngle);
  const rampLen = PODIUM.top / Math.sin(rampAngle);
  const zDoor = -16;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {/* podium */}
        <CuboidCollider args={[(PODIUM.x1 - PODIUM.x0) / 2, PODIUM.top / 2, (PODIUM.front - PODIUM.back) / 2]} position={[0, PODIUM.top / 2, (PODIUM.front + PODIUM.back) / 2]} />
        {/* steps: rise 0.17 < autostep 0.32 */}
        {Array.from({ length: STEP.n }, (_, i) => (
          <CuboidCollider key={i} args={[(STEP.x1 - STEP.x0) / 2, (STEP.rise * (i + 1)) / 2, STEP.run / 2]} position={[0, (STEP.rise * (i + 1)) / 2, PODIUM.front + STEP.run * (STEP.n - i) - STEP.run / 2]} />
        ))}
        {/* 20° ramp (climbable) */}
        <CuboidCollider args={[1, 0.06, rampLen / 2]} position={[-7.5, PODIUM.top / 2 - 0.05, PODIUM.front + (Math.cos(rampAngle) * rampLen) / 2]} rotation={[rampAngle, 0, 0]} />
        {/* 50° wedge (too steep: max climb 46°) */}
        <CuboidCollider args={[1, 0.06, wedgeLen / 2]} position={[7.5, PODIUM.top / 2 - 0.05, PODIUM.front + (Math.cos(wedgeAngle) * wedgeLen) / 2]} rotation={[wedgeAngle, 0, 0]} />
        {/* front wall with a doorway x∈[-0.7,0.7], h=2.4 */}
        <CuboidCollider args={[3.65, 1.2, 0.2]} position={[-4.35, PODIUM.top + 1.2, zDoor - 0.2]} />
        <CuboidCollider args={[3.65, 1.2, 0.2]} position={[4.35, PODIUM.top + 1.2, zDoor - 0.2]} />
        <CuboidCollider args={[8, 3.3, 0.2]} position={[0, PODIUM.top + 2.4 + 3.3, zDoor - 0.2]} />
        {/* massing: back block + two wings; the gap between the wings is the vestibule (x∈[-2.3,2.3], z∈[-20,-16.4]) */}
        <CuboidCollider args={[8, 4.5, 4.2]} position={[0, PODIUM.top + 4.5, -24.2]} />
        <CuboidCollider args={[2.85, 4.5, 1.8]} position={[-5.15, PODIUM.top + 4.5, -18.2]} />
        <CuboidCollider args={[2.85, 4.5, 1.8]} position={[5.15, PODIUM.top + 4.5, -18.2]} />
        <CuboidCollider args={[2.3, 2.8, 1.8]} position={[0, PODIUM.top + 3.4 + 2.8, -18.2]} />
        {/* columns */}
        {[-5.5, -2.2, 2.2, 5.5].map((x) => (
          <CylinderCollider key={x} args={[3.5, 0.36]} position={[x, PODIUM.top + 3.5, -14.9]} />
        ))}
      </RigidBody>

      <mesh geometry={geo.podium} material={granite} position={[0, PODIUM.top / 2, (PODIUM.front + PODIUM.back) / 2]} castShadow receiveShadow />
      {Array.from({ length: STEP.n }, (_, i) => (
        <mesh key={i} geometry={geo.step} material={granite} scale={[1, i + 1, 1]} position={[0, (STEP.rise * (i + 1)) / 2, PODIUM.front + STEP.run * (STEP.n - i) - STEP.run / 2]} castShadow receiveShadow />
      ))}
      <mesh geometry={geo.ramp} material={side} scale={[1, 1, rampLen / 3.1]} position={[-7.5, PODIUM.top / 2 - 0.05, PODIUM.front + (Math.cos(rampAngle) * rampLen) / 2]} rotation={[rampAngle, 0, 0]} castShadow receiveShadow />
      <mesh geometry={geo.wedge} material={side} scale={[1, 1, wedgeLen / 1.4]} position={[7.5, PODIUM.top / 2 - 0.05, PODIUM.front + (Math.cos(wedgeAngle) * wedgeLen) / 2]} rotation={[wedgeAngle, 0, 0]} castShadow receiveShadow />

      {/* facade */}
      <mesh geometry={geo.wallSide} material={plaster} position={[-4.35, PODIUM.top + 1.2, zDoor - 0.2]} castShadow receiveShadow />
      <mesh geometry={geo.wallSide} material={plaster} position={[4.35, PODIUM.top + 1.2, zDoor - 0.2]} castShadow receiveShadow />
      <mesh geometry={geo.lintel} material={plaster} position={[0, PODIUM.top + 2.4 + 3.3, zDoor - 0.2]} castShadow receiveShadow />
      <mesh geometry={geo.back} material={plaster} position={[0, PODIUM.top + 4.5, -24.2]} castShadow receiveShadow />
      <mesh geometry={geo.wing} material={plaster} position={[-5.15, PODIUM.top + 4.5, -18.2]} castShadow receiveShadow />
      <mesh geometry={geo.wing} material={plaster} position={[5.15, PODIUM.top + 4.5, -18.2]} castShadow receiveShadow />
      <mesh geometry={geo.vestTop} material={plaster} position={[0, PODIUM.top + 3.4 + 2.8, -18.2]} receiveShadow />
      {winPos.map(([x, y], i) => (
        <group key={i} position={[x, PODIUM.top + y - 2.6, zDoor + 0.005]} userData={{ noBatch: true }}>
          <mesh material={i < lit ? glassLit : glass}>
            <planeGeometry args={[1.3, 1.9]} />
          </mesh>
          <mesh material={granite} position={[0, -1.05, 0.06]}>
            <boxGeometry args={[1.6, 0.12, 0.14]} />
          </mesh>
        </group>
      ))}
      {[-5.5, -2.2, 2.2, 5.5].map((x) => (
        <group key={x} position={[x, PODIUM.top, -14.9]}>
          <mesh geometry={geo.column} material={plaster} position={[0, 3.5, 0]} castShadow receiveShadow />
          <mesh geometry={geo.cap} material={granite} position={[0, 7.05, 0]} castShadow />
          <mesh geometry={geo.cap} material={granite} position={[0, 0.15, 0]} castShadow />
        </group>
      ))}
      <mesh geometry={geo.entab} material={granite} position={[0, PODIUM.top + 7.55, -15.2]} castShadow receiveShadow />
      <Door x={-0.7} y={PODIUM.top} z={zDoor - 0.2} />
    </group>
  );
}

// ------------------------------------------------------------------ door (kinematic, hinged, interactive)
function Door({ x, y, z }: { x: number; y: number; z: number }) {
  const wood = usePBR("wood", { tint: 0x8a6a50 });
  const metal = usePBR("metal", { tint: 0x9a8f80, noColor: true, metalness: 0.75, roughness: 0.9 });
  const rb = useRef<RapierRigidBody>(null);
  const open = useProto((s) => s.doorOpen);
  const angle = useRef(0);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const geo = useMemo(() => worldBox(1.4, 2.38, 0.07, 1.2), []);
  useEffect(() => {
    interactables.set("door", {
      id: "door",
      label: "פתח / סגור דלת",
      x: x + 0.7,
      y,
      z: z + 0.85,
      radius: 2.0,
      onContact: () => useProto.getState().set({ doorOpen: !useProto.getState().doorOpen }),
    });
    return () => void interactables.delete("door");
  }, [x, y, z]);
  useFrame((_, dt) => {
    const target = open ? 1.75 : 0;
    angle.current += (target - angle.current) * (1 - Math.exp(-3.2 * Math.min(dt, 0.1)));
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle.current);
    rb.current?.setNextKinematicRotation(q);
  });
  return (
    <group userData={{ noBatch: true }}>
    <RigidBody ref={rb} type="kinematicPosition" colliders={false} position={[x, y, z]}>
      <CuboidCollider args={[0.7, 1.19, 0.035]} position={[0.7, 1.19, 0]} />
      <mesh geometry={geo} material={wood} position={[0.7, 1.19, 0]} castShadow receiveShadow />
      <mesh material={metal} position={[1.25, 1.05, 0.07]} castShadow>
        <boxGeometry args={[0.04, 0.04, 0.14]} />
      </mesh>
      <mesh material={metal} position={[1.25, 1.05, -0.07]}>
        <boxGeometry args={[0.04, 0.04, 0.14]} />
      </mesh>
    </RigidBody>
    </group>
  );
}

// ------------------------------------------------------------------ kiosk (mock LifeOS event terminal)
function Kiosk({ x, z, yaw }: { x: number; z: number; yaw: number }) {
  const metal = usePBR("metal", { tint: 0x55606a, noColor: true, metalness: 0.75, roughness: 0.9 });
  const screen = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x0c1a22, emissive: 0x3fb6ff, emissiveIntensity: 1.4, roughness: 0.2 }), []);
  useEffect(() => {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    interactables.set("kiosk", {
      id: "kiosk",
      label: "מסוף LifeOS (דמו): שלח אירוע מאומת לדוגמה",
      x: x + fx * 0.75,
      y: 0,
      z: z + fz * 0.75,
      radius: 1.4,
      onContact: () => emitMockEvent(),
    });
    return () => void interactables.delete("kiosk");
  }, [x, z, yaw]);
  return (
    <group position={[x, 0, z]} rotation-y={yaw}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.35, 0.8, 0.22]} position={[0, 0.8, 0]} />
      </RigidBody>
      <mesh material={metal} position={[0, 0.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 1.6, 0.44]} />
      </mesh>
      <mesh material={screen} position={[0, 1.22, 0.225]} rotation-x={-0.12}>
        <planeGeometry args={[0.5, 0.36]} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ street furniture
function Bench({ x, z, yaw }: { x: number; z: number; yaw: number }) {
  const wood = usePBR("wood");
  const metal = usePBR("metal", { tint: 0x3a3d40, noColor: true, metalness: 0.75, roughness: 0.9 });
  const slat = useMemo(() => worldBox(1.8, 0.04, 0.11, 1), []);
  return (
    <group position={[x, 0, z]} rotation-y={yaw}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.95, 0.42, 0.3]} position={[0, 0.42, 0]} />
      </RigidBody>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={slat} material={wood} position={[0, 0.45, -0.2 + i * 0.13]} castShadow receiveShadow />
      ))}
      {[0, 1].map((i) => (
        <mesh key={`b${i}`} geometry={slat} material={wood} position={[0, 0.62 + i * 0.14, -0.29]} rotation-x={-0.25} castShadow />
      ))}
      {[-0.75, 0.75].map((lx) => (
        <mesh key={lx} material={metal} position={[lx, 0.4, -0.02]} castShadow>
          <boxGeometry args={[0.06, 0.8, 0.55]} />
        </mesh>
      ))}
    </group>
  );
}

function Lanterns({ spots }: { spots: [number, number, number][] }) {
  const gl = useThree((s) => s.gl);
  const { scene } = useGLTF(asset("env/lantern.glb"), false, true, gltfExtensions(gl));
  const S = 4.4 / 25.7;
  // one InstancedMesh per lantern sub-mesh: 16 lamps cost as much as one
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true);
    const list: { geo: THREE.BufferGeometry; mat: THREE.Material; local: THREE.Matrix4 }[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) list.push({ geo: m.geometry, mat: m.material as THREE.Material, local: m.matrixWorld.clone() });
    });
    return list;
  }, [scene]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useEffect(() => {
    const o = new THREE.Object3D();
    parts.forEach((p, k) => {
      const im = refs.current[k];
      if (!im) return;
      spots.forEach(([x, z, yaw], i) => {
        o.position.set(x, 0, z);
        o.rotation.set(0, yaw, 0);
        o.scale.setScalar(S);
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix.clone().multiply(p.local));
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    });
  }, [parts, spots, S]);
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        {spots.map(([x, z], i) => (
          <CylinderCollider key={i} args={[1.8, 0.16]} position={[x, 1.8, z]} />
        ))}
      </RigidBody>
      {parts.map((p, k) => (
        <instancedMesh key={k} ref={(el) => void (refs.current[k] = el)} args={[p.geo, p.mat, spots.length]} castShadow receiveShadow />
      ))}
    </>
  );
}

function Bin({ x, z }: { x: number; z: number }) {
  const metal = usePBR("metal", { tint: 0x2f3a33, noColor: true, metalness: 0.75, roughness: 0.9 });
  const g = useMemo(() => worldCylinder(0.28, 0.25, 0.9, 1, 16), []);
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.45, 0.28]} position={[0, 0.45, 0]} />
      </RigidBody>
      <mesh geometry={g} material={metal} position={[0, 0.45, 0]} castShadow receiveShadow />
    </group>
  );
}

// ------------------------------------------------------------------ dynamic props
function Crates() {
  const wood = usePBR("wood", { tint: 0xb08860 });
  const g = useMemo(() => worldBox(0.7, 0.7, 0.7, 0.7), []);
  const spots: [number, number, number][] = [
    [6.5, 0.36, -4],
    [7.3, 0.36, -4.2],
    [6.9, 1.07, -4.1],
    [-5, 0.36, -6],
  ];
  return (
    <>
      {spots.map((p, i) => (
        <RigidBody key={i} position={p} colliders={false} mass={14} linearDamping={0.6} angularDamping={0.6} friction={0.8}>
          <CuboidCollider args={[0.35, 0.35, 0.35]} />
          <mesh name={`crate${i}`} geometry={g} material={wood} castShadow receiveShadow />
        </RigidBody>
      ))}
      <RigidBody position={[-3.5, 0.3, 4]} colliders={false} mass={2} restitution={0.5} linearDamping={0.3} angularDamping={0.3}>
        <BallCollider args={[0.3]} />
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.3, 32, 16]} />
          <meshStandardMaterial color={0xb8452f} roughness={0.55} />
        </mesh>
      </RigidBody>
    </>
  );
}

// ------------------------------------------------------------------ buildings
interface Bld {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  mat: "plaster" | "brick";
  face: 1 | -1 | 0; // +x / -x facing windows (0: facing +z)
}

function Buildings() {
  const plaster = usePBR("plaster", { tint: 0xe8dcc6 });
  const brick = usePBR("brick");
  const granite = usePBR("granite");
  const list = useMemo(() => {
    const r = rng(11);
    const out: Bld[] = [];
    for (const side of [-1, 1] as const)
      for (let z = 17; z < 60; z += 9.5) {
        const w = 6 + r() * 2.5;
        const d = 8.5 + r() * 1.5;
        out.push({ x: side * (STREET.x + STREET.walk + d / 2), z: z + w / 2, w, d, h: 8 + Math.floor(r() * 3) * 3, mat: r() > 0.5 ? "brick" : "plaster", face: (-side as 1 | -1) });
      }
    out.push({ x: -19, z: -3, w: 10, d: 8, h: 11, mat: "brick", face: 1 });
    out.push({ x: 19, z: -3, w: 10, d: 8, h: 11, mat: "plaster", face: -1 });
    out.push({ x: -17, z: 10, w: 8, d: 7, h: 8, mat: "plaster", face: 1 });
    out.push({ x: 17, z: 10, w: 8, d: 7, h: 8, mat: "brick", face: -1 });
    return out;
  }, []);
  const geos = useMemo(() => list.map((b) => worldBox(b.d, b.h, b.w, b.mat === "brick" ? 2 : 3)), [list]);
  // windows: instanced glass + sills
  const glassRef = useRef<THREE.InstancedMesh>(null);
  const sillRef = useRef<THREE.InstancedMesh>(null);
  const wins = useMemo(() => {
    const m: THREE.Matrix4[] = [];
    const o = new THREE.Object3D();
    for (const b of list) {
      const along = b.w; // facade length along z
      const n = Math.max(2, Math.floor(along / 2.2));
      for (let f = 0; f < Math.floor((b.h - 1) / 3); f++)
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n - 0.5;
          o.position.set(b.x + b.face * (b.d / 2 + 0.01), 1.9 + f * 3, b.z + t * along);
          o.rotation.set(0, (b.face * Math.PI) / 2, 0);
          o.updateMatrix();
          m.push(o.matrix.clone());
        }
    }
    return m;
  }, [list]);
  useEffect(() => {
    const sill = new THREE.Matrix4().makeTranslation(0, -0.85, 0.05);
    wins.forEach((m, i) => {
      glassRef.current!.setMatrixAt(i, m);
      sillRef.current!.setMatrixAt(i, m.clone().multiply(sill));
    });
    glassRef.current!.instanceMatrix.needsUpdate = sillRef.current!.instanceMatrix.needsUpdate = true;
    glassRef.current!.computeBoundingSphere();
    sillRef.current!.computeBoundingSphere();
  }, [wins]);
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x1b2229, roughness: 0.08, metalness: 0.5, envMapIntensity: 1.2 }), []);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {list.map((b, i) => (
          <CuboidCollider key={i} args={[b.d / 2, b.h / 2, b.w / 2]} position={[b.x, b.h / 2, b.z]} />
        ))}
      </RigidBody>
      {list.map((b, i) => (
        <group key={i}>
          <mesh geometry={geos[i]} material={b.mat === "brick" ? brick : plaster} position={[b.x, b.h / 2, b.z]} castShadow receiveShadow />
          <mesh material={granite} position={[b.x, b.h + 0.15, b.z]} castShadow>
            <boxGeometry args={[b.d + 0.3, 0.3, b.w + 0.3]} />
          </mesh>
        </group>
      ))}
      <instancedMesh ref={glassRef} args={[undefined, glass, wins.length]}>
        <planeGeometry args={[1.1, 1.6]} />
      </instancedMesh>
      <instancedMesh ref={sillRef} args={[undefined, granite, wins.length]} castShadow>
        <boxGeometry args={[1.35, 0.1, 0.16]} />
      </instancedMesh>
    </group>
  );
}

// ------------------------------------------------------------------ scene
export function World({ quality }: { quality: "high" | "medium" | "low" }) {
  const trees: [number, number, number][] = [
    [-10, 9, 1],
    [10, 9, 2],
    [-11, -7, 3],
    [11, -7, 4],
    [-5.6, 22, 5],
    [5.6, 27, 6],
    [-5.6, 34, 7],
    [5.6, 41, 8],
    [-5.6, 48, 9],
    [5.6, 55, 10],
    [-14, 2, 11],
    [14, 2, 12],
  ];
  const lamps = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let z = 18; z < 60; z += 10) {
      out.push([-4.7, z, 0], [4.7, z + 5, Math.PI]); // arm over the street
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      out.push([Math.cos(a) * 12.6, Math.sin(a) * 12.6, -a + Math.PI]);
    }
    return out;
  }, []);
  const benches: [number, number, number][] = [
    [-3, 9.3, Math.PI - 0.3],
    [8.6, -2.4, -Math.PI / 2 - 0.25],
    [-8.6, -2.4, Math.PI / 2 + 0.25],
    [3.2, 9.4, Math.PI + 0.3],
  ];
  return (
    <group>
      <Batched>
        <Ground />
        <Fountain />
        <Hall />
        <Buildings />
        <Kiosk x={-6.2} z={7.6} yaw={2.45} />
        {benches.map(([x, z, y], i) => (
          <Bench key={i} x={x} z={z} yaw={y} />
        ))}
        {[
          [-5.2, 16],
          [5.2, 30],
          [-5.2, 44],
          [9.5, 6.5],
        ].map(([x, z], i) => (
          <Bin key={i} x={x} z={z} />
        ))}
      </Batched>
      <Crates />
      <Lanterns spots={lamps} />
      {trees.map(([x, z, s]) => (
        <Tree key={s} x={x} z={z} seed={s} height={6 + (s % 3) * 0.8} shadows={quality !== "low"} />
      ))}
    </group>
  );
}
