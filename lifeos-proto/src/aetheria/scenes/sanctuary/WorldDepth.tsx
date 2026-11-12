/**
 * World Depth (Phase 5) in the First Sanctuary:
 *   - the light bridge becomes walkable once the gate is awake (colliders along its path), and
 *     leads to a floating isle with the sealed threshold of the first kingdom (Knowledge)
 *   - three hidden memory shards (optional), the third revealed by the star lens
 *   - the cracked star lens on the gallery: CHANGE makes it whole (engine-validated resonance site),
 *     and it focuses starlight onto the floor's star chart
 *   - fall recovery: falling off the island or the bridge brings you back
 * Every world change is an engine action; this file renders state and offers interactions.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { usePBR } from "../../../world/materials";
import { interactables } from "../../../store";
import { telemetry } from "../../../player/Player";
import { playerCommands, playerReactions } from "../../../engine/events";
import { useAetheria } from "../../store";
import { useAetheriaUi } from "../../ui/uiStore";
import { FORCE_TITLES } from "../../core/model";
import { siteState } from "../../core/state";
import { JOURNAL } from "../../content";
import { F as F1 } from "../../content/firstResonance";
import { G } from "../../content/sleepingGate";
import { D, DEPTH_SITES, LENS_SITE, MEMORIES, memoryVisible, onIsle, onMemory, onThreshold, type MemoryId } from "../../content/worldDepth";
import { sfx } from "../../audio/soundscape";
import { BRIDGE_PATH, GATE, ISLE, MEMORY_SPOTS, SPAWN, STAR_LENS } from "./layout";
import { isleGeometry } from "./environment";
import { useSanctuaryKit } from "./architecture";
import { kingdomGlyph } from "./glyphs";
import { resonateSite } from "./SleepingGate";

const showJournal = (ids: string[], tone: "discovery" | "resonance" | "echo" = "discovery") => {
  for (const id of ids) {
    const j = JOURNAL[id];
    if (j) useAetheriaUi.getState().showCard({ title: j.title, body: j.body, tone });
  }
};
const newJournal = (before: number) => useAetheria.getState().world.journal.slice(before).map((j) => j.id);

// ------------------------------------------------------------------ the walkable bridge + the isle
function BridgeAndIsle() {
  const awake = useAetheria((s) => s.world.flags.includes(G.awake));
  const rock = usePBR("rock", { tint: 0x8f8a86 });
  const meadow = usePBR("meadow", { tint: 0xb9c49a });
  const stone = usePBR("ruinwall", { tint: 0xd8d0c2 });
  const kit = useSanctuaryKit();
  // walkable slabs along the bridge (a little wider than the ribbon, forgiving on a phone)
  const slabs = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(BRIDGE_PATH.map((p) => new THREE.Vector3(...p)));
    const N = 28;
    const out: { pos: [number, number, number]; rot: [number, number, number]; len: number }[] = [];
    for (let i = 0; i < N; i++) {
      const a = curve.getPointAt(i / N);
      const b = curve.getPointAt((i + 1) / N);
      const dir = b.clone().sub(a);
      const len = dir.length();
      dir.normalize();
      // yaw then pitch only: no roll, so the slab's width stays level and nobody slides off sideways
      const yaw = Math.atan2(-dir.z, dir.x);
      const pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pitch));
      const e = new THREE.Euler().setFromQuaternion(q);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      const mid = a.clone().add(b).multiplyScalar(0.5).addScaledVector(up, -0.1);
      out.push({ pos: mid.toArray() as [number, number, number], rot: [e.x, e.y, e.z], len: len + 0.15 });
    }
    return out;
  }, []);
  const S = 9;
  const isle = useMemo(() => isleGeometry(97), []);
  const cap = useMemo(() => {
    const g = new THREE.CircleGeometry(0.97, 20);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const sealMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform float uTime; varying vec2 vUv;
          void main(){
            vec2 p = vUv - 0.5; float r = length(p * vec2(1.0, 0.7));
            float rings = 0.5 + 0.5 * sin(r * 40.0 - uTime * 1.5);
            float a = smoothstep(0.62, 0.2, r) * (0.35 + 0.4 * rings);
            gl_FragColor = vec4(vec3(0.25, 0.55, 1.0) * a * 1.4, 1.0);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  const glyphMat = useMemo(() => new THREE.MeshBasicMaterial({ map: kingdomGlyph("knowledge"), color: new THREE.Color("#3f8cff").multiplyScalar(2.2), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), []);
  const glyphRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    sealMat.uniforms.uTime.value = clock.elapsedTime;
    if (glyphRef.current) glyphRef.current.position.y = ISLE.top + 3.2 + Math.sin(clock.elapsedTime * 1.2) * 0.12;
  });
  // the threshold of the first kingdom (front faces the bridge, +X)
  const threshold = { x: ISLE.x - 2.6, z: ISLE.z };
  useEffect(() => {
    if (!awake) return;
    interactables.set("threshold", {
      id: "threshold",
      label: "סף הממלכה הראשונה",
      x: threshold.x + 2.4,
      y: ISLE.top,
      z: threshold.z,
      radius: 2.8,
      onContact: () => {
        const st = useAetheria.getState();
        const before = st.world.journal.length;
        if (st.dispatch(onThreshold())) {
          playerReactions.emit("surprise");
          sfx.echo();
          showJournal(newJournal(before), "resonance");
        }
        useAetheriaUi.getState().say("ממלכת הידע עוד חתומה. הדרך אליה היא הפרק הבא.");
      },
    });
    return () => void interactables.delete("threshold");
  }, [awake, threshold.x, threshold.z]);
  // reaching the isle
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.3) return;
    acc.current = 0;
    const st = useAetheria.getState();
    if (!st.world.flags.includes(G.awake) || st.world.flags.includes(D.isle)) return;
    if (Math.hypot(telemetry.x - ISLE.x, telemetry.z - ISLE.z) < ISLE.r && telemetry.y > ISLE.top - 1) {
      const before = st.world.journal.length;
      if (st.dispatch(onIsle())) showJournal(newJournal(before));
    }
  });
  return (
    <group userData={{ noBatch: true }}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.25, ISLE.r]} position={[ISLE.x, ISLE.top - 0.25, ISLE.z]} />
        {awake && slabs.map((s, i) => <CuboidCollider key={i} args={[s.len / 2, 0.1, 1.15]} position={s.pos} rotation={s.rot} />)}
        {/* the threshold's piers (the sealed opening itself can't be walked through) */}
        <CuboidCollider args={[0.65, 2.2, 3.2]} position={[threshold.x, ISLE.top + 2.2, threshold.z]} />
      </RigidBody>
      <group position={[ISLE.x, ISLE.top - 0.12 * S * 0.9, ISLE.z]} scale={[S, S * 0.9, S]}>
        <mesh geometry={isle} material={rock} />
        <mesh geometry={cap} material={meadow} position-y={0.121} receiveShadow />
      </group>
      <group position={[threshold.x, ISLE.top, threshold.z]} rotation-y={Math.PI / 2} scale={0.72}>
        <mesh geometry={kit.arch_gate} material={stone} castShadow receiveShadow />
        <mesh material={sealMat} position={[0, 2.4, 0]}>
          <planeGeometry args={[3.6, 5.2]} />
        </mesh>
      </group>
      <mesh ref={glyphRef} material={glyphMat} position={[threshold.x + 0.6, ISLE.top + 3.2, threshold.z]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[0.9, 0.9]} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ memory shards
function MemoryShard({ id }: { id: MemoryId }) {
  const spot = MEMORY_SPOTS[id];
  const available = useAetheria((s) => s.world.flags.includes(F1.kingdoms) && memoryVisible(s.world, id));
  const found = useAetheria((s) => s.world.discoveries.includes(id));
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffe2a0").multiplyScalar(1.8), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), []);
  const halo = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#7ff5e1"), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }), []);
  const ref = useRef<THREE.Group>(null);
  const vis = useRef(0);
  useFrame(({ clock }, dt) => {
    const want = available && !found ? 1 : 0;
    vis.current += (want - vis.current) * (1 - Math.exp(-2 * Math.min(dt, 0.1)));
    mat.opacity = vis.current * (0.8 + 0.2 * Math.sin(clock.elapsedTime * 3));
    halo.opacity = vis.current * 0.35;
    if (ref.current) {
      ref.current.visible = vis.current > 0.01;
      ref.current.rotation.y += dt * 0.8;
      ref.current.position.y = spot.y + 1.1 + Math.sin(clock.elapsedTime * 1.6) * 0.1;
    }
  });
  useEffect(() => {
    if (!available || found) return;
    const key = `memory-${id}`;
    interactables.set(key, {
      id: key,
      label: "רסיס זיכרון",
      x: spot.x,
      y: spot.y,
      z: spot.z,
      radius: 1.8,
      onContact: () => {
        const st = useAetheria.getState();
        const before = st.world.journal.length;
        if (st.dispatch(onMemory(st.world, id))) {
          sfx.echo();
          playerReactions.emit("acknowledge");
          showJournal(newJournal(before), "echo");
        }
      },
    });
    return () => void interactables.delete(key);
  }, [available, found, id, spot.x, spot.y, spot.z]);
  return (
    <group ref={ref} position={[spot.x, spot.y + 1.1, spot.z]} userData={{ noBatch: true }}>
      <mesh material={mat} scale={[0.12, 0.24, 0.12]}>
        <octahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh material={halo} rotation-x={Math.PI / 2}>
        <ringGeometry args={[0.28, 0.36, 24]} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ the star lens on the gallery
function StarLens() {
  const world = useAetheria((s) => s.world);
  const power = useAetheriaUi((s) => s.power);
  const whole = siteState(world, DEPTH_SITES[LENS_SITE]) === "whole";
  const canTry = world.flags.includes(F1.kingdoms) && (world.powers ?? []).length > 0;
  const brass = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 1, roughness: 0.3 }), []);
  const glass = useMemo(() => new THREE.MeshPhysicalMaterial({ color: 0x0d0b14, roughness: 0.1, metalness: 0.2, clearcoat: 1, transparent: true, opacity: 0.85, emissive: new THREE.Color("#7ff5e1"), emissiveIntensity: 0 }), []);
  const crackMat = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.strokeStyle = "#fff";
    g.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.moveTo(64, 64);
      let x = 64;
      let y = 64;
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.4;
      for (let k = 0; k < 5; k++) {
        x += Math.cos(a + (Math.random() - 0.5) * 0.8) * 12;
        y += Math.sin(a + (Math.random() - 0.5) * 0.8) * 12;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.9, depthWrite: false, color: 0xd9e6ff });
  }, []);
  const beamMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#bff8ff").multiplyScalar(1.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  const lensPos = new THREE.Vector3(STAR_LENS.x, STAR_LENS.y + 1.05, STAR_LENS.z);
  const target = MEMORY_SPOTS.memory_star_chart;
  const beam = useMemo(() => {
    const to = new THREE.Vector3(target.x, target.y + 0.02, target.z);
    const mid = lensPos.clone().add(to).multiplyScalar(0.5);
    const len = lensPos.distanceTo(to);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(lensPos).normalize());
    return { mid, len, q };
  }, [target.x, target.y, target.z]); // eslint-disable-line react-hooks/exhaustive-deps
  const faceYaw = Math.atan2(target.x - STAR_LENS.x, target.z - STAR_LENS.z);
  const t0 = useRef(-1);
  useFrame(({ clock }, dt) => {
    if (whole && t0.current < 0) t0.current = clock.elapsedTime;
    const on = whole ? Math.min(1, (clock.elapsedTime - t0.current) / 2) : 0;
    glass.emissiveIntensity = on * (1.6 + Math.sin(clock.elapsedTime * 2) * 0.3);
    glass.opacity = whole ? 0.55 : 0.85;
    crackMat.opacity = whole ? Math.max(0, crackMat.opacity - dt) : 0.9;
    beamMat.opacity = on * (0.45 + Math.sin(clock.elapsedTime * 1.7) * 0.08);
  });
  useEffect(() => {
    if (whole || !canTry) return;
    const id = "site-star_lens";
    interactables.set(id, {
      id,
      label: power ? `הפעילו ${FORCE_TITLES[power]}: ${DEPTH_SITES[LENS_SITE].title}` : `${DEPTH_SITES[LENS_SITE].title}: בחרו כוח`,
      x: STAR_LENS.x,
      y: STAR_LENS.y,
      z: STAR_LENS.z,
      radius: 1.7,
      onContact: () => resonateSite(LENS_SITE, { x: STAR_LENS.x, y: STAR_LENS.y + 1.05, z: STAR_LENS.z }),
    });
    return () => void interactables.delete(id);
  }, [whole, canTry, power]);
  return (
    <group userData={{ noBatch: true }}>
      <group position={[STAR_LENS.x, STAR_LENS.y, STAR_LENS.z]} rotation-y={faceYaw}>
        <mesh material={brass} position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.05, 0.08, 0.9, 10]} />
        </mesh>
        <group position={[0, 1.05, 0]} rotation-x={-0.55}>
          <mesh material={brass}>
            <torusGeometry args={[0.32, 0.035, 10, 40]} />
          </mesh>
          <mesh material={glass}>
            <circleGeometry args={[0.3, 32]} />
          </mesh>
          <mesh material={crackMat} position-z={0.004}>
            <circleGeometry args={[0.3, 32]} />
          </mesh>
        </group>
      </group>
      <mesh material={beamMat} position={beam.mid} quaternion={beam.q}>
        <cylinderGeometry args={[0.015, 0.09, beam.len, 10, 1, true]} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ fall recovery
function FallRecovery() {
  const cooldown = useRef(0);
  useFrame((_, dt) => {
    cooldown.current = Math.max(0, cooldown.current - dt);
    if (telemetry.y > -6 || cooldown.current > 0) return;
    cooldown.current = 1.5;
    const awake = useAetheria.getState().world.flags.includes(G.awake);
    // back to the top of the dais by the gate (or the plateau's start), facing the bridge
    if (awake) playerCommands.teleport(GATE.x - GATE.half + 1.2, GATE.h + 0.2, GATE.z, -Math.PI / 2);
    else playerCommands.teleport(SPAWN.x, SPAWN.y + 0.3, SPAWN.z, SPAWN.yaw);
    useAetheriaUi.getState().say("האור תפס אותך והחזיר אותך לקרקע.");
  });
  return null;
}

export function WorldDepth() {
  return (
    <>
      <BridgeAndIsle />
      {MEMORIES.map((m) => (
        <MemoryShard key={m} id={m} />
      ))}
      <StarLens />
      <FallRecovery />
    </>
  );
}
