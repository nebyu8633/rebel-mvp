/**
 * AETHERIA — the Kingdom of the Mind: the Hall of Reflections.
 * Visual identity: white marble islands with gold rims over a lavender void; above them hangs an
 * inverted mirror-world (the same islands upside down, translucent) where the bridges already
 * exist. Escher-like stairs and lone doors drift in the distance; a giant eye sleeps at the core.
 * Gameplay (engine-validated): CHANGE on a mirror lantern brings its reflected bridge down into
 * the real world (each only after the previous one is real); CONNECTION joins the three lanterns'
 * light and wakes the Sleeping Mind.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { usePBR } from "../../../world/materials";
import { rng } from "../../../world/geometry";
import { interactables, type Quality } from "../../../store";
import { telemetry } from "../../../player/Player";
import { playerCommands, playerReactions } from "../../../engine/events";
import { goToWorld, worldAvailable } from "../../../engine/worldStore";
import { setArrival } from "../../../engine/arrival";
import { useAetheria } from "../../store";
import { useAetheriaUi } from "../../ui/uiStore";
import { useDialogue } from "../../ui/dialogueRunner";
import { FORCE_TITLES } from "../../core/model";
import { siteState } from "../../core/state";
import { JOURNAL } from "../../content";
import { ECHO_TALK } from "../../content/echoAwakening";
import { CORE_SITE, LANTERNS, M, MIND_SITES, lanternSite, onEnterMind, type LanternId } from "../../content/mindKingdom";
import { resonateSite } from "../sanctuary/SleepingGate";
import { FutureEcho } from "../sanctuary/FutureEcho";
import { isleGeometry } from "../sanctuary/environment";
import { LightPath, type P3 } from "../shared/LightPath";
import { ResonanceFx } from "../../fx/ResonanceFx";
import { PostFx } from "../../../world/PostFx";
import { Arrival } from "../../../world/Arrival";
import { SoundController, DustMotes } from "../sanctuary/Life";
import { DREAMS_GATE_ARRIVAL } from "../health/layout";
import { BRIDGES, FALL_Y, ISLANDS, LANTERN_SPOTS, MIRROR_Y, SPAWN, WAYSTONE } from "./layout";

const ease = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const mirrorY = (y: number) => 2 * MIRROR_Y - y;

/** The translucent, inverted look of everything in the mirror-world. */
function useGhost() {
  return useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xcfc2ff, emissive: new THREE.Color("#5a46a0"), emissiveIntensity: 0.6, roughness: 0.4, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }),
    [],
  );
}

// ------------------------------------------------------------------ islands (real + mirrored)
function Island({ x, y, z, r, seed }: { x: number; y: number; z: number; r: number; seed: number }) {
  const marble = usePBR("granite", { tint: 0xe9e4f2 });
  const ghost = useGhost();
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xd9b46a, metalness: 1, roughness: 0.25 }), []);
  const under = useMemo(() => isleGeometry(seed), [seed]);
  const top = useMemo(() => {
    const g = new THREE.CylinderGeometry(r, r * 0.96, 0.5, 48);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 2.5, p.getZ(i) / 2.5);
    return g;
  }, [r]);
  const S = r * 1.1;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.25, r]} position={[x, y - 0.25, z]} />
      </RigidBody>
      <mesh geometry={top} material={marble} position={[x, y - 0.25, z]} receiveShadow castShadow />
      <mesh material={gold} position={[x, y - 0.03, z]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[r, 0.08, 8, 72]} />
      </mesh>
      <group position={[x, y - 0.5 - 0.12 * S, z]} scale={[S, S * 1.3, S]}>
        <mesh geometry={under} material={marble} />
      </group>
      {/* its reflection, hanging upside down in the mirror-world */}
      <group position={[0, 2 * MIRROR_Y, 0]} scale={[1, -1, 1]}>
        <mesh geometry={top} material={ghost} position={[x, y - 0.25, z]} />
        <group position={[x, y - 0.5 - 0.12 * S, z]} scale={[S, S * 1.3, S]}>
          <mesh geometry={under} material={ghost} />
        </group>
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ bridges: reflected -> real
function bridgeStrip(points: P3[], width: number) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const N = 48;
  const pos: number[] = [];
  const mir: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const c = curve.getPointAt(u);
    const side = new THREE.Vector3().crossVectors(curve.getTangentAt(u), up).normalize().multiplyScalar(width / 2);
    for (const s of [-1, 1]) {
      pos.push(c.x + side.x * s, c.y + 0.03, c.z + side.z * s);
      mir.push(c.x + side.x * s, mirrorY(c.y + 0.03), c.z + side.z * s);
    }
    uv.push(u, 0, u, 1);
    if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aMirror", new THREE.Float32BufferAttribute(mir, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
const stripVert = `attribute vec3 aMirror; uniform float uT; varying vec2 vUv; varying float vT;
  void main(){ vUv = uv; vT = uT;
    // the bridge travels from its reflection down into the world, folding over the mirror line
    float k = uT * uT * (3.0 - 2.0 * uT);
    vec3 p = mix(aMirror, position, k);
    p.y += sin(k * 3.14159) * 3.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const stripFrag = `uniform float uTime; varying vec2 vUv; varying float vT;
  void main(){ float edge = smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
    float flow = 0.6 + 0.4 * sin(vUv.x * 50.0 - uTime * 3.0);
    vec3 col = mix(vec3(0.75, 0.6, 1.0), vec3(1.0, 0.85, 0.95), vT) * (0.5 + 0.5 * flow);
    gl_FragColor = vec4(col * 1.3, edge * 0.85); }`;

function Bridge({ points, real }: { points: P3[]; real: boolean }) {
  const geo = useMemo(() => bridgeStrip(points, 2.4), [points]);
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: stripVert, fragmentShader: stripFrag, uniforms: { uT: { value: 0 }, uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), []);
  const t = useRef(-1);
  const done = useRef(false);
  useFrame(({ clock }, dt) => {
    // restored worlds: the bridge is simply there; realised now: it descends over ~2.5 s
    if (t.current < 0) t.current = real ? 1 : 0;
    t.current = real ? Math.min(1, t.current + Math.min(dt, 0.1) / 2.5) : 0;
    mat.uniforms.uT.value = t.current;
    mat.uniforms.uTime.value = clock.elapsedTime;
    done.current = t.current >= 1;
  });
  return (
    <group userData={{ noBatch: true }}>
      {/* always visible in the mirror-world (the hint), descending when realised */}
      <mesh geometry={geo} material={mat} frustumCulled={false} />
      {real && <WalkableWhenSettled points={points} done={done} />}
    </group>
  );
}
/** colliders (and the solid ribbon) only once the bridge has settled into the real world */
function WalkableWhenSettled({ points, done }: { points: P3[]; done: { current: boolean } }) {
  const shown = useRef<THREE.Group>(null);
  const settled = useRef(false);
  useFrame(() => {
    if (!settled.current && done.current) settled.current = true;
    if (shown.current) shown.current.visible = settled.current;
  });
  return (
    <group ref={shown} visible={false}>
      <LightPath points={points} width={2.2} color="#f2c8ff" />
    </group>
  );
}

// ------------------------------------------------------------------ lanterns and the Sleeping Mind
function Lantern({ id, index }: { id: LanternId; index: number }) {
  const marble = usePBR("granite", { tint: 0xe9e4f2 });
  const spot = LANTERN_SPOTS[index];
  const real = useAetheria((s) => siteState(s.world, MIND_SITES[lanternSite(id)]) === "real");
  const power = useAetheriaUi((s) => s.power);
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x1a1426, emissive: new THREE.Color("#b48cff"), emissiveIntensity: 0.4, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85 }), []);
  useFrame(({ clock }) => {
    glass.emissive.set(real ? "#ffd6f0" : "#b48cff");
    glass.emissiveIntensity = real ? 2.6 + Math.sin(clock.elapsedTime * 2) * 0.3 : 0.5 + Math.sin(clock.elapsedTime * 1.3) * 0.2;
  });
  useEffect(() => {
    if (real) return;
    const key = `lantern-${id}`;
    interactables.set(key, {
      id: key,
      label: power ? `הפעילו ${FORCE_TITLES[power]}: פנס המראה` : "פנס המראה: בחרו כוח",
      x: spot.x,
      y: spot.y,
      z: spot.z,
      radius: 2.2,
      onContact: () => {
        resonateSite(lanternSite(id), { x: spot.x, y: spot.y + 1.6, z: spot.z });
        if (useAetheria.getState().lastRejection === "resonance:not_ready") useAetheriaUi.getState().say("הגשר הקודם עדיין רק השתקפות.");
      },
    });
    return () => void interactables.delete(key);
  }, [real, power, id, spot.x, spot.y, spot.z]);
  return (
    <group position={[spot.x, spot.y, spot.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.6, 0.35]} position={[0, 0.6, 0]} />
      </RigidBody>
      <mesh material={marble} position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.38, 1.2, 8]} />
      </mesh>
      <mesh material={glass} position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.7, 6]} />
      </mesh>
    </group>
  );
}

function SleepingMind() {
  const isl = ISLANDS.core;
  const awake = useAetheria((s) => siteState(s.world, MIND_SITES[CORE_SITE]) === "awake");
  const allReal = useAetheria((s) => LANTERNS.every((l) => siteState(s.world, MIND_SITES[lanternSite(l)]) === "real"));
  const power = useAetheriaUi((s) => s.power);
  const marble = usePBR("granite", { tint: 0xf2eef8 });
  const eye = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpen: { value: 0 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform float uTime; uniform float uOpen; varying vec2 vUv;
          void main(){ vec2 p = (vUv - 0.5) * 2.0; float r = length(p); float a = atan(p.y, p.x);
            // a lid: an almond slit that widens as it wakes
            float lid = 0.06 + 0.94 * uOpen;
            float inEye = step(abs(p.y), lid * (1.0 - p.x * p.x));
            float swirl = 0.5 + 0.5 * sin(a * 5.0 + r * 9.0 - uTime * 0.8);
            vec3 iris = mix(vec3(0.55, 0.3, 0.95), vec3(0.4, 0.95, 1.0), swirl) * smoothstep(0.75, 0.2, r);
            vec3 pupil = vec3(1.0, 0.9, 0.98) * smoothstep(0.16, 0.05, r) * uOpen;
            vec3 col = (iris + pupil) * inEye * (0.4 + 0.9 * uOpen);
            gl_FragColor = vec4(col * 1.6, inEye * smoothstep(1.0, 0.92, r)); }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  const beams = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd6f0").multiplyScalar(1.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  const eyePos = new THREE.Vector3(isl.x, isl.y + 7, isl.z);
  const beamGeo = useMemo(
    () =>
      LANTERN_SPOTS.map((s) => {
        const from = new THREE.Vector3(s.x, s.y + 1.6, s.z);
        const mid = from.clone().add(eyePos).multiplyScalar(0.5);
        const len = from.distanceTo(eyePos);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), eyePos.clone().sub(from).normalize());
        return { mid, len, q };
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const ring = useRef<THREE.Group>(null);
  const open = useRef(-1);
  useFrame(({ clock, camera }, dt) => {
    if (open.current < 0) open.current = awake ? 1 : 0;
    open.current += ((awake ? 1 : 0) - open.current) * (1 - Math.exp(-0.8 * Math.min(dt, 0.1)));
    eye.uniforms.uTime.value = clock.elapsedTime;
    eye.uniforms.uOpen.value = open.current;
    beams.opacity = open.current * 0.45;
    // the eye turns toward you (it is awake, after all) — and drifts while it sleeps
    if (ring.current) {
      const want = Math.atan2(camera.position.x - eyePos.x, camera.position.z - eyePos.z);
      ring.current.rotation.y += (want - ring.current.rotation.y) * (awake ? 0.05 : 0.005);
      ring.current.position.y = eyePos.y + Math.sin(clock.elapsedTime * 0.5) * 0.3;
    }
  });
  useEffect(() => {
    if (awake) return;
    interactables.set("core", {
      id: "core",
      label: power ? `הפעילו ${FORCE_TITLES[power]}: התודעה הישנה` : "התודעה הישנה: בחרו כוח",
      x: isl.x,
      y: isl.y,
      z: isl.z,
      radius: 3,
      onContact: () => {
        resonateSite(CORE_SITE, { x: isl.x, y: isl.y + 5, z: isl.z });
        if (useAetheria.getState().lastRejection === "resonance:not_ready") useAetheriaUi.getState().say("שלושת הפנסים עוד לא דולקים בעולם האמיתי.");
      },
    });
    return () => void interactables.delete("core");
  }, [awake, power, isl.x, isl.y, isl.z]);
  return (
    <group userData={{ noBatch: true }}>
      <group ref={ring} position={eyePos}>
        <mesh material={marble} castShadow>
          <torusGeometry args={[3.4, 0.45, 16, 72]} />
        </mesh>
        <mesh material={eye}>
          <circleGeometry args={[3.0, 64]} />
        </mesh>
      </group>
      {(allReal || awake) &&
        beamGeo.map((b, i) => (
          <mesh key={i} material={beams} position={b.mid} quaternion={b.q}>
            <cylinderGeometry args={[0.04, 0.12, b.len, 8, 1, true]} />
          </mesh>
        ))}
    </group>
  );
}

// ------------------------------------------------------------------ the dreamscape around
function Dreamscape() {
  const marble = usePBR("granite", { tint: 0xe9e4f2 });
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xd9b46a, metalness: 1, roughness: 0.25 }), []);
  const doorGlow = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#b8a8ff").multiplyScalar(1.4), transparent: true, opacity: 0.6, side: THREE.DoubleSide, toneMapped: false }), []);
  const items = useMemo(() => {
    const r = rng(61);
    const stairs = Array.from({ length: 4 }, () => {
      const a = r() * Math.PI * 2;
      const d = 45 + r() * 25;
      return { x: Math.cos(a) * d, y: 6 + r() * 30, z: Math.sin(a) * d, rot: [r() * 6, r() * 6, r() * 6] as [number, number, number], spin: (r() - 0.5) * 0.08 };
    });
    const doors = Array.from({ length: 7 }, () => {
      const a = r() * Math.PI * 2;
      const d = 32 + r() * 30;
      return { x: Math.cos(a) * d, y: -4 + r() * 24, z: Math.sin(a) * d, yaw: r() * 6, tilt: (r() - 0.5) * 0.6 };
    });
    return { stairs, doors };
  }, []);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame((_, dt) => refs.current.forEach((g, i) => g && ((g.rotation.y += dt * items.stairs[i].spin), (g.rotation.x += dt * items.stairs[i].spin * 0.5))));
  return (
    <group userData={{ noBatch: true }}>
      {/* stairs that turn back on themselves */}
      {items.stairs.map((s, i) => (
        <group key={i} ref={(el) => void (refs.current[i] = el)} position={[s.x, s.y, s.z]} rotation={s.rot}>
          {Array.from({ length: 4 }, (_, side) => (
            <group key={side} rotation-y={(side * Math.PI) / 2}>
              {Array.from({ length: 6 }, (_, k) => (
                <mesh key={k} material={marble} position={[-3 + k, k * 0.5 + side * 3, 3]}>
                  <boxGeometry args={[1, 0.3, 2]} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
      {/* doors standing alone in the void */}
      {items.doors.map((d, i) => (
        <group key={i} position={[d.x, d.y, d.z]} rotation={[d.tilt, d.yaw, 0]}>
          <mesh material={gold} position={[-1.1, 2, 0]}>
            <boxGeometry args={[0.2, 4.2, 0.2]} />
          </mesh>
          <mesh material={gold} position={[1.1, 2, 0]}>
            <boxGeometry args={[0.2, 4.2, 0.2]} />
          </mesh>
          <mesh material={gold} position={[0, 4.1, 0]}>
            <boxGeometry args={[2.4, 0.2, 0.2]} />
          </mesh>
          <mesh material={doorGlow} position={[0, 2, 0]}>
            <planeGeometry args={[2, 4]} />
          </mesh>
        </group>
      ))}
      {/* the mirror line: a faint luminous plane between the worlds */}
      <mesh position={[0, MIRROR_Y, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[160, 64]} />
        <meshBasicMaterial color={new THREE.Color("#c8b8ff")} transparent opacity={0.06} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ the Echo, the way back, story
const ECHO_SPOT = { x: ISLANDS.core.x - 3.5, y: ISLANDS.core.y, z: ISLANDS.core.z + 3.5 };
function EchoInMind() {
  const stage = useAetheria((s) => s.world.echo);
  const inDialogue = useDialogue((s) => !!s.defId);
  const awake = stage !== "dormant" && stage !== "silent_observer";
  useEffect(() => {
    if (!awake || inDialogue) {
      interactables.delete("echo-m");
      return;
    }
    interactables.set("echo-m", { id: "echo-m", label: "לדבר עם הד העתיד", x: ECHO_SPOT.x - 0.6, y: ECHO_SPOT.y, z: ECHO_SPOT.z + 0.6, radius: 2.2, onContact: () => useDialogue.getState().open(ECHO_TALK) });
    return () => void interactables.delete("echo-m");
  }, [awake, inDialogue]);
  return <FutureEcho stage={stage} anchors={[ECHO_SPOT]} waitAnchor={ECHO_SPOT} waiting inDialogue={inDialogue} tint={{ color: "#e2c8ff", accent: "#fff0fb", veils: ["#c08cff", "#8ff0ff"] }} />;
}

function Waystone() {
  const stone = usePBR("granite", { tint: 0xd8d2e6 });
  const rune = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: new THREE.Color("#ffd6f0"), emissiveIntensity: 2.5 }), []);
  useEffect(() => {
    if (!worldAvailable("health")) return;
    interactables.set("waystone-m", {
      id: "waystone-m",
      label: "אבן הדרך: חזרה אל חורשת החיים",
      x: WAYSTONE.x - 1,
      y: 0,
      z: WAYSTONE.z,
      radius: 1.8,
      onContact: () => {
        setArrival("health", DREAMS_GATE_ARRIVAL);
        void goToWorld("health", { style: "resonance" });
      },
    });
    return () => void interactables.delete("waystone-m");
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
    if (st.world.flags.includes(M.entered)) return;
    const before = st.world.journal.length;
    if (st.dispatch(onEnterMind())) {
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
    useAetheriaUi.getState().say("ההשתקפות תפסה אותך והחזירה אותך לאי הראשון.");
  });
  return null;
}

export function MindScene({ quality }: { quality: Quality }) {
  // a string, not an array: a zustand selector returning a new array re-renders forever
  const key = useAetheria((s) => LANTERNS.map((l) => siteState(s.world, MIND_SITES[lanternSite(l)]) === "real").join(","));
  const bridges = useMemo(() => BRIDGES.map((b, i) => ({ points: b, real: key.split(",")[i] === "true" })), [key]);
  return (
    <group>
      <Island {...ISLANDS.first} seed={121} />
      <Island {...ISLANDS.second} seed={122} />
      <Island {...ISLANDS.third} seed={123} />
      <Island {...ISLANDS.core} seed={124} />
      {bridges.map((b, i) => (
        <Bridge key={i} points={b.points} real={b.real} />
      ))}
      {LANTERNS.map((l, i) => (
        <Lantern key={l} id={l} index={i} />
      ))}
      <SleepingMind />
      <Dreamscape />
      <EchoInMind />
      <Waystone />
      <Story />
      <Arrival world="mind" />
      <ResonanceFx />
      <PostFx quality={quality} />
      <SoundController />
      <DustMotes count={quality === "low" ? 100 : 220} />
    </group>
  );
}
