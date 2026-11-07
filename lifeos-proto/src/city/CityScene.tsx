/**
 * LifeOS city — vertical slice: central plaza, LifeOS tower (enterable lobby), six district gates
 * (existing regions) with progress + lock state from (mock) LifeOS data, enclosing buildings,
 * skyline, monorail. Static geometry is batched per material; every solid has a collider.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { usePBR } from "../world/materials";
import { rng, worldBox, worldCylinder, worldDisc } from "../world/geometry";
import { Batched } from "../world/Batched";
import { Tree } from "../world/Trees";
import { AVENUE, DISTRICTS, FOUNTAIN, PLAZA, TOWER, developmentStage, dirOf, gatePos, type DistrictDef } from "./layout";
import { FACADE_TILE_M, logoTexture, mullionTexture, signTexture, windowTexture } from "./textures";
import { interactables, useProto, type Quality } from "../store";
import { emitMockEvent } from "../progression/useProgression";
import type { LifeOSSnapshot } from "../data/lifeos";
import { DEMO_EVENTS } from "../config";
import { goToWorld, worldAvailable } from "../engine/worldStore";

/** A shimmering vertical crack of light in the tower lobby (the way into AETHERIA). */
function ResonanceCrack({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xcff0ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), []);
  useFrame(({ clock }) => {
    mat.opacity = 0.55 + Math.sin(clock.elapsedTime * 3) * 0.25;
    if (ref.current) ref.current.scale.x = 1 + Math.sin(clock.elapsedTime * 1.7) * 0.25;
  });
  return (
    <mesh ref={ref} material={mat} position={[x, 1.6, z]} rotation-y={-Math.PI / 2} userData={{ noBatch: true }}>
      <planeGeometry args={[0.22, 2.6]} />
    </mesh>
  );
}

const deg = (d: number) => (d * Math.PI) / 180;

// ------------------------------------------------------------------ materials (glass + emissive)
function useGlass(seed: number, lit = 0.22, tint: "warm" | "cool" = "warm", color = 0xb4c3d6) {
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        name: `glass${seed}`,
        color,
        map: mullionTexture(),
        metalness: 0.92,
        roughness: 0.06,
        emissive: 0xffffff,
        emissiveMap: windowTexture(seed, lit, tint),
        emissiveIntensity: 1.1,
        envMapIntensity: 2.4,
      }),
    [seed, lit, tint, color],
  );
}
const glow = (color: number, intensity = 2.5) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });

// ------------------------------------------------------------------ ground
function Ground() {
  const plaza = usePBR("granite", { roughness: 0.55, tint: 0xd8d2ca });
  const walk = usePBR("sidewalk", { tint: 0xc8c4bd });
  const street = usePBR("street", { tint: 0x8a8a8a });
  const geo = useMemo(() => {
    const avenues: THREE.BufferGeometry[] = [];
    for (const d of DISTRICTS) {
      const g = worldBox(AVENUE.w, 0.04, AVENUE.endR - PLAZA.r + 2, 3);
      g.translate(0, 0.02, PLAZA.r - 1 + (AVENUE.endR - PLAZA.r + 2) / 2);
      g.rotateY(gatePos(d).yaw);
      avenues.push(g);
    }
    const forecourt = worldBox(26, 0.04, 22, 3);
    forecourt.translate(0, 0.02, -(PLAZA.r + 9));
    avenues.push(forecourt);
    return { plaza: worldDisc(PLAZA.r + 1, 3, 96), ring: worldCylinder(PLAZA.r + 1.2, PLAZA.r + 1.2, 0.08, 2, 96, true), avenues, ground: worldDisc(260, 6, FACADE_TILE_M) };
  }, []);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[200, 0.5, 200]} position={[0, -0.5, 0]} />
      </RigidBody>
      <mesh geometry={geo.ground} material={street} position={[0, -0.01, 0]} receiveShadow />
      <mesh geometry={geo.plaza} material={plaza} position={[0, 0.005, 0]} receiveShadow />
      <mesh geometry={geo.ring} material={walk} position={[0, 0.04, 0]} receiveShadow />
      {geo.avenues.map((g, i) => (
        <mesh key={i} geometry={g} material={walk} receiveShadow />
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ fountain with sculpture ring
function Fountain() {
  const granite = usePBR("granite");
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xc9a46a, metalness: 1, roughness: 0.22, envMapIntensity: 1.6 }), []);
  const water = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x1d3442, roughness: 0.03, metalness: 0.3, envMapIntensity: 1.8 }), []);
  const jetMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xdff4ff, emissive: 0x9fd8ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false }), []);
  const ring = useRef<THREE.Group>(null);
  const jets = useRef<THREE.Group>(null);
  const geo = useMemo(() => ({ wall: worldCylinder(FOUNTAIN.r, FOUNTAIN.r + 0.1, 0.6, 1.5, 64, true), lip: worldCylinder(FOUNTAIN.r + 0.25, FOUNTAIN.r + 0.25, 0.1, 1.5, 64), base: worldCylinder(0.9, 1.2, 0.9, 1, 24) }), []);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.y = clock.elapsedTime * 0.12;
    jets.current?.children.forEach((j, i) => (j.scale.y = 0.85 + 0.15 * Math.sin(clock.elapsedTime * 3 + i)));
  });
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.45, FOUNTAIN.r + 0.3]} position={[0, 0.45, 0]} />
      </RigidBody>
      <mesh geometry={geo.wall} material={granite} position={[0, 0.3, 0]} castShadow receiveShadow />
      <mesh geometry={geo.lip} material={granite} position={[0, 0.62, 0]} castShadow receiveShadow />
      <mesh material={water} rotation-x={-Math.PI / 2} position={[0, 0.48, 0]} userData={{ noBatch: true }}>
        <circleGeometry args={[FOUNTAIN.r - 0.05, 64]} />
      </mesh>
      <mesh geometry={geo.base} material={granite} position={[0, 0.9, 0]} castShadow />
      <group ref={ring} position={[0, 3.6, 0]} userData={{ noBatch: true }}>
        <mesh material={gold} castShadow>
          <torusGeometry args={[2.2, 0.16, 16, 96]} />
        </mesh>
        <mesh material={gold} rotation-y={Math.PI / 2} rotation-z={0.5} castShadow>
          <torusGeometry args={[2.0, 0.13, 16, 96]} />
        </mesh>
        <mesh material={gold} rotation-x={Math.PI / 2.6}>
          <torusGeometry args={[1.7, 0.1, 12, 80]} />
        </mesh>
      </group>
      <group ref={jets} userData={{ noBatch: true }}>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <mesh key={i} material={jetMat} position={[Math.cos(a) * 3.1, 0.5, Math.sin(a) * 3.1]} rotation={[Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]}>
              <coneGeometry args={[0.08, 2.4, 8, 1, true]} />
            </mesh>
          );
        })}
        <mesh material={jetMat} position={[0, 2.2, 0]}>
          <coneGeometry args={[0.12, 3.6, 10, 1, true]} />
        </mesh>
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ LifeOS tower with enterable lobby
const LOBBY = { w: 10, d: 9, h: 6 };
function Tower({ snapshot }: { snapshot: LifeOSSnapshot }) {
  const glass = useGlass(3, 0.3, "cool", 0xa8bfdc);
  const granite = usePBR("granite");
  const cyan = useMemo(() => glow(0x4fc3ff, 3), []);
  const logo = useMemo(() => new THREE.MeshBasicMaterial({ map: logoTexture(), transparent: true, toneMapped: false }), []);
  const front = TOWER.z + TOWER.d / 2; // z of the front face
  const side = (TOWER.w - LOBBY.w) / 2;
  const geo = useMemo(
    () => ({
      shaft: worldBox(TOWER.w, TOWER.h - LOBBY.h, TOWER.d, FACADE_TILE_M),
      sideBlock: worldBox(side, LOBBY.h, TOWER.d, FACADE_TILE_M),
      backBlock: worldBox(LOBBY.w, LOBBY.h, TOWER.d - LOBBY.d, 24),
      crown: worldBox(TOWER.w * 0.7, 18, TOWER.d * 0.7, FACADE_TILE_M),
      plinth: worldBox(TOWER.w + 6, 0.3, TOWER.d + 10, 3),
      lobbyFloor: worldBox(LOBBY.w, 0.05, LOBBY.d, 2),
    }),
    [side],
  );
  const doorL = useRef<RapierRigidBody>(null);
  const doorR = useRef<RapierRigidBody>(null);
  const open = useProto((s) => s.towerDoorOpen);
  const slide = useRef(0);
  useEffect(() => {
    interactables.set("tower-door", { id: "tower-door", label: "כניסה למגדל LifeOS", x: 0, y: 0, z: front + 1.2, radius: 2.4, onContact: () => useProto.getState().set({ towerDoorOpen: !useProto.getState().towerDoorOpen }) });
    interactables.set("tower-terminal", { id: "tower-terminal", label: "מסוף LifeOS: סקירת החיים שלך", x: 0, y: 0, z: front - LOBBY.d + 2.2, radius: 1.8, onContact: () => useProto.getState().set({ panel: "overview" }) });
    // a crack of light in the lobby: the passage from the real-life layer into AETHERIA
    if (worldAvailable("sanctuary"))
      interactables.set("resonance-crack", {
        id: "resonance-crack",
        label: "סדק של אור: מעבר אל AETHERIA",
        x: 3.2,
        y: 0,
        z: front - 5,
        radius: 1.6,
        onContact: () => void goToWorld("sanctuary", { style: "resonance" }),
      });
    return () => {
      interactables.delete("tower-door");
      interactables.delete("tower-terminal");
      interactables.delete("resonance-crack");
    };
  }, [front]);
  useFrame((_, dt) => {
    slide.current += ((open ? 1 : 0) - slide.current) * (1 - Math.exp(-4 * Math.min(dt, 0.1)));
    const o = slide.current * 1.45;
    doorL.current?.setNextKinematicTranslation({ x: -0.75 - o, y: 1.4, z: front - 0.1 });
    doorR.current?.setNextKinematicTranslation({ x: 0.75 + o, y: 1.4, z: front - 0.1 });
  });
  const doorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x9fc4e0, metalness: 0.6, roughness: 0.05, transparent: true, opacity: 0.45, envMapIntensity: 1.5 }), []);
  const holo = useMemo(
    () => new THREE.MeshBasicMaterial({ map: signTexture({ title: "LifeOS", subtitle: `רמה ${snapshot.profile.level} · ${snapshot.profile.lifeXp.toLocaleString()} Life XP`, accent: "#4fc3ff", footer: snapshot.source === "mock" ? "נתוני דמו" : "נתונים מ־LifeOS" }), transparent: true, toneMapped: false, side: THREE.DoubleSide }),
    [snapshot],
  );
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[TOWER.w / 2, (TOWER.h - LOBBY.h) / 2, TOWER.d / 2]} position={[0, LOBBY.h + (TOWER.h - LOBBY.h) / 2, TOWER.z]} />
        <CuboidCollider args={[side / 2, LOBBY.h / 2, TOWER.d / 2]} position={[-(LOBBY.w / 2 + side / 2), LOBBY.h / 2, TOWER.z]} />
        <CuboidCollider args={[side / 2, LOBBY.h / 2, TOWER.d / 2]} position={[LOBBY.w / 2 + side / 2, LOBBY.h / 2, TOWER.z]} />
        <CuboidCollider args={[LOBBY.w / 2, LOBBY.h / 2, (TOWER.d - LOBBY.d) / 2]} position={[0, LOBBY.h / 2, front - LOBBY.d - (TOWER.d - LOBBY.d) / 2]} />
        {/* glass front beside the doors */}
        <CuboidCollider args={[(LOBBY.w / 2 - 1.5) / 2, LOBBY.h / 2, 0.1]} position={[-(1.5 + (LOBBY.w / 2 - 1.5) / 2), LOBBY.h / 2, front - 0.1]} />
        <CuboidCollider args={[(LOBBY.w / 2 - 1.5) / 2, LOBBY.h / 2, 0.1]} position={[1.5 + (LOBBY.w / 2 - 1.5) / 2, LOBBY.h / 2, front - 0.1]} />
        <CuboidCollider args={[0.5, 0.6, 0.35]} position={[0, 0.6, front - LOBBY.d + 1.2]} />
      </RigidBody>
      <mesh geometry={geo.plinth} material={granite} position={[0, 0.15, TOWER.z + 2]} receiveShadow />
      <mesh geometry={geo.shaft} material={glass} position={[0, LOBBY.h + (TOWER.h - LOBBY.h) / 2, TOWER.z]} castShadow receiveShadow />
      <mesh geometry={geo.sideBlock} material={glass} position={[-(LOBBY.w / 2 + side / 2), LOBBY.h / 2, TOWER.z]} castShadow receiveShadow />
      <mesh geometry={geo.sideBlock} material={glass} position={[LOBBY.w / 2 + side / 2, LOBBY.h / 2, TOWER.z]} castShadow receiveShadow />
      <mesh geometry={geo.backBlock} material={granite} position={[0, LOBBY.h / 2, front - LOBBY.d - (TOWER.d - LOBBY.d) / 2]} receiveShadow />
      <mesh geometry={geo.crown} material={glass} position={[0, TOWER.h + 9, TOWER.z]} castShadow />
      {/* corner light strips */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} material={cyan} position={[sx * (TOWER.w / 2 + 0.05), TOWER.h / 2 + 3, front + 0.05]}>
          <boxGeometry args={[0.25, TOWER.h - 6, 0.25]} />
        </mesh>
      ))}
      <mesh material={cyan} position={[0, LOBBY.h + 0.2, front + 0.4]}>
        <boxGeometry args={[LOBBY.w + 2, 0.25, 0.9]} />
      </mesh>
      {/* logo on the front face, as in the reference */}
      <mesh material={logo} position={[0, TOWER.h - 34, front + 0.08]} userData={{ noBatch: true }}>
        <planeGeometry args={[18, 18]} />
      </mesh>
      {/* lobby */}
      <mesh geometry={geo.lobbyFloor} material={granite} position={[0, 0.03, front - LOBBY.d / 2]} receiveShadow />
      <mesh material={doorMat} position={[-(1.5 + (LOBBY.w / 2 - 1.5) / 2), LOBBY.h / 2, front - 0.1]} userData={{ noBatch: true }}>
        <boxGeometry args={[LOBBY.w / 2 - 1.5, LOBBY.h, 0.06]} />
      </mesh>
      <mesh material={doorMat} position={[1.5 + (LOBBY.w / 2 - 1.5) / 2, LOBBY.h / 2, front - 0.1]} userData={{ noBatch: true }}>
        <boxGeometry args={[LOBBY.w / 2 - 1.5, LOBBY.h, 0.06]} />
      </mesh>
      <group userData={{ noBatch: true }}>
        {[doorL, doorR].map((r, i) => (
          <RigidBody key={i} ref={r} type="kinematicPosition" colliders={false} position={[i ? 0.75 : -0.75, 1.4, front - 0.1]}>
            <CuboidCollider args={[0.75, 1.4, 0.05]} />
            <mesh material={doorMat}>
              <boxGeometry args={[1.5, 2.8, 0.05]} />
            </mesh>
          </RigidBody>
        ))}
      </group>
      {worldAvailable("sanctuary") && <ResonanceCrack x={4.1} z={front - 5} />}
      <group position={[0, 0, front - LOBBY.d + 1.2]} userData={{ noBatch: true }}>
        <mesh material={granite} position={[0, 0.6, 0]}>
          <boxGeometry args={[1, 1.2, 0.7]} />
        </mesh>
        <mesh material={holo} position={[0, 2.4, 0]}>
          <planeGeometry args={[3.2, 1.6]} />
        </mesh>
        <mesh material={cyan} position={[0, 0.02, 1.6]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[1.0, 1.15, 48]} />
        </mesh>
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ district gates
function Gate({ d, snapshot }: { d: DistrictDef; snapshot: LifeOSSnapshot }) {
  const g = gatePos(d);
  const progress = snapshot.domainProgress[d.id];
  const stage = developmentStage(progress);
  const next = snapshot.milestones.find((m) => m.region === d.id && !m.done);
  const pylon = usePBR("granite", { tint: 0x9aa0a8 });
  const accent = useMemo(() => glow(d.color, 1.2 + stage.level * 0.8), [d.color, stage.level]);
  const sign = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: signTexture({ title: d.name, subtitle: d.subtitle, accent: d.accent, progress, footer: `שלב פיתוח: ${stage.label}${next ? ` · הבא: ${next.title}` : ""}` }),
        transparent: true,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    [d, progress, stage, next],
  );
  useEffect(() => {
    const inside = gatePos(d, AVENUE.gateR - 3);
    interactables.set(`gate-${d.id}`, { id: `gate-${d.id}`, label: `${d.name} — מטרות, אבני דרך והתקדמות`, x: inside.x, y: 0, z: inside.z, radius: 3.2, onContact: () => useProto.getState().set({ panel: `district:${d.id}` }) });
    return () => void interactables.delete(`gate-${d.id}`);
  }, [d]);
  const half = AVENUE.w / 2 + 0.6;
  return (
    <group position={[g.x, 0, g.z]} rotation-y={g.yaw}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.6, 4, 0.6]} position={[-half, 4, 0]} />
        <CuboidCollider args={[0.6, 4, 0.6]} position={[half, 4, 0]} />
      </RigidBody>
      {[-half, half].map((x) => (
        <mesh key={x} material={pylon} position={[x, 4, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 8, 1.2]} />
        </mesh>
      ))}
      <mesh material={accent} position={[0, 8.2, 0]}>
        <boxGeometry args={[AVENUE.w + 2.4, 0.35, 0.5]} />
      </mesh>
      {[-half, half].map((x) => (
        <mesh key={`s${x}`} material={accent} position={[x, 4, -0.62]}>
          <boxGeometry args={[0.12, 7, 0.04]} />
        </mesh>
      ))}
      {/* sign faces the plaza (local -Z) */}
      <mesh material={sign} position={[0, 6.6, -0.1]} rotation-y={Math.PI} userData={{ noBatch: true }}>
        <planeGeometry args={[6, 3]} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ buildings: plaza ring, avenue fronts, skyline
interface Blk {
  x: number;
  z: number;
  yaw: number;
  w: number;
  d: number;
  h: number;
  kind: "plaster" | "brick" | "glass";
  seed: number;
  accent?: number;
}

function cityBlocks() {
  const r = rng(29);
  const out: Blk[] = [];
  const bearings = DISTRICTS.map((d) => d.bearing).sort((a, b) => a - b);
  const R = PLAZA.r + 6.5; // facade line + half depth
  const depth = 11;
  const openHalf = (bearing: number) => (bearing === 0 ? 14 : AVENUE.w / 2 + 1.5); // metres either side
  const gaps: [number, number][] = [];
  const all = [...bearings, 0].sort((a, b) => a - b);
  for (let i = 0; i < all.length; i++) gaps.push([all[i], all[(i + 1) % all.length] + (i === all.length - 1 ? 360 : 0)]);
  for (const [a0, a1] of gaps) {
    const start = a0 + (openHalf(a0) / (R - depth / 2)) * (180 / Math.PI);
    const end = a1 - (openHalf(((a1 + 180) % 360) - 180) / (R - depth / 2)) * (180 / Math.PI);
    const span = end - start;
    if (span <= 2) continue;
    const n = Math.max(1, Math.round(span / 16));
    for (let k = 0; k < n; k++) {
      const b0 = start + (span * k) / n;
      const b1 = start + (span * (k + 1)) / n;
      const mid = (b0 + b1) / 2;
      const v = dirOf(mid);
      const chord = 2 * (R - depth / 2) * Math.sin(deg((b1 - b0) / 2)) + 0.6;
      const kind = (["plaster", "brick", "glass"] as const)[Math.floor(r() * 3)];
      out.push({ x: v.x * R, z: v.z * R, yaw: Math.atan2(v.x, v.z), w: chord, d: depth, h: kind === "glass" ? 20 + r() * 14 : 11 + Math.floor(r() * 3) * 3.5, kind, seed: 40 + out.length });
    }
  }
  // avenue frontage: district-tinted buildings on both sides, beyond the gate
  for (const d of DISTRICTS) {
    const v = dirOf(d.bearing);
    const nx = v.z;
    const nz = -v.x;
    for (const side of [-1, 1])
      for (let along = AVENUE.gateR + 6; along < AVENUE.endR + 4; along += 12) {
        const off = side * (AVENUE.w / 2 + 6);
        out.push({ x: v.x * along + nx * off, z: v.z * along + nz * off, yaw: Math.atan2(v.x, v.z), w: 11, d: 10, h: 18 + r() * 30, kind: "glass", seed: 80 + out.length, accent: d.color });
      }
    // district landmark at the avenue end
    out.push({ x: v.x * (AVENUE.endR + 9), z: v.z * (AVENUE.endR + 9), yaw: Math.atan2(v.x, v.z), w: 16, d: 14, h: 60 + r() * 30, kind: "glass", seed: 120 + out.length, accent: d.color });
  }
  return out;
}

function skyline() {
  const r = rng(77);
  const out: Blk[] = [];
  for (let i = 0; i < 110; i++) {
    const a = r() * 360;
    const rad = 75 + r() * 110;
    if (Math.abs(((a + 540) % 360) - 180) < 8 && rad < 90) continue; // keep the tower axis readable
    const v = dirOf(a);
    out.push({ x: v.x * rad, z: v.z * rad, yaw: deg(r() * 90), w: 12 + r() * 16, d: 12 + r() * 16, h: 35 + r() * r() * 150, kind: "glass", seed: 200 + (i % 6) });
  }
  return out;
}

function Buildings({ quality }: { quality: Quality }) {
  const plaster = usePBR("plaster", { tint: 0xe7dccb });
  const brick = usePBR("brick", { tint: 0xd0c0b0 });
  const granite = usePBR("granite");
  const glassA = useGlass(11, 0.25, "warm");
  const glassB = useGlass(12, 0.18, "cool", 0x9fb2c9);
  const plasterWin = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x1b2430, emissive: 0xffd29a, emissiveMap: windowTexture(5, 0.35), emissiveIntensity: 1.1, roughness: 0.15, metalness: 0.5 }), []);
  const blocks = useMemo(cityBlocks, []);
  const sky = useMemo(skyline, []);
  const accents = useMemo(() => new Map(DISTRICTS.map((d) => [d.color, glow(d.color, 2.2)])), []);
  const geos = useMemo(() => blocks.map((b) => worldBox(b.w, b.h, b.d, b.kind === "glass" ? FACADE_TILE_M : b.kind === "brick" ? 2.5 : 3)), [blocks]);
  const skyGeos = useMemo(() => sky.map((b) => worldBox(b.w, b.h, b.d, FACADE_TILE_M)), [sky]);
  const shopGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {blocks.map((b, i) => (
          <CuboidCollider key={i} args={[b.w / 2, b.h / 2, b.d / 2]} position={[b.x, b.h / 2, b.z]} rotation={[0, b.yaw, 0]} />
        ))}
        {/* avenue end walls (districts continue in the next phase) */}
        {DISTRICTS.map((d) => {
          const g = gatePos(d, AVENUE.endR);
          return <CuboidCollider key={d.id} args={[AVENUE.w / 2 + 2, 3, 0.5]} position={[g.x, 3, g.z]} rotation={[0, g.yaw, 0]} />;
        })}
        {/* forecourt side walls toward the tower */}
        <CuboidCollider args={[0.5, 3, 11]} position={[-13.5, 3, -(PLAZA.r + 9)]} />
        <CuboidCollider args={[0.5, 3, 11]} position={[13.5, 3, -(PLAZA.r + 9)]} />
      </RigidBody>
      {blocks.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation-y={b.yaw}>
          <mesh geometry={geos[i]} material={b.kind === "glass" ? (i % 2 ? glassA : glassB) : b.kind === "brick" ? brick : plaster} position={[0, b.h / 2, 0]} castShadow receiveShadow />
          {b.kind !== "glass" && (
            <mesh material={plasterWin} position={[0, b.h / 2 + 1.5, -b.d / 2 - 0.02]} rotation-y={Math.PI}>
              <planeGeometry args={[b.w * 0.85, b.h - 5]} />
            </mesh>
          )}
          {/* ground-floor shopfront strip facing the street (local -Z faces the plaza/avenue) */}
          <mesh geometry={shopGeo} material={accents.get(b.accent ?? 0) ?? plasterWin} position={[0, 3.6, -b.d / 2 - 0.15]} scale={[b.w * 0.92, 0.25, 0.3]} />
          <mesh material={granite} position={[0, b.h + 0.2, 0]}>
            <boxGeometry args={[b.w + 0.4, 0.4, b.d + 0.4]} />
          </mesh>
          {b.accent !== undefined && (
            <mesh material={accents.get(b.accent)} position={[0, b.h - 1, -b.d / 2 - 0.05]}>
              <boxGeometry args={[b.w * 0.8, 0.4, 0.1]} />
            </mesh>
          )}
        </group>
      ))}
      {quality !== "low" &&
        sky.map((b, i) => (
          <mesh key={`k${i}`} geometry={skyGeos[i]} material={i % 2 ? glassA : glassB} position={[b.x, b.h / 2, b.z]} rotation-y={b.yaw} />
        ))}
    </group>
  );
}

// ------------------------------------------------------------------ monorail (decorative, animated)
function Monorail() {
  const metal = usePBR("metal", { tint: 0xb7bcc4, noColor: true, metalness: 0.8, roughness: 0.5 });
  const R = 44;
  const H = 14;
  const track = useMemo(() => {
    const pts = Array.from({ length: 64 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * R, H, Math.sin(a) * R);
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.7, 8, true);
  }, []);
  const pillars = useMemo(() => {
    const avoid = DISTRICTS.map((d) => d.bearing);
    return Array.from({ length: 16 }, (_, i) => (i / 16) * 360 - 180).filter((b) => avoid.every((a) => Math.abs(((b - a + 540) % 360) - 180) > 12) && Math.abs(b) > 16);
  }, []);
  const train = useRef<THREE.Group>(null);
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xe8eef5, metalness: 0.5, roughness: 0.25, emissive: 0x4fc3ff, emissiveMap: windowTexture(9, 0.9, "cool"), emissiveIntensity: 1.2 }), []);
  useFrame((_, dt) => {
    if (train.current) train.current.rotation.y += Math.min(dt, 0.1) * 0.12;
  });
  return (
    <group>
      <mesh geometry={track} material={metal} castShadow />
      {pillars.map((b) => {
        const v = dirOf(b);
        return (
          <mesh key={b} material={metal} position={[v.x * R, H / 2, v.z * R]}>
            <cylinderGeometry args={[0.6, 0.8, H, 12]} />
          </mesh>
        );
      })}
      <group ref={train} userData={{ noBatch: true }}>
        {[0, 1, 2].map((k) => {
          const a = -k * 0.12;
          return (
            <mesh key={k} material={body} position={[Math.cos(a) * R, H + 1.3, Math.sin(a) * R]} rotation-y={-a} castShadow>
              <boxGeometry args={[2.4, 2.2, 9]} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ street furniture + kiosk
function Furniture() {
  const wood = usePBR("wood");
  const metal = usePBR("metal", { tint: 0x2c3036, noColor: true, metalness: 0.7, roughness: 0.6 });
  const lamp = useMemo(() => glow(0xfff1d6, 3), []);
  const slat = useMemo(() => worldBox(1.9, 0.05, 0.12, 1), []);
  const benches = useMemo(() => [20, 80, 140, 200, 260, 320].map((b) => ({ ...dirOf(b), b })), []);
  const lights = useMemo(() => {
    const avoid = DISTRICTS.map((d) => d.bearing).concat([0]);
    return Array.from({ length: 18 }, (_, i) => (i / 18) * 360 + 10).filter((b) => avoid.every((a) => Math.abs(((b - a + 540) % 360) - 180) > 9));
  }, []);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {benches.map((p) => (
          <CuboidCollider key={p.b} args={[1, 0.45, 0.35]} position={[p.x * 10.5, 0.45, p.z * 10.5]} rotation={[0, Math.atan2(p.x, p.z), 0]} />
        ))}
        {lights.map((b) => {
          const v = dirOf(b);
          return <CylinderCollider key={b} args={[2.5, 0.15]} position={[v.x * 22.5, 2.5, v.z * 22.5]} />;
        })}
      </RigidBody>
      {benches.map((p) => (
        <group key={p.b} position={[p.x * 10.5, 0, p.z * 10.5]} rotation-y={Math.atan2(p.x, p.z)}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} geometry={slat} material={wood} position={[0, 0.46, -0.2 + i * 0.13]} castShadow receiveShadow />
          ))}
          {[0, 1].map((i) => (
            <mesh key={`b${i}`} geometry={slat} material={wood} position={[0, 0.64 + i * 0.15, 0.3]} rotation-x={0.22} castShadow />
          ))}
          {[-0.8, 0.8].map((x) => (
            <mesh key={x} material={metal} position={[x, 0.4, 0.02]} castShadow>
              <boxGeometry args={[0.07, 0.8, 0.6]} />
            </mesh>
          ))}
        </group>
      ))}
      {lights.map((b) => {
        const v = dirOf(b);
        return (
          <group key={b} position={[v.x * 22.5, 0, v.z * 22.5]}>
            <mesh material={metal} position={[0, 2.6, 0]} castShadow>
              <cylinderGeometry args={[0.07, 0.11, 5.2, 10]} />
            </mesh>
            <mesh material={lamp} position={[0, 5.25, 0]}>
              <cylinderGeometry args={[0.32, 0.18, 0.18, 16]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Kiosk() {
  const metal = usePBR("metal", { tint: 0x3a4450, noColor: true, metalness: 0.7, roughness: 0.5 });
  const screen = useMemo(() => glow(0x3fb6ff, 1.6), []);
  const p = dirOf(200);
  const x = p.x * 15;
  const z = p.z * 15;
  const yaw = Math.atan2(-p.x, -p.z); // faces the fountain
  useEffect(() => {
    interactables.set("kiosk", { id: "kiosk", label: "מסוף LifeOS (דמו): שלח אירוע מאומת לדוגמה", x: x - p.x * 0.8, y: 0, z: z - p.z * 0.8, radius: 1.5, onContact: () => emitMockEvent() });
    return () => void interactables.delete("kiosk");
  }, [x, z, p.x, p.z]);
  return (
    <group position={[x, 0, z]} rotation-y={yaw}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.4, 0.9, 0.25]} position={[0, 0.9, 0]} />
      </RigidBody>
      <mesh material={metal} position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.8, 1.8, 0.5]} />
      </mesh>
      <mesh material={screen} position={[0, 1.35, 0.26]} rotation-x={-0.1}>
        <planeGeometry args={[0.6, 0.42]} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ scene
export function CityScene({ quality, snapshot }: { quality: Quality; snapshot: LifeOSSnapshot }) {
  const trees = useMemo(() => [50, 110, 170, 230, 290, 350, -15, 15].map((b, i) => ({ ...dirOf(b), i })), []);
  return (
    <group>
      <Batched>
        <Ground />
        <Buildings quality={quality} />
        <Furniture />
        <Fountain />
        <Tower snapshot={snapshot} />
        <Monorail />
        {DEMO_EVENTS && <Kiosk />}
        {DISTRICTS.map((d) => (
          <Gate key={d.id} d={d} snapshot={snapshot} />
        ))}
      </Batched>
      {trees.map((t) => (
        <Tree key={t.i} x={t.x * (t.i >= 6 ? 20 : 17)} z={t.z * (t.i >= 6 ? 20 : 17)} seed={t.i + 21} height={6.5 + (t.i % 3)} shadows={quality !== "low"} />
      ))}
    </group>
  );
}
