"use client";
/**
 * The 3D world. Procedural low-poly islands built from primitives (no external assets → fast,
 * offline, small bundle). Each island has 5 landmark stages; built landmarks are solid, the next
 * one shows as a translucent "future" silhouette. Newly built landmarks rise with an animation.
 */
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Sky, Sparkles } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { RegionId } from "@/lib/types";
import { REGIONS, REGION_BY_ID, type RegionDef } from "@/lib/game/regions";
import type { RegionState } from "@/lib/game/engine";
import { initialQuality, pinnedQuality, PostFX, QualityGovernor, RendererTone, SceneLighting, type Quality } from "@/components/visual/Atmosphere";

const RING = 15;

export interface World3DProps {
  regions: Record<RegionId, RegionState>;
  level: number;
  decorations: string[];
  selected: RegionId | null;
  onSelect: (id: RegionId | null) => void;
  onBuilding: (id: RegionId, stage: number) => void;
  lowPower: boolean;
}

export function regionPosition(r: RegionDef): [number, number, number] {
  return [Math.sin(r.angle) * RING, 0, Math.cos(r.angle) * RING];
}

export default function World3D(props: World3DProps) {
  const [quality, setQuality] = useState<Quality>(() => (props.lowPower && !pinnedQuality() ? "low" : initialQuality()));
  useEffect(() => {
    if (props.lowPower && !pinnedQuality()) setQuality("low");
  }, [props.lowPower]);
  const lowPower = quality === "low";
  const labels = useRef<Partial<Record<RegionId, HTMLButtonElement | null>>>({});
  return (
    <div className="relative h-full w-full" data-quality={quality}>
    <Canvas
      shadows={lowPower ? false : { type: THREE.PCFShadowMap }}
      dpr={lowPower ? [1, 1.5] : [1, 2]}
      camera={{ position: [0, 30, 38], fov: 42, near: 0.5, far: 400 }}
      gl={{ antialias: !lowPower, powerPreference: "high-performance" }}
      onPointerMissed={() => props.onSelect(null)}
      aria-label="עולם המשחק"
    >
      <color attach="background" args={["#a9cbe0"]} />
      <fog attach="fog" args={["#bcd6e4", 80, 230]} />
      <Sky distance={450} sunPosition={[60, 18, 40]} turbidity={6} rayleigh={1.4} mieCoefficient={0.006} mieDirectionalG={0.85} />
      <hemisphereLight args={["#fff6e5", "#3d6a7d", lowPower ? 0.9 : 0.75]} />
      {!lowPower && <SceneLighting warm="#ffe2b8" cool="#a8d4ff" />}
      <directionalLight
        position={[30, 40, 20]}
        intensity={1.6}
        color="#fff1d6"
        castShadow={!lowPower}
        shadow-mapSize={quality === "high" ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <Ocean />
      <Hub level={props.level} decorations={props.decorations} />
      {REGIONS.map((r) => (
        <Island key={r.id} def={r} state={props.regions[r.id]} selected={props.selected === r.id} onSelect={props.onSelect} onBuilding={props.onBuilding} lowPower={lowPower} />
      ))}
      <CameraRig selected={props.selected} />
      <LabelProjector regions={props.regions} labels={labels} />
      <RendererTone quality={quality} exposure={1.05} />
      <PostFX quality={quality} bloom={0.75} />
      <QualityGovernor quality={quality} onChange={setQuality} />
    </Canvas>
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-label="אזורים">
      {REGIONS.map((r) => {
        const st = props.regions[r.id];
        const sel = props.selected === r.id;
        return (
          <button
            key={r.id}
            ref={(el) => {
              labels.current[r.id] = el;
            }}
            type="button"
            onClick={() => props.onSelect(r.id)}
            aria-label={`${r.name}, שלב ${st.stage} מתוך 5`}
            style={{ visibility: "hidden" }}
            className={`pointer-events-auto absolute left-0 top-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[14px] font-semibold shadow-lg backdrop-blur ${sel ? "bg-white text-stone-900" : "bg-stone-900/75 text-white hover:bg-stone-900/90"}`}
            dir="rtl"
          >
            {r.name}
            <span className="ms-1.5 inline-flex gap-0.5 align-middle" aria-hidden>
              {[1, 2, 3, 4, 5].map((s) => (
                <span key={s} className={`inline-block h-1.5 w-1.5 rounded-full ${s <= st.stage ? "bg-amber-300" : "bg-white/35"}`} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
    </div>
  );
}

// ───────── Camera ─────────

function CameraRig({ selected }: { selected: RegionId | null }) {
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const { camera, size } = useThree();
  // portrait screens need a farther camera to fit the whole archipelago
  const fit = Math.min(2.35, Math.max(1, 1.05 / (size.width / size.height)));
  const portrait = size.width < size.height;
  const anim = useRef<{ t: number; from: THREE.Vector3; to: THREE.Vector3; camFrom: THREE.Vector3; camTo: THREE.Vector3 } | null>(null);
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const island = selected ? new THREE.Vector3(...regionPosition(REGION_BY_ID[selected])) : new THREE.Vector3(0, 0, 0);
    const dir = selected ? island.clone().normalize() : new THREE.Vector3(0, 0, 1);
    // on portrait screens the region panel covers the lower half → aim below the island so it sits in the upper half
    const target = selected && portrait ? island.clone().add(dir.clone().multiplyScalar(7)) : island;
    const camTo = selected ? target.clone().add(dir.multiplyScalar(14 * Math.min(fit, 1.4))).add(new THREE.Vector3(0, 12 * Math.min(fit, 1.4), 0)) : new THREE.Vector3(0, 30 * fit, 38 * fit);
    anim.current = { t: 0, from: c.target.clone(), to: target, camFrom: camera.position.clone(), camTo };
  }, [selected, camera, fit, portrait]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const a = anim.current;
    if (a) {
      a.t = Math.min(1, a.t + dt / 1.1);
      const k = 1 - Math.pow(1 - a.t, 3); // ease-out
      c.target.lerpVectors(a.from, a.to, k);
      camera.position.lerpVectors(a.camFrom, a.camTo, k);
      if (a.t >= 1) anim.current = null;
    }
    // keep exploration inside the archipelago
    if (c.target.length() > 22) c.target.setLength(22);
    c.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={10}
      maxDistance={100}
      minPolarAngle={0.35}
      maxPolarAngle={1.25}
      screenSpacePanning={false}
      autoRotate={!interacted && !selected}
      autoRotateSpeed={0.25}
      onStart={() => {
        setInteracted(true);
        anim.current = null;
      }}
    />
  );
}

// ───────── Ocean ─────────

function Ocean() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = -0.6 + Math.sin(clock.elapsedTime * 0.6) * 0.06;
  });
  return (
    <group>
      <mesh ref={ref} rotation-x={-Math.PI / 2} position={[0, -0.6, 0]} receiveShadow>
        <circleGeometry args={[200, 64]} />
        <meshPhysicalMaterial color="#2f78a3" roughness={0.16} metalness={0.05} clearcoat={1} clearcoatRoughness={0.08} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.55, 0]}>
        <ringGeometry args={[RING - 6.5, RING + 6.5, 96]} />
        <meshStandardMaterial color="#5fb0c9" transparent opacity={0.35} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ───────── Primitives ─────────

type V3 = [number, number, number];

function Box({ p, s, c, ghost, emissive }: { p: V3; s: V3; c: string; ghost?: boolean; emissive?: string }) {
  return (
    <mesh position={p} castShadow={!ghost} receiveShadow>
      <boxGeometry args={s} />
      <Mat c={c} ghost={ghost} emissive={emissive} />
    </mesh>
  );
}
function Cyl({ p, r, h, c, ghost, top, seg = 16, emissive }: { p: V3; r: number; h: number; c: string; ghost?: boolean; top?: number; seg?: number; emissive?: string }) {
  return (
    <mesh position={p} castShadow={!ghost} receiveShadow>
      <cylinderGeometry args={[top ?? r, r, h, seg]} />
      <Mat c={c} ghost={ghost} emissive={emissive} />
    </mesh>
  );
}
function Cone({ p, r, h, c, ghost, seg = 4 }: { p: V3; r: number; h: number; c: string; ghost?: boolean; seg?: number }) {
  return (
    <mesh position={p} castShadow={!ghost} rotation-y={seg === 4 ? Math.PI / 4 : 0}>
      <coneGeometry args={[r, h, seg]} />
      <Mat c={c} ghost={ghost} />
    </mesh>
  );
}
function Dome({ p, r, c, ghost }: { p: V3; r: number; c: string; ghost?: boolean }) {
  return (
    <mesh position={p} castShadow={!ghost}>
      <sphereGeometry args={[r, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <Mat c={c} ghost={ghost} />
    </mesh>
  );
}
function Mat({ c, ghost, emissive }: { c: string; ghost?: boolean; emissive?: string }) {
  return ghost ? (
    <meshStandardMaterial color="#ffffff" transparent opacity={0.16} depthWrite={false} />
  ) : (
    <meshStandardMaterial color={c} roughness={0.75} metalness={0.05} emissive={emissive ?? "#000000"} emissiveIntensity={emissive ? 0.6 : 0} flatShading />
  );
}
function Tree({ p, s = 1, c = "#3f7a46" }: { p: V3; s?: number; c?: string }) {
  return (
    <group position={p} scale={s}>
      <Cyl p={[0, 0.35, 0]} r={0.12} h={0.7} c="#6b4a2f" seg={6} />
      <Cone p={[0, 1.15, 0]} r={0.55} h={1.3} c={c} seg={7} />
    </group>
  );
}
function Rock({ p, s = 1 }: { p: V3; s?: number }) {
  return (
    <mesh position={p} scale={[s, s * 0.6, s]} castShadow>
      <dodecahedronGeometry args={[0.45, 0]} />
      <meshStandardMaterial color="#8d8a84" flatShading roughness={0.9} />
    </mesh>
  );
}

// ───────── Landmarks per region & stage ─────────

function Landmark({ region, stage, ghost }: { region: RegionId; stage: number; ghost?: boolean }) {
  const c = REGION_BY_ID[region].color;
  const g = ghost;
  const W = "#efe9df";
  switch (region) {
    case "wealth":
      return [
        <group key={1}><Box p={[0, 0.5, 0]} s={[1.4, 1, 1.2]} c={W} ghost={g} /><Cone p={[0, 1.4, 0]} r={1.1} h={0.8} c={c.roof} ghost={g} /></group>,
        <group key={2}><Box p={[0, 0.7, 0]} s={[2.2, 1.4, 1.6]} c={W} ghost={g} />{[-0.8, -0.27, 0.27, 0.8].map((x) => <Cyl key={x} p={[x, 0.7, 0.9]} r={0.12} h={1.4} c="#f4efe6" ghost={g} seg={8} />)}<Cone p={[0, 1.75, 0]} r={1.5} h={0.7} c={c.accent} ghost={g} /></group>,
        <group key={3}><Box p={[0, 2.4, 0]} s={[1.2, 4.8, 1.2]} c="#7fa6c4" ghost={g} emissive={g ? undefined : "#2a4e6e"} /><Box p={[0, 5.0, 0]} s={[0.8, 0.4, 0.8]} c={c.accent} ghost={g} /></group>,
        <group key={4}><Cyl p={[0, 0.8, 0]} r={1.3} h={1.6} c={W} ghost={g} /><Dome p={[0, 1.6, 0]} r={1.3} c={c.accent} ghost={g} /></group>,
        <group key={5}><Cyl p={[0, 3.5, 0]} r={0.9} top={0.5} h={7} c={c.accent} ghost={g} seg={8} /><Cone p={[0, 7.6, 0]} r={0.5} h={1.4} c="#fff2c2" ghost={g} seg={8} /></group>,
      ][stage - 1];
    case "health":
      return [
        <group key={1}><mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}><planeGeometry args={[2.6, 1.6]} /><Mat c="#6fae5a" ghost={g} /></mesh>{[-1.2, 1.2].map((x) => <Box key={x} p={[x, 0.4, 0]} s={[0.08, 0.8, 0.8]} c="#ffffff" ghost={g} />)}</group>,
        <group key={2}><Box p={[0, 0.65, 0]} s={[2, 1.3, 1.4]} c={W} ghost={g} /><Box p={[0, 1.4, 0]} s={[2.1, 0.2, 1.5]} c={c.roof} ghost={g} /></group>,
        <group key={3}><mesh position={[0, 0.45, 0]} rotation-x={-Math.PI / 2} castShadow><torusGeometry args={[1.3, 0.35, 8, 24]} /><Mat c={c.accent} ghost={g} /></mesh></group>,
        <group key={4}>{[[-0.6, 0], [0.6, 0.3]].map(([x, z]) => <Cyl key={x} p={[x, 0.08, z]} r={0.6} h={0.16} c="#7fd3e6" ghost={g} seg={20} />)}<Box p={[0, 0.5, -0.9]} s={[1.6, 1, 0.6]} c={W} ghost={g} /></group>,
        <group key={5}><Cone p={[0, 2, 0]} r={2} h={4} c="#8a8f7c" ghost={g} seg={7} /><Box p={[0, 4.2, 0]} s={[0.8, 0.6, 0.8]} c={c.roof} ghost={g} /></group>,
      ][stage - 1];
    case "knowledge":
      return [
        <group key={1}><Box p={[0, 0.5, 0]} s={[1.4, 1, 1.1]} c={W} ghost={g} /><Cone p={[0, 1.35, 0]} r={1.05} h={0.7} c={c.roof} ghost={g} /></group>,
        <group key={2}><Box p={[0, 0.7, 0]} s={[2.4, 1.4, 1.4]} c={W} ghost={g} />{[-0.9, -0.3, 0.3, 0.9].map((x) => <Cyl key={x} p={[x, 0.7, 0.8]} r={0.1} h={1.4} c="#ffffff" ghost={g} seg={8} />)}<Box p={[0, 1.5, 0]} s={[2.5, 0.2, 1.5]} c={c.roof} ghost={g} /></group>,
        <group key={3}><Box p={[-0.8, 0.6, 0]} s={[1.2, 1.2, 1.2]} c={W} ghost={g} /><Box p={[0.8, 0.6, 0]} s={[1.2, 1.2, 1.2]} c={W} ghost={g} /><Box p={[0, 1.6, 0]} s={[0.6, 3.2, 0.6]} c={W} ghost={g} /><Cone p={[0, 3.6, 0]} r={0.5} h={0.8} c={c.roof} ghost={g} /></group>,
        <group key={4}><Cyl p={[0, 0.9, 0]} r={0.9} h={1.8} c={W} ghost={g} /><Dome p={[0, 1.8, 0]} r={0.9} c="#c9d6ea" ghost={g} /><mesh position={[0.4, 2.4, 0]} rotation-z={0.7} castShadow><cylinderGeometry args={[0.12, 0.16, 1.4, 8]} /><Mat c="#3c4b66" ghost={g} /></mesh></group>,
        <group key={5}><Cyl p={[0, 1, 0]} r={1.8} h={2} c={W} ghost={g} seg={20} /><Dome p={[0, 2, 0]} r={1.8} c={c.accent} ghost={g} /><Cyl p={[0, 3.9, 0]} r={0.12} h={0.8} c="#ffe08a" ghost={g} seg={6} /></group>,
      ][stage - 1];
    case "career":
      return [
        <group key={1}><Box p={[0, 0.8, 0]} s={[1.2, 1.6, 1.2]} c="#d9dde3" ghost={g} /></group>,
        <group key={2}><Box p={[0, 1.1, 0]} s={[1.6, 2.2, 1.4]} c="#9fd3e0" ghost={g} emissive={g ? undefined : "#1d4a57"} /></group>,
        <group key={3}>{[[-0.9, 1.4], [0, 2.2], [0.9, 1.7]].map(([x, h]) => <Box key={x} p={[x, h / 2, 0]} s={[0.8, h, 0.8]} c="#c6ccd6" ghost={g} />)}</group>,
        <group key={4}><Box p={[0, 2.6, 0]} s={[1.6, 5.2, 1.6]} c="#5c6d82" ghost={g} emissive={g ? undefined : "#203040"} /><Box p={[0, 5.4, 0]} s={[1.2, 0.4, 1.2]} c={c.accent} ghost={g} /></group>,
        <group key={5}><Box p={[0, 4, 0]} s={[1.2, 8, 1.2]} c="#8fb8c9" ghost={g} emissive={g ? undefined : "#1c3c4a"} /><Cyl p={[0, 8.6, 0]} r={0.06} h={1.2} c="#ffffff" ghost={g} seg={6} /></group>,
      ][stage - 1];
    case "social":
      return [
        <group key={1}><Box p={[0, 0.45, 0]} s={[1.1, 0.9, 1]} c="#f2e6d0" ghost={g} /><Cone p={[0, 1.2, 0]} r={0.9} h={0.7} c={c.roof} ghost={g} /></group>,
        <group key={2}>{[[-0.6, 0.4], [0.5, -0.3], [0, 0.6], [0.7, 0.5]].map(([x, z], i) => <mesh key={i} position={[x, 0.2, z]} castShadow><sphereGeometry args={[0.22, 8, 6]} /><Mat c={["#e86f8b", "#f2c14e", "#ffffff", "#c58fe0"][i]} ghost={g} /></mesh>)}<Tree p={[-0.7, 0, -0.5]} s={0.8} /></group>,
        <group key={3}><Cyl p={[0, 0.05, 0]} r={1.4} h={0.1} c="#d9c7a7" ghost={g} seg={24} /><Cyl p={[0, 0.35, 0]} r={0.45} h={0.5} c="#b9c6cf" ghost={g} seg={12} /><Cyl p={[0, 0.65, 0]} r={0.12} h={0.4} c="#7fd3e6" ghost={g} seg={8} /></group>,
        <group key={4}><Box p={[0, 0.6, 0]} s={[2.4, 1.2, 1.2]} c="#f2e6d0" ghost={g} /><mesh position={[0, 1.45, 0]} rotation-z={Math.PI / 4} castShadow><boxGeometry args={[0.9, 0.9, 1.25]} /><Mat c={c.roof} ghost={g} /></mesh></group>,
        <group key={5}>{[-0.9, 0, 0.9].map((x, i) => <Cone key={x} p={[x, 0.8, i === 1 ? -0.4 : 0.3]} r={0.7} h={1.6} c={["#e59a4a", "#f4f1ea", "#c0582f"][i]} ghost={g} seg={10} />)}</group>,
      ][stage - 1];
    case "mind":
      return [
        <group key={1}><Cyl p={[0, 0.04, 0]} r={1.3} h={0.08} c="#e8dfc8" ghost={g} seg={24} /><Rock p={[0.3, 0.15, 0.2]} s={0.7} /><Rock p={[-0.4, 0.1, -0.3]} s={0.5} /></group>,
        <group key={2}>{[0, 1, 2, 3, 4, 5].map((i) => <Box key={i} p={[Math.cos(i) * 1.1, 0.35, Math.sin(i) * 1.1]} s={[0.25, 0.7, 0.25]} c="#a9a49a" ghost={g} />)}</group>,
        <group key={3}>{[-0.8, 0.8].map((x) => <Cyl key={x} p={[x, 1, 0]} r={0.12} h={2} c="#b3412f" ghost={g} seg={8} />)}<Box p={[0, 2, 0]} s={[2.3, 0.18, 0.3]} c="#b3412f" ghost={g} /><Box p={[0, 1.65, 0]} s={[1.8, 0.12, 0.2]} c="#b3412f" ghost={g} /></group>,
        <group key={4}>{[0, 1, 2].map((i) => <group key={i}><Box p={[0, 0.45 + i * 0.85, 0]} s={[1.5 - i * 0.35, 0.6, 1.5 - i * 0.35]} c="#efe6d6" ghost={g} /><Cone p={[0, 0.9 + i * 0.85, 0]} r={1.25 - i * 0.28} h={0.35} c={c.roof} ghost={g} /></group>)}</group>,
        <group key={5}><Cyl p={[0, 2.5, 0]} r={0.45} top={0.3} h={5} c="#efe6d6" ghost={g} seg={8} /><mesh position={[0, 5.3, 0]}><sphereGeometry args={[0.45, 16, 12]} /><meshStandardMaterial color="#fff6d8" emissive={g ? "#000000" : "#ffe9a8"} emissiveIntensity={g ? 0 : 1.6} transparent={g} opacity={g ? 0.16 : 1} /></mesh>{!g && <pointLight position={[0, 5.3, 0]} intensity={6} distance={10} color="#ffe2a0" />}</group>,
      ][stage - 1];
  }
}

const SLOTS: V3[] = [
  [0, 0, 0],
  [-2.4, 0, 1.4],
  [2.3, 0, 1.2],
  [-1.6, 0, -2.2],
  [1.8, 0, -2],
];

function Rising({ children, built }: { children: ReactNode; built: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const t = useRef(built ? 1 : 0);
  useFrame((_, dt) => {
    if (!ref.current) return;
    if (t.current < 1) {
      t.current = Math.min(1, t.current + dt / 1.2);
      const k = 1 - Math.pow(1 - t.current, 3);
      ref.current.scale.set(1, Math.max(0.001, k), 1);
    }
  });
  return <group ref={ref}>{children}</group>;
}

function Island({ def, state, selected, onSelect, onBuilding, lowPower }: { def: RegionDef; state: RegionState; selected: boolean; onSelect: (id: RegionId) => void; onBuilding: (id: RegionId, stage: number) => void; lowPower: boolean }) {
  const pos = regionPosition(def);
  const [hover, setHover] = useState(false);
  const group = useRef<THREE.Group>(null);
  const developed = state.stage / 5;
  const ground = useMemo(() => new THREE.Color("#8d9187").lerp(new THREE.Color(def.color.ground), 0.35 + developed * 0.65).getStyle(), [def.color.ground, developed]);
  // remember which landmarks this device has already seen → animate only new ones
  const seenKey = `lifeos:world:seen:${def.id}`;
  const [seen] = useState(() => {
    try {
      return Number(localStorage.getItem(seenKey) ?? "-1");
    } catch {
      return state.stage;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(seenKey, String(state.stage));
    } catch {
      /* ignore */
    }
  }, [seenKey, state.stage]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const lift = (hover || selected ? 0.35 : 0) + Math.sin(clock.elapsedTime * 0.5 + def.angle * 3) * 0.05;
    group.current.position.y += (lift - group.current.position.y) * 0.08;
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(def.id);
  };
  const trees = 3 + state.stage * 2;

  return (
    <group position={pos}>
      <group
        ref={group}
        onClick={click}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
      >
        {/* terrain */}
        <Cyl p={[0, -0.5, 0]} r={5.2} top={4.9} h={1.1} c="#d9c79d" seg={10} />
        <Cyl p={[0, 0.05, 0]} r={4.9} top={4.6} h={0.3} c={ground} seg={10} />
        <mesh position={[-2.6, 0.2, -2.6]} scale={[1.6, 0.7, 1.4]} castShadow receiveShadow>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color={ground} flatShading />
        </mesh>
        {/* selection ring */}
        {(hover || selected) && (
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.22, 0]}>
            <ringGeometry args={[4.75, 5.05, 48]} />
            <meshBasicMaterial color={def.color.glow} transparent opacity={selected ? 0.95 : 0.6} />
          </mesh>
        )}
        {/* nature */}
        {Array.from({ length: trees }).map((_, i) => {
          const a = (i / trees) * Math.PI * 2 + def.angle;
          const r = 3.6 + (i % 3) * 0.35;
          return <Tree key={i} p={[Math.cos(a) * r, 0.2, Math.sin(a) * r]} s={0.7 + (i % 3) * 0.15} />;
        })}
        {state.stage === 0 && (
          <>
            <Rock p={[0.8, 0.3, 0.6]} s={1.2} />
            <Rock p={[-0.7, 0.25, 1.2]} s={0.9} />
            <Rock p={[0.2, 0.25, -1]} s={0.8} />
          </>
        )}
        {/* landmarks */}
        {[1, 2, 3, 4, 5].map((stage) => {
          const built = stage <= state.stage;
          const next = stage === state.stage + 1;
          if (!built && !next) return null;
          return (
            <group
              key={stage}
              position={[SLOTS[stage - 1][0], 0.2, SLOTS[stage - 1][2]]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(def.id);
                onBuilding(def.id, stage);
              }}
            >
              {built ? (
                <Rising built={stage <= seen}>
                  <Landmark region={def.id} stage={stage} />
                </Rising>
              ) : (
                <Landmark region={def.id} stage={stage} ghost />
              )}
            </group>
          );
        })}
        {state.stage > 0 && !lowPower && <Sparkles count={8 + state.stage * 8} scale={[8, 4 + state.stage, 8]} position={[0, 2.5, 0]} size={3} speed={0.3} color={def.color.glow} />}
      </group>
    </group>
  );
}

/** Projects each island's label anchor to screen space every frame (labels are plain DOM outside the canvas). */
function LabelProjector({ regions, labels }: { regions: Record<RegionId, RegionState>; labels: React.RefObject<Partial<Record<RegionId, HTMLButtonElement | null>>> }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    for (const r of REGIONS) {
      const el = labels.current?.[r.id];
      if (!el) continue;
      const [x, , z] = regionPosition(r);
      v.set(x, 5.2 + regions[r.id].stage * 0.6, z).project(camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      el.style.visibility = visible ? "visible" : "hidden";
      el.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`;
    }
  });
  return null;
}

// ───────── Central hub: grows with the player's level ─────────

const DECOR_POS: Record<string, V3> = {
  lantern: [2.2, 0.3, 1.2],
  banner: [-2.2, 0.3, 1.0],
  statue: [0, 0.3, 2.6],
  compass: [2.4, 0.3, -1.2],
  beacon: [-2.4, 0.3, -1.4],
  fountain: [0, 0.3, -2.6],
};

function Hub({ level, decorations }: { level: number; decorations: string[] }) {
  const tiers = Math.min(5, 1 + Math.floor((level - 1) / 3));
  const flag = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (flag.current) flag.current.rotation.y = Math.sin(clock.elapsedTime * 2) * 0.25;
  });
  const citadel = decorations.includes("citadel");
  return (
    <group>
      <Cyl p={[0, -0.45, 0]} r={4.4} top={4.1} h={1} c="#d6c39a" seg={12} />
      <Cyl p={[0, 0.08, 0]} r={4.1} top={3.9} h={0.25} c="#7a9a6a" seg={12} />
      {Array.from({ length: tiers }).map((_, i) => (
        <group key={i}>
          <Cyl p={[0, 0.6 + i * 1.1, 0]} r={1.6 - i * 0.22} h={1.1} c={i % 2 ? "#e9e2d4" : "#f4efe5"} seg={8} />
        </group>
      ))}
      <Cone p={[0, 0.6 + tiers * 1.1 + 0.2, 0]} r={1.3 - tiers * 0.15} h={1.2} c="#3e5f8a" seg={8} />
      <mesh ref={flag} position={[0.35, 0.6 + tiers * 1.1 + 1.25, 0]} castShadow>
        <boxGeometry args={[0.7, 0.4, 0.04]} />
        <meshStandardMaterial color="#d4a73c" />
      </mesh>
      {citadel && [0, 1, 2, 3].map((i) => <Cyl key={i} p={[Math.cos((i * Math.PI) / 2) * 2.6, 1.2, Math.sin((i * Math.PI) / 2) * 2.6]} r={0.45} h={2.4} c="#e9e2d4" seg={8} />)}
      {decorations.map((d) => {
        const p = DECOR_POS[d];
        if (!p) return null;
        return (
          <group key={d} position={p}>
            {d === "lantern" && <><Cyl p={[0, 0.5, 0]} r={0.05} h={1} c="#3a3a3a" seg={6} /><mesh position={[0, 1.05, 0]}><sphereGeometry args={[0.16, 10, 8]} /><meshStandardMaterial color="#ffe9a8" emissive="#ffd36e" emissiveIntensity={1.4} /></mesh></>}
            {d === "banner" && <><Cyl p={[0, 0.8, 0]} r={0.04} h={1.6} c="#3a3a3a" seg={6} /><Box p={[0.25, 1.35, 0]} s={[0.5, 0.45, 0.03]} c="#9b2f3a" /></>}
            {d === "statue" && <><Box p={[0, 0.2, 0]} s={[0.6, 0.4, 0.6]} c="#bdb7aa" /><Cyl p={[0, 0.8, 0]} r={0.16} h={0.8} c="#bdb7aa" seg={8} /><mesh position={[0, 1.3, 0]}><sphereGeometry args={[0.18, 10, 8]} /><meshStandardMaterial color="#bdb7aa" /></mesh></>}
            {d === "compass" && <mesh position={[0, 0.25, 0]} rotation-x={-Math.PI / 2}><torusGeometry args={[0.4, 0.06, 6, 20]} /><meshStandardMaterial color="#d4a73c" metalness={0.6} roughness={0.3} /></mesh>}
            {d === "beacon" && <><Cyl p={[0, 0.6, 0]} r={0.25} top={0.15} h={1.2} c="#5b5b5b" seg={6} /><mesh position={[0, 1.35, 0]}><sphereGeometry args={[0.2, 10, 8]} /><meshStandardMaterial color="#ff9c5a" emissive="#ff7a2a" emissiveIntensity={1.5} /></mesh></>}
            {d === "fountain" && <><Cyl p={[0, 0.15, 0]} r={0.6} h={0.3} c="#cfc8ba" seg={14} /><Cyl p={[0, 0.35, 0]} r={0.45} h={0.1} c="#7fd3e6" seg={14} /></>}
          </group>
        );
      })}
    </group>
  );
}
