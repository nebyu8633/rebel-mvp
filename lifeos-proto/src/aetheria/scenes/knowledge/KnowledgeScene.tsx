/**
 * AETHERIA — the Kingdom of Knowledge: the Hall of Patterns (first slice).
 * Visual identity (distinct from the Sanctuary): night-blue astral sky, floating stone platforms
 * with brass rims over a void of stars, towering library monoliths drifting at impossible angles,
 * a celestial orrery turning above the hall, geometric frames of light. Platforms are joined by
 * paths of light. A waystone leads back to the Sanctuary (arriving at the threshold).
 * All world changes go through the rules engine; the scene renders state.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CylinderCollider, CuboidCollider, RigidBody } from "@react-three/rapier";
import { usePBR } from "../../../world/materials";
import { rng } from "../../../world/geometry";
import { interactables, type Quality } from "../../../store";
import { telemetry } from "../../../player/Player";
import { playerCommands, playerReactions } from "../../../engine/events";
import { goToWorld, worldAvailable } from "../../../engine/worldStore";
import { setArrival } from "../../../engine/arrival";
import { useAetheria } from "../../store";
import { useAetheriaUi } from "../../ui/uiStore";
import { JOURNAL } from "../../content";
import { K, onEnterKingdom } from "../../content/knowledgeKingdom";
import { kingdomGlyph } from "../sanctuary/glyphs";
import { isleGeometry } from "../sanctuary/environment";
import { ISLE } from "../sanctuary/layout";
import { LightPath } from "../shared/LightPath";
import { ResonanceFx } from "../../fx/ResonanceFx";
import { PostFx } from "../../../world/PostFx";
import { Arrival } from "../../../world/Arrival";
import { SoundController, DustMotes } from "../sanctuary/Life";
import { HallOfPatterns } from "./HallOfPatterns";
import { FALL_Y, HALL, LANDING, LIVING_GATE, LIVING_PATH, PATHS, SATELLITES, SPAWN, WAYSTONE } from "./layout";
import { useSanctuaryKit } from "../sanctuary/architecture";

const BLUE = "#3f8cff";

// ------------------------------------------------------------------ platforms
function Platform({ x, y, z, r, seed, inlay }: { x: number; y: number; z: number; r: number; seed: number; inlay?: boolean }) {
  const floor = usePBR("ruinfloor", { tint: 0xb9bccb });
  const rock = usePBR("rock", { tint: 0x6f7186 });
  const brass = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 1, roughness: 0.32 }), []);
  const under = useMemo(() => isleGeometry(seed), [seed]);
  const top = useMemo(() => {
    const g = new THREE.CylinderGeometry(r, r * 0.97, 0.5, 48);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2);
    return g;
  }, [r]);
  const inlayMat = useMemo(() => {
    if (!inlay) return null;
    const S = 1024;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    const C = S / 2;
    g.strokeStyle = g.fillStyle = "#fff";
    const ring = (rr: number, w: number) => {
      g.lineWidth = w;
      g.beginPath();
      g.arc(C, C, rr * C, 0, Math.PI * 2);
      g.stroke();
    };
    ring(0.96, 6);
    ring(0.9, 2);
    ring(0.6, 3);
    ring(0.3, 2);
    // a lattice of pattern lines: the hall reads like a diagram
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(C + Math.cos(a) * 0.3 * C, C + Math.sin(a) * 0.3 * C);
      g.lineTo(C + Math.cos(a + Math.PI / 6) * 0.9 * C, C + Math.sin(a + Math.PI / 6) * 0.9 * C);
      g.stroke();
    }
    const img = kingdomGlyph("knowledge").image as CanvasImageSource;
    g.drawImage(img, C - 0.22 * C, C - 0.22 * C, 0.44 * C, 0.44 * C);
    const tex = new THREE.CanvasTexture(c);
    return new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: new THREE.Color(BLUE), emissiveIntensity: 1.4, emissiveMap: tex, alphaMap: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  }, [inlay]);
  const S = r * 1.15;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.25, r]} position={[x, y - 0.25, z]} />
      </RigidBody>
      <mesh geometry={top} material={floor} position={[x, y - 0.25, z]} receiveShadow castShadow />
      <mesh material={brass} position={[x, y - 0.05, z]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[r, 0.09, 8, 72]} />
      </mesh>
      <group position={[x, y - 0.5 - 0.12 * S, z]} scale={[S, S * 1.1, S]}>
        <mesh geometry={under} material={rock} />
      </group>
      {inlayMat && (
        <mesh material={inlayMat} position={[x, y + 0.006, z]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[r - 0.25, 64]} />
        </mesh>
      )}
    </group>
  );
}

// ------------------------------------------------------------------ the library monoliths
function bookTexture(seed: number) {
  const r = rng(seed);
  const W = 256;
  const H = 1024;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const e = document.createElement("canvas");
  e.width = W;
  e.height = H;
  const ge = e.getContext("2d")!;
  ge.fillStyle = "#000";
  ge.fillRect(0, 0, W, H);
  g.fillStyle = "#1c1612";
  g.fillRect(0, 0, W, H);
  const leather = ["#4a1f1a", "#2d3a5c", "#3b4a2a", "#6b4a1f", "#2a2440", "#5a2f3f", "#1f3b44"];
  const rows = 10;
  for (let row = 0; row < rows; row++) {
    const y0 = (row / rows) * H;
    const rowH = H / rows;
    let x = 4;
    while (x < W - 6) {
      const w = 6 + r() * 14;
      const h = rowH * (0.62 + r() * 0.28);
      g.fillStyle = leather[Math.floor(r() * leather.length)];
      g.fillRect(x, y0 + rowH - 8 - h, w - 1, h);
      g.fillStyle = "rgba(214,180,110,.55)";
      g.fillRect(x + 1, y0 + rowH - 8 - h * 0.8, w - 3, 1.5);
      g.fillRect(x + 1, y0 + rowH - 8 - h * 0.3, w - 3, 1.5);
      // a few spines glow: knowledge that is still awake
      if (r() < 0.07) {
        ge.fillStyle = "#fff";
        ge.fillRect(x, y0 + rowH - 8 - h, w - 1, h);
      }
      x += w;
    }
    g.fillStyle = "#3a2a1c";
    g.fillRect(0, y0 + rowH - 8, W, 8);
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, emissive: new THREE.CanvasTexture(e) };
}

function Monoliths() {
  const stone = usePBR("ruinwall", { tint: 0x8d8fa3 });
  const books = useMemo(() => {
    const t = bookTexture(3);
    return new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissive, emissive: new THREE.Color("#7fb0ff"), emissiveIntensity: 1.6, roughness: 0.85 });
  }, []);
  const items = useMemo(() => {
    const r = rng(17);
    return Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2 + r() * 0.2;
      const d = 34 + r() * 26;
      return { x: Math.cos(a) * d, z: Math.sin(a) * d, y: -6 + r() * 18, h: 14 + r() * 16, w: 3 + r() * 2, yaw: -a + Math.PI / 2, tilt: (r() - 0.5) * 0.5, roll: (r() - 0.5) * 0.3, phase: r() * 6 };
    });
  }, []);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => (c.position.y = items[i].y + Math.sin(clock.elapsedTime * 0.2 + items[i].phase) * 0.6));
  });
  return (
    <group ref={ref} userData={{ noBatch: true }}>
      {items.map((m, i) => (
        <group key={i} position={[m.x, m.y, m.z]} rotation={[m.tilt, m.yaw, m.roll]}>
          {/* stone frame + two faces of shelves */}
          <mesh material={stone} castShadow>
            <boxGeometry args={[m.w + 0.4, m.h + 0.6, 1.0]} />
          </mesh>
          <mesh material={books} position={[0, 0, 0.51]}>
            <planeGeometry args={[m.w, m.h]} />
          </mesh>
          <mesh material={books} position={[0, 0, -0.51]} rotation-y={Math.PI}>
            <planeGeometry args={[m.w, m.h]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ the orrery above the hall
function Orrery() {
  const brass = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xc19a5b, metalness: 1, roughness: 0.28 }), []);
  const core = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: new THREE.Color("#a9c8ff"), emissiveIntensity: 3 }), []);
  const planetMats = useMemo(() => ["#6f8fd8", "#c9a86a", "#8fd6c8", "#b48cff"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.2, emissive: new THREE.Color(c), emissiveIntensity: 0.25 })), []);
  const rings = useMemo(
    () => [
      { r: 4, tilt: [0.2, 0, 0.1], speed: 0.25 },
      { r: 6.2, tilt: [-0.35, 0.4, 0], speed: -0.16 },
      { r: 8.5, tilt: [0.5, -0.2, 0.3], speed: 0.1 },
      { r: 11, tilt: [-0.15, 0.8, -0.4], speed: -0.07 },
    ],
    [],
  );
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame((_, dt) => refs.current.forEach((g, i) => g && (g.rotation.y += dt * rings[i].speed)));
  return (
    <group position={[HALL.x, 19, HALL.z]} userData={{ noBatch: true }}>
      <mesh material={core}>
        <icosahedronGeometry args={[1.3, 2]} />
      </mesh>
      {rings.map((ring, i) => (
        <group key={i} rotation={ring.tilt as [number, number, number]}>
          <group ref={(el) => void (refs.current[i] = el)}>
            <mesh material={brass} rotation-x={Math.PI / 2}>
              <torusGeometry args={[ring.r, 0.07, 8, 96]} />
            </mesh>
            <mesh material={planetMats[i]} position={[ring.r, 0, 0]}>
              <sphereGeometry args={[0.35 + i * 0.12, 20, 14]} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

/** Frames of light: geometric outlines turning in the void (impossible architecture, cheaply). */
function Frames() {
  const items = useMemo(() => {
    const r = rng(29);
    const shapes = [new THREE.BoxGeometry(4, 4, 4), new THREE.OctahedronGeometry(3), new THREE.IcosahedronGeometry(2.6), new THREE.TetrahedronGeometry(3)];
    return Array.from({ length: 7 }, (_, i) => {
      const a = r() * Math.PI * 2;
      const d = 20 + r() * 30;
      return { geo: new THREE.EdgesGeometry(shapes[i % shapes.length]), x: Math.cos(a) * d, z: Math.sin(a) * d, y: 6 + r() * 20, s: 0.6 + r() * 1.2, spin: (r() - 0.5) * 0.4 };
    });
  }, []);
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color: new THREE.Color("#8fb6ff").multiplyScalar(1.8), transparent: true, opacity: 0.7, toneMapped: false }), []);
  const refs = useRef<(THREE.LineSegments | null)[]>([]);
  useFrame((_, dt) => refs.current.forEach((l, i) => l && ((l.rotation.y += dt * items[i].spin), (l.rotation.x += dt * items[i].spin * 0.6))));
  return (
    <group userData={{ noBatch: true }}>
      {items.map((f, i) => (
        <lineSegments key={i} ref={(el) => void (refs.current[i] = el)} geometry={f.geo} material={mat} position={[f.x, f.y, f.z]} scale={f.s} />
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ the way back, arrival, falling
function Waystone() {
  const stone = usePBR("rock", { tint: 0x8a8ca0 });
  const rune = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: new THREE.Color("#9fd8ff"), emissiveIntensity: 2.5 }), []);
  useEffect(() => {
    if (!worldAvailable("sanctuary")) return;
    interactables.set("waystone-k", {
      id: "waystone-k",
      label: "אבן הדרך: חזרה אל המקדש הראשון",
      x: WAYSTONE.x - 1,
      y: 0,
      z: WAYSTONE.z,
      radius: 1.8,
      onContact: () => {
        // land in front of the threshold on the isle, facing the bridge home
        setArrival("sanctuary", { x: ISLE.x + 3.2 - 2.6, y: ISLE.top + 0.2, z: ISLE.z, yaw: Math.PI / 2 });
        void goToWorld("sanctuary", { style: "resonance" });
      },
    });
    return () => void interactables.delete("waystone-k");
  }, []);
  return (
    <group position={[WAYSTONE.x, 0, WAYSTONE.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.45, 1.2, 0.35]} position={[0, 1.2, 0]} />
      </RigidBody>
      <mesh material={stone} position={[0, 1.2, 0]} scale={[0.5, 1.25, 0.38]} castShadow>
        <dodecahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh material={rune} position={[-0.42, 1.4, 0]} rotation-y={-Math.PI / 2}>
        <ringGeometry args={[0.16, 0.22, 6]} />
      </mesh>
    </group>
  );
}

function Story() {
  const hydrated = useAetheria((s) => s.hydrated);
  useEffect(() => {
    if (!hydrated) return;
    const st = useAetheria.getState();
    if (st.world.flags.includes(K.entered)) return;
    const before = st.world.journal.length;
    if (st.dispatch(onEnterKingdom())) {
      playerReactions.emit("surprise");
      for (const j of useAetheria.getState().world.journal.slice(before)) {
        const text = JOURNAL[j.id];
        if (text) useAetheriaUi.getState().showCard({ title: text.title, body: text.body, tone: "discovery" });
      }
    }
  }, [hydrated]);
  const cooldown = useRef(0);
  useFrame((_, dt) => {
    cooldown.current = Math.max(0, cooldown.current - dt);
    if (telemetry.y > FALL_Y || cooldown.current > 0) return;
    cooldown.current = 1.5;
    playerCommands.teleport(SPAWN.x, SPAWN.y + 0.3, SPAWN.z, SPAWN.yaw);
    useAetheriaUi.getState().say("האור תפס אותך והחזיר אותך לבמת הנחיתה.");
  });
  return null;
}

/** The Gate of the Living: once the codex is open, a path leads to it — and through it, the Grove. */
function LivingGate() {
  const open = useAetheria((s) => s.world.flags.includes(K.codex));
  const stone = usePBR("ruinwall", { tint: 0x9aa89a });
  const kit = useSanctuaryKit();
  const seal = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOn: { value: 0 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform float uTime; uniform float uOn; varying vec2 vUv;
          void main(){ vec2 p = vUv - 0.5; float r = length(p * vec2(1.0, 0.7));
            float leaves = 0.5 + 0.5 * sin(atan(p.y, p.x) * 6.0 + uTime * 0.6 + r * 18.0);
            float a = smoothstep(0.6, 0.15, r) * (0.3 + 0.5 * leaves) * uOn;
            gl_FragColor = vec4(mix(vec3(0.35, 0.95, 0.6), vec3(1.0, 0.85, 0.95), leaves * 0.4) * a * 1.5, 1.0); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  useFrame(({ clock }) => {
    seal.uniforms.uTime.value = clock.elapsedTime;
    seal.uniforms.uOn.value += ((open ? 1 : 0.12) - seal.uniforms.uOn.value) * 0.03;
  });
  const yaw = Math.atan2(-LIVING_GATE.x, -LIVING_GATE.z); // facing the hall
  useEffect(() => {
    if (!open || !worldAvailable("health")) return;
    const front = { x: LIVING_GATE.x * 0.9, y: LIVING_GATE.y, z: LIVING_GATE.z * 0.9 };
    interactables.set("living-gate", {
      id: "living-gate",
      label: "היכנסו לחורשת החיים",
      ...front,
      radius: 2.4,
      onContact: () => void goToWorld("health", { style: "resonance" }),
    });
    return () => void interactables.delete("living-gate");
  }, [open]);
  return (
    <group>
      <Platform x={LIVING_GATE.x} y={LIVING_GATE.y} z={LIVING_GATE.z} r={LIVING_GATE.r} seed={110} />
      {open && <LightPath points={LIVING_PATH} color="#9ff2b8" />}
      <group position={[LIVING_GATE.x, LIVING_GATE.y, LIVING_GATE.z]} rotation-y={yaw + Math.PI} scale={0.62}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[3.2, 2.2, 0.65]} position={[0, 2.2, 0]} />
        </RigidBody>
        <mesh geometry={kit.arch_gate} material={stone} castShadow receiveShadow />
        <mesh material={seal} position={[0, 2.4, 0]}>
          <planeGeometry args={[3.6, 5.2]} />
        </mesh>
      </group>
    </group>
  );
}

export function KnowledgeScene({ quality }: { quality: Quality }) {
  return (
    <group>
      <Platform {...LANDING} seed={101} />
      <Platform {...HALL} seed={102} inlay />
      {SATELLITES.map((s, i) => (
        <Platform key={s.id} x={s.x} y={s.y} z={s.z} r={s.r} seed={103 + i} />
      ))}
      {PATHS.map((p, i) => (
        <LightPath key={i} points={p} color="#8fb6ff" />
      ))}
      <Monoliths />
      <Orrery />
      <Frames />
      <Waystone />
      <HallOfPatterns />
      <LivingGate />
      <Story />
      <Arrival world="knowledge" />
      <ResonanceFx />
      <PostFx quality={quality} />
      <SoundController />
      <DustMotes count={quality === "low" ? 100 : 220} />
    </group>
  );
}
