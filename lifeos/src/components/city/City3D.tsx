"use client";
/**
 * Phase-1 city prototype (third-person). Read-only: renders the city, an avatar that walks it and
 * the Hall of Knowledge at a tier derived from Life XP. Instancing keeps draw calls low (houses,
 * roofs, trees, lamps are one draw call each); quality tiers come from the shared Atmosphere layer.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { cityLayout, hallCollider, HALL, PLAZA, resolve, SPAWN, STREET, CITY_BOUNDS, type CityLayout, type Prop } from "@/game-core/world/city";
import { HERO_BY_ID } from "@/lib/arena/heroes";
import type { HeroDef } from "@/lib/arena/types";
import { HeroAvatar, type Motion } from "@/components/arena/HeroGLB";
import type { HeroRig } from "@/components/arena/HeroModel";
import { initialQuality, pinnedQuality, PostFX, QualityGovernor, RendererTone, SceneLighting, type Quality } from "@/components/visual/Atmosphere";

export interface Controls {
  /** Movement relative to the camera: x = right, z = forward. */
  move: { x: number; z: number };
  /** Camera yaw change requested by drag / keys (radians, consumed each frame). */
  yawDelta: number;
}
export interface BenchStats {
  fps: number;
  p95ms: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  heapMB: number | null;
  renderer: string;
  quality: Quality;
  dpr: number;
}
export interface AvatarInfo {
  x: number;
  z: number;
  nearHall: boolean;
}

const PALETTE = [0xe9dcc4, 0xd8c3a5, 0xc9b79c, 0xe6d2b5, 0xbfae97, 0xdccbb0];
const ROOFS = [0x9c4a3a, 0x7a3b2e, 0x5b6b7a, 0x6e5a48, 0x8a5a3c];

function useInstances(count: number, set: (m: THREE.Matrix4, c: THREE.Color, i: number) => void, deps: unknown[]) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      set(m, c, i);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt?.(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

const compose = (m: THREE.Matrix4, p: [number, number, number], s: [number, number, number], ry = 0) => m.compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(...s));

function Ground() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#b9b0a0";
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = "rgba(60,50,40,0.22)";
    g.lineWidth = 2;
    for (let i = 0; i <= 128; i += 32) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, 128);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(128, i);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
  const streetTex = useMemo(() => {
    const t = tex.clone();
    t.repeat.set(STREET.w / 2, (STREET.z1 - STREET.z0) / 2);
    t.needsUpdate = true;
    return t;
  }, [tex]);
  const plazaTex = useMemo(() => {
    const t = tex.clone();
    t.repeat.set(PLAZA.r, PLAZA.r);
    t.needsUpdate = true;
    return t;
  }, [tex]);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[CITY_BOUNDS.maxX - CITY_BOUNDS.minX + 60, CITY_BOUNDS.maxZ - CITY_BOUNDS.minZ + 60]} />
        <meshStandardMaterial color="#6f8f4e" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[STREET.x, 0.01, (STREET.z0 + STREET.z1) / 2]} receiveShadow>
        <planeGeometry args={[STREET.w, STREET.z1 - STREET.z0]} />
        <meshStandardMaterial map={streetTex} roughness={0.9} />
      </mesh>
      {/* curbs */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (STREET.w / 2 + 0.15), 0.08, (STREET.z0 + STREET.z1) / 2]} receiveShadow castShadow>
          <boxGeometry args={[0.3, 0.16, STREET.z1 - STREET.z0]} />
          <meshStandardMaterial color="#d8d2c4" roughness={0.8} />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]} receiveShadow>
        <circleGeometry args={[PLAZA.r, 64]} />
        <meshStandardMaterial map={plazaTex} roughness={0.85} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.014, 0]}>
        <ringGeometry args={[PLAZA.r - 0.35, PLAZA.r, 64]} />
        <meshStandardMaterial color="#e2dccd" roughness={0.7} />
      </mesh>
      {/* path to the hall */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.011, HALL.z / 2]} receiveShadow>
        <planeGeometry args={[5, Math.abs(HALL.z) - 2]} />
        <meshStandardMaterial map={streetTex} roughness={0.9} />
      </mesh>
    </group>
  );
}

function Fountain() {
  const water = useRef<THREE.Mesh>(null);
  const jet = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (water.current) water.current.position.y = 0.55 + Math.sin(t * 2) * 0.02;
    if (jet.current) jet.current.scale.y = 1 + Math.sin(t * 6) * 0.08;
  });
  return (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.8, 3, 0.6, 32]} />
        <meshStandardMaterial color="#d9d3c7" roughness={0.6} />
      </mesh>
      <mesh ref={water} position={[0, 0.55, 0]}>
        <cylinderGeometry args={[2.55, 2.55, 0.08, 32]} />
        <meshPhysicalMaterial color="#5fb6d6" roughness={0.08} clearcoat={1} transmission={0} metalness={0.1} />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.55, 1.2, 16]} />
        <meshStandardMaterial color="#cfc8ba" roughness={0.5} />
      </mesh>
      <mesh ref={jet} position={[0, 2.1, 0]}>
        <cylinderGeometry args={[0.06, 0.18, 1.2, 10]} />
        <meshStandardMaterial color="#bfe8f5" transparent opacity={0.7} emissive="#7fd3e6" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function Town({ layout }: { layout: CityLayout }) {
  const n = layout.houses.length;
  const bodies = useInstances(n, (m, c, i) => {
    const h = layout.houses[i];
    compose(m, [h.x, h.h / 2, h.z], [h.w, h.h, h.d]);
    c.set(PALETTE[h.color]);
  }, [layout]);
  const roofs = useInstances(n, (m, c, i) => {
    const h = layout.houses[i];
    compose(m, [h.x, h.h + 1.1, h.z], [h.w * 0.75, 2.2, h.d * 0.75], Math.PI / 4);
    c.set(ROOFS[h.roof]);
  }, [layout]);
  // warm windows (emissive → bloom), 2 per street-facing side
  const winCount = n * 2;
  const windows = useInstances(winCount, (m, c, i) => {
    const h = layout.houses[Math.floor(i / 2)];
    const toward = h.x > 0 ? -1 : 1;
    const z = h.z + (i % 2 ? 1.4 : -1.4);
    const facePlaza = Math.abs(h.z) < 10 && Math.abs(h.x) > 12;
    compose(m, [h.x + toward * (h.w / 2 + 0.02), Math.min(h.h - 1, 2.6), facePlaza ? z : z], [0.05, 1.1, 0.9]);
    c.set("#ffd68a");
  }, [layout]);
  const tc = layout.trees.length;
  const trunks = useInstances(tc, (m, c, i) => {
    const t = layout.trees[i];
    compose(m, [t.x, 0.7 * t.s, t.z], [t.s, t.s, t.s]);
    c.set("#6b4a2f");
  }, [layout]);
  const crowns = useInstances(tc, (m, c, i) => {
    const t = layout.trees[i];
    compose(m, [t.x, 2.2 * t.s, t.z], [t.s, t.s, t.s], i);
    c.setHSL(0.28 + ((i * 37) % 10) / 200, 0.45, 0.32 + ((i * 13) % 10) / 100);
  }, [layout]);
  const lc = layout.lamps.length;
  const poles = useInstances(lc, (m, c, i) => {
    const l = layout.lamps[i];
    compose(m, [l.x, 1.6, l.z], [1, 1, 1]);
    c.set("#2e3138");
  }, [layout]);
  const bulbs = useInstances(lc, (m, c, i) => {
    const l = layout.lamps[i];
    compose(m, [l.x, 3.25, l.z], [1, 1, 1]);
    c.set("#ffe2a0");
  }, [layout]);
  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, n]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={roofs} args={[undefined, undefined, n]} castShadow>
        <coneGeometry args={[1, 1, 4]} />
        <meshStandardMaterial roughness={0.7} flatShading />
      </instancedMesh>
      <instancedMesh ref={windows} args={[undefined, undefined, winCount]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial emissive="#ffc46b" emissiveIntensity={0.9} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, tc]} castShadow>
        <cylinderGeometry args={[0.14, 0.2, 1.4, 6]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, tc]} castShadow>
        <icosahedronGeometry args={[1.1, 0]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={poles} args={[undefined, undefined, lc]} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 3.2, 6]} />
        <meshStandardMaterial roughness={0.5} metalness={0.6} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, lc]}>
        <sphereGeometry args={[0.2, 10, 8]} />
        <meshStandardMaterial emissive="#ffd68a" emissiveIntensity={2.2} toneMapped={false} />
      </instancedMesh>
      {layout.benches.map((b: Prop, i) => (
        <mesh key={i} position={[b.x, 0.35, b.z]} rotation-y={-b.s} castShadow>
          <boxGeometry args={[2, 0.12, 0.6]} />
          <meshStandardMaterial color="#7a5636" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** The upgradable building. `ghost` = future preview (translucent, clearly not real). */
function Hall({ tier, ghost }: { tier: number; ghost: boolean }) {
  const stone = ghost ? { color: "#bfe1ff", transparent: true, opacity: 0.28, depthWrite: false } : { color: "#e7dfcf", roughness: 0.7 };
  const roof = ghost ? stone : { color: "#3e5f8a", roughness: 0.5, metalness: 0.2 };
  const glow = ghost ? stone : { emissive: "#ffcf7a", emissiveIntensity: 1.1, color: "#5a4a30" };
  const t = HALL.tiers[tier];
  const front = t.d / 2;
  return (
    <group position={[HALL.x, 0, HALL.z - (t.d - 6) / 2]}>
      {tier === 0 && (
        <group>
          <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
            <boxGeometry args={[t.w, 0.3, t.d]} />
            <meshStandardMaterial {...(ghost ? stone : { color: "#9a9284", roughness: 1 })} />
          </mesh>
          {[-3.6, 0, 3.6].map((x) =>
            [-2.6, 2.6].map((z) => (
              <mesh key={`${x}${z}`} position={[x, 2, z]} castShadow>
                <boxGeometry args={[0.15, 4, 0.15]} />
                <meshStandardMaterial {...(ghost ? stone : { color: "#c08a3e" })} />
              </mesh>
            )),
          )}
          {[1.4, 2.8].map((y) => (
            <mesh key={y} position={[0, y, front - 0.2]} castShadow>
              <boxGeometry args={[t.w, 0.12, 0.6]} />
              <meshStandardMaterial {...(ghost ? stone : { color: "#a8763a" })} />
            </mesh>
          ))}
          <mesh position={[3, 0.6, front + 1]} rotation-y={-0.4} castShadow>
            <boxGeometry args={[1.2, 1.2, 1.2]} />
            <meshStandardMaterial {...(ghost ? stone : { color: "#8e7d62" })} />
          </mesh>
        </group>
      )}
      {tier >= 1 && (
        <group>
          {/* steps */}
          <mesh position={[0, 0.2, front + 0.6]} receiveShadow castShadow>
            <boxGeometry args={[t.w * 0.6, 0.4, 1.4]} />
            <meshStandardMaterial {...stone} />
          </mesh>
          <mesh position={[0, tier === 1 ? 2 : tier === 2 ? 3 : 3.6, 0]} castShadow receiveShadow>
            <boxGeometry args={[t.w, tier === 1 ? 4 : tier === 2 ? 6 : 7.2, t.d]} />
            <meshStandardMaterial {...stone} />
          </mesh>
          {/* windows */}
          {Array.from({ length: tier === 1 ? 2 : 4 }).map((_, i, a) => (
            <mesh key={i} position={[(i - (a.length - 1) / 2) * (t.w / a.length), tier === 1 ? 2.2 : 3.4, front + 0.02]}>
              <boxGeometry args={[1, tier === 1 ? 1.4 : 2.2, 0.06]} />
              <meshStandardMaterial {...glow} />
            </mesh>
          ))}
          <mesh position={[0, 1.1, front + 0.03]}>
            <boxGeometry args={[1.4, 2.2, 0.06]} />
            <meshStandardMaterial {...(ghost ? stone : { color: "#5a3b22" })} />
          </mesh>
          {tier === 1 && (
            <mesh position={[0, 5, 0]} rotation-y={Math.PI / 4} castShadow>
              <coneGeometry args={[t.w * 0.72, 2.2, 4]} />
              <meshStandardMaterial {...roof} flatShading />
            </mesh>
          )}
          {tier >= 2 && (
            <group>
              {/* portico columns + pediment */}
              {Array.from({ length: 6 }).map((_, i) => (
                <mesh key={i} position={[(i - 2.5) * (t.w / 6.5), (tier === 2 ? 6 : 7.2) / 2, front + 1.3]} castShadow>
                  <cylinderGeometry args={[0.32, 0.36, tier === 2 ? 6 : 7.2, 14]} />
                  <meshStandardMaterial {...stone} />
                </mesh>
              ))}
              <mesh position={[0, (tier === 2 ? 6 : 7.2) + 0.25, front + 0.6]} castShadow>
                <boxGeometry args={[t.w + 0.4, 0.5, 2.2]} />
                <meshStandardMaterial {...stone} />
              </mesh>
              <mesh position={[0, (tier === 2 ? 6 : 7.2) + 1.1, front + 0.6]} rotation-x={Math.PI / 2} rotation-z={Math.PI}>
                <cylinderGeometry args={[t.w / 2, t.w / 2, 2, 3, 1, false, 0, Math.PI]} />
                <meshStandardMaterial {...roof} />
              </mesh>
            </group>
          )}
          {tier === 3 && (
            <group>
              <mesh position={[0, 8.8, -1]} castShadow>
                <sphereGeometry args={[3.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial {...(ghost ? stone : { color: "#d4a73c", metalness: 0.8, roughness: 0.25 })} />
              </mesh>
              <mesh position={[0, 12.7, -1]}>
                <sphereGeometry args={[0.35, 16, 12]} />
                <meshStandardMaterial {...(ghost ? stone : { emissive: "#fff1b8", emissiveIntensity: 2.5, toneMapped: false })} />
              </mesh>
              {[-1, 1].map((s) => (
                <group key={s} position={[s * (t.w / 2 + 0.6), 0, -t.d / 2 + 1.6]}>
                  <mesh position={[0, 5.5, 0]} castShadow>
                    <cylinderGeometry args={[1.1, 1.3, 11, 12]} />
                    <meshStandardMaterial {...stone} />
                  </mesh>
                  <mesh position={[0, 12, 0]} castShadow>
                    <coneGeometry args={[1.4, 2.4, 12]} />
                    <meshStandardMaterial {...roof} />
                  </mesh>
                </group>
              ))}
            </group>
          )}
        </group>
      )}
    </group>
  );
}

function playerDef(): HeroDef {
  const base = HERO_BY_ID.vita;
  return { ...base, id: "player", name: "אתה", look: { body: "#2f4f7e", trim: "#d4a73c", glow: "#9fd8ff", weapon: "orb" } };
}

function Avatar({ controls, colliders, onInfo }: { controls: React.MutableRefObject<Controls>; colliders: ReturnType<typeof cityLayout>["colliders"]; onInfo: (a: AvatarInfo) => void }) {
  const group = useRef<THREE.Group>(null);
  const rig = useRef<HeroRig>(null);
  const motion = useRef<Motion>({ speed: 0, casting: false });
  const pos = useRef({ x: SPAWN.x, z: SPAWN.z });
  const facing = useRef(SPAWN.facing);
  const yaw = useRef(0); // camera yaw (0 = camera south of the avatar, looking north)
  const lastInfo = useRef(0);
  const def = useMemo(playerDef, []);
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3(SPAWN.x, 1.4, SPAWN.z));
  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(0.1, dtRaw); // real-time movement down to ~10 fps
    const c = controls.current;
    yaw.current += c.yawDelta;
    c.yawDelta = 0;
    // camera-relative movement
    const fwd = { x: -Math.sin(yaw.current), z: -Math.cos(yaw.current) };
    const right = { x: -fwd.z, z: fwd.x };
    let vx = fwd.x * c.move.z + right.x * c.move.x;
    let vz = fwd.z * c.move.z + right.z * c.move.x;
    const len = Math.hypot(vx, vz);
    if (len > 1) {
      vx /= len;
      vz /= len;
    }
    const speed = 5.2 * Math.min(1, len);
    const next = resolve({ x: pos.current.x + vx * 5.2 * dt, z: pos.current.z + vz * 5.2 * dt }, 0.45, colliders);
    pos.current = next;
    if (len > 0.05) {
      const want = Math.atan2(vx, vz);
      facing.current += Math.atan2(Math.sin(want - facing.current), Math.cos(want - facing.current)) * Math.min(1, dt * 12);
    }
    motion.current = { speed, casting: false };
    const g = group.current;
    if (g) {
      g.position.set(next.x, 0, next.z);
      g.rotation.y = facing.current;
    }
    // procedural walk cycle (GLB avatars animate themselves)
    const r = rig.current;
    if (r && !r.glb) {
      const t = clock.elapsedTime * (6 + speed * 1.3);
      const swing = Math.min(1, speed / 4) * 0.7;
      if (r.legL) r.legL.rotation.x = Math.sin(t) * swing;
      if (r.legR) r.legR.rotation.x = -Math.sin(t) * swing;
      if (r.armL) r.armL.rotation.x = -Math.sin(t) * swing * 0.6;
      if (r.armR) r.armR.rotation.x = Math.sin(t) * swing * 0.6;
      if (r.body) r.body.position.y = Math.abs(Math.sin(t)) * swing * 0.08 + Math.sin(clock.elapsedTime * 2) * 0.015;
    }
    // third-person camera: smooth follow, a bit farther on portrait screens
    const portrait = size.width < size.height;
    const dist = portrait ? 11 : 9;
    const height = portrait ? 7.5 : 5.5;
    target.current.lerp(new THREE.Vector3(next.x, 1.4, next.z), 1 - Math.exp(-dt * 10));
    const camPos = new THREE.Vector3(target.current.x + Math.sin(yaw.current) * dist, height, target.current.z + Math.cos(yaw.current) * dist);
    camera.position.lerp(camPos, 1 - Math.exp(-dt * 8));
    camera.lookAt(target.current.x, 1.6, target.current.z);
    if (clock.elapsedTime - lastInfo.current > 0.2) {
      lastInfo.current = clock.elapsedTime;
      const hallFront = HALL.z + 3;
      onInfo({ x: next.x, z: next.z, nearHall: Math.abs(next.x - HALL.x) < 8 && next.z - hallFront < 7 && next.z > hallFront - 2 });
    }
  });
  return (
    <group ref={group} position={[SPAWN.x, 0, SPAWN.z]}>
      <HeroAvatar ref={rig} def={def} teamColor="#d4a73c" motion={motion} />
    </group>
  );
}

function Bench({ quality, onStats }: { quality: Quality; onStats: (s: BenchStats) => void }) {
  const { gl } = useThree();
  const times = useRef<number[]>([]);
  const last = useRef(0);
  const renderer = useMemo(() => {
    const ctx = gl.getContext();
    const ext = ctx.getExtension("WEBGL_debug_renderer_info");
    return String(ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER));
  }, [gl]);
  useFrame(({ clock }, dt) => {
    times.current.push(dt * 1000);
    if (times.current.length > 240) times.current.shift();
    if (clock.elapsedTime - last.current < 0.5) return;
    last.current = clock.elapsedTime;
    const sorted = times.current.slice().sort((a, b) => a - b);
    const avg = sorted.reduce((s, x) => s + x, 0) / Math.max(1, sorted.length);
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    onStats({
      fps: Math.round(1000 / Math.max(1, avg)),
      p95ms: Math.round(sorted[Math.floor(sorted.length * 0.95)] ?? 0),
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
      renderer,
      quality,
      dpr: gl.getPixelRatio(),
    });
  });
  return null;
}

export default function City3D({ hallTier, previewTier, controls, onInfo, onStats }: { hallTier: number; previewTier: number | null; controls: React.MutableRefObject<Controls>; onInfo: (a: AvatarInfo) => void; onStats?: (s: BenchStats) => void }) {
  const layout = useMemo(() => cityLayout(), []);
  const [quality, setQuality] = useState<Quality>(() => initialQuality());
  const shown = previewTier ?? hallTier;
  const colliders = useMemo(() => [...layout.colliders, hallCollider(hallTier)], [layout, hallTier]);
  const low = quality === "low";
  return (
    <div className="h-full w-full" data-quality={quality} data-hall-tier={shown}>
      <Canvas
        shadows={low ? false : { type: THREE.PCFShadowMap }}
        dpr={low ? 1 : quality === "medium" ? [1, 1.5] : [1, 2]}
        camera={{ fov: 50, position: [SPAWN.x, 6, SPAWN.z + 9], near: 0.3, far: 220 }}
        gl={{ antialias: low, powerPreference: "high-performance" }}
        data-testid="city-canvas"
      >
        <color attach="background" args={["#a7c7e0"]} />
        <fog attach="fog" args={["#b9d2e3", 45, 120]} />
        <hemisphereLight args={["#fff4e0", "#4f6a3a", low ? 0.95 : 0.7]} />
        {!low && <SceneLighting warm="#ffe0b0" cool="#a8d0ff" />}
        <directionalLight
          position={[25, 35, 18]}
          intensity={1.8}
          color="#fff0d6"
          castShadow={!low}
          shadow-mapSize={quality === "high" ? [2048, 2048] : [1024, 1024]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.03}
          shadow-camera-left={-45}
          shadow-camera-right={45}
          shadow-camera-top={55}
          shadow-camera-bottom={-45}
        />
        <Ground />
        <Fountain />
        <Town layout={layout} />
        <Hall tier={shown} ghost={previewTier != null && previewTier > hallTier} />
        <Avatar controls={controls} colliders={colliders} onInfo={onInfo} />
        <RendererTone quality={quality} exposure={1.05} />
        <PostFX quality={quality} bloom={0.8} />
        <QualityGovernor quality={quality} onChange={(q) => !pinnedQuality() && setQuality(q)} />
        {onStats && <Bench quality={quality} onStats={onStats} />}
      </Canvas>
    </div>
  );
}
