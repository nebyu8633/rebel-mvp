/**
 * The Sleeping Gate (Phase 3 — Resonance gameplay) at the west edge of the plateau.
 *   FORM        steps of light-stone rise against the dais (new colliders: a way up)
 *   CHANGE      the fallen pillar turns upright (its collider changes from lying to standing)
 *   CONNECTION  a thread of light joins the two pillar crystals; the gate fills with light and a
 *               bridge reaches out toward the floating isles
 * The player picks a power in the HUD and uses it on a site. The rules engine decides whether it
 * works (right force, right order); rejected casts fizzle and say why. Nothing here changes the
 * world directly: every change is an engine action, and the scene renders the resulting state.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { usePBR } from "../../../world/materials";
import { worldBox, worldCylinder } from "../../../world/geometry";
import { interactables } from "../../../store";
import { telemetry } from "../../../player/Player";
import { playerReactions } from "../../../engine/events";
import { useAetheria } from "../../store";
import { useAetheriaUi } from "../../ui/uiStore";
import { FORCE_TITLES } from "../../core/model";
import { siteState } from "../../core/state";
import { E } from "../../content/echoAwakening";
import { G, GATE_SITES, REJECT_TEXT, SITE, onGateFound } from "../../content/sleepingGate";
import { JOURNAL } from "../../content";
import { casts } from "../../fx/casts";
import { GATE, gateStep } from "./layout";

const P = { x: GATE.pillarX, north: GATE.z - GATE.pillarZ, south: GATE.z + GATE.pillarZ };
const CRYSTAL_Y = GATE.h + GATE.pillarH + 0.45;
const STEP_W = 2.4;
const RAMP = { x0: GATE.x + GATE.half + GATE.steps * GATE.stepRun, x1: GATE.x + GATE.half };
const ISLE = { x: -88, y: 24, z: -8 };

const ease = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Use the selected power on a site: the engine validates, the scene shows the outcome. */
export function resonateSite(site: string, at: { x: number; y: number; z: number }) {
  const ui = useAetheriaUi.getState();
  const f = ui.power;
  if (!f) {
    ui.say("בחרו כוח בסרגל הכוחות (או במקשים 1, 2, 3)");
    return;
  }
  const st = useAetheria.getState();
  const before = st.world.journal.length;
  const ok = st.dispatch([{ type: "resonate", site, force: f }]);
  casts.emit({ force: f, ok, at, from: { x: telemetry.x, y: telemetry.y + 1.3, z: telemetry.z } });
  if (!ok) {
    ui.say(REJECT_TEXT[useAetheria.getState().lastRejection ?? ""] ?? "הכוח מתפזר.");
    return;
  }
  const fresh = useAetheria.getState().world.journal.slice(before);
  const awake = fresh.some((j) => j.id === "j.gate");
  playerReactions.emit(awake ? "celebrate" : "acknowledge");
  for (const j of fresh) {
    const text = JOURNAL[j.id];
    if (text) ui.showCard({ title: text.title, body: text.body, tone: awake ? "resonance" : "discovery" });
  }
}

function useGradient(stops: [number, string][]) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 128;
    const g = c.getContext("2d")!;
    const grd = g.createLinearGradient(0, 128, 0, 0);
    for (const [o, col] of stops) grd.addColorStop(o, col);
    g.fillStyle = grd;
    g.fillRect(0, 0, 4, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

export function SleepingGate() {
  const stone = usePBR("ruinwall", { tint: 0xd8d0c2 });
  const rock = usePBR("rock", { tint: 0x9d9a94 });
  const world = useAetheria((s) => s.world);
  const hydrated = useAetheria((s) => s.hydrated);
  const power = useAetheriaUi((s) => s.power);

  const formed = siteState(world, GATE_SITES[SITE.steps]) === "formed";
  const standing = siteState(world, GATE_SITES[SITE.pillar]) === "standing";
  const linked = siteState(world, GATE_SITES[SITE.link]) === "linked";
  const canUse = world.flags.includes(E.bondChosen) && (world.powers ?? []).length > 0;

  // ---- geometry / materials
  const daisGeo = useMemo(() => worldBox(GATE.half * 2, GATE.h, GATE.half * 2, 2), []);
  const rimGeo = useMemo(() => worldBox(GATE.half * 2 + 0.3, 0.18, GATE.half * 2 + 0.3, 2), []);
  const pillarGeo = useMemo(() => worldCylinder(0.42, 0.5, GATE.pillarH, 1.5, 14), []);
  const capGeo = useMemo(() => worldBox(1.15, 0.3, 1.15, 1.5), []);
  // base at y = 0 so the steps grow up out of the ground
  const stepGeos = useMemo(() => Array.from({ length: GATE.steps }, (_, i) => worldBox(GATE.stepRun, gateStep(i).topY, STEP_W, 1.5).translate(0, gateStep(i).topY / 2, 0)), []);
  const stepGlowGeos = useMemo(() => Array.from({ length: GATE.steps }, (_, i) => new THREE.BoxGeometry(GATE.stepRun + 0.06, gateStep(i).topY + 0.06, STEP_W + 0.06).translate(0, gateStep(i).topY / 2, 0)), []);
  const formGlow = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), []);
  const changeGlow = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xc4a7ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), []);
  const crystalN = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x7ff5e1, emissiveIntensity: 0.6, roughness: 0.3 }), []);
  const crystalS = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x7ff5e1, emissiveIntensity: 0.15, roughness: 0.3 }), []);
  const beamMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x9ffff0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), []);
  const portalTex = useGradient([
    [0, "rgba(90,235,215,.9)"],
    [0.55, "rgba(140,200,255,.55)"],
    [1, "rgba(255,226,160,.05)"],
  ]);
  // normal blending: additive light vanishes against the bright sky behind the gate
  const portalMat = useMemo(() => new THREE.MeshBasicMaterial({ map: portalTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), [portalTex]);
  const bridgeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), []);
  const bridgeGeo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(GATE.x - GATE.half, GATE.h + 0.05, GATE.z),
      new THREE.Vector3(-44, 6, GATE.z),
      new THREE.Vector3(-66, 17, GATE.z + 2),
      new THREE.Vector3(ISLE.x + 5, ISLE.y + 1.2, ISLE.z),
    ]);
    // a flat ribbon of light (1.4 m wide) following the curve, widening slightly as it rises
    const N = 140;
    const pos: number[] = [];
    const idx: number[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const c = curve.getPointAt(u);
      const side = new THREE.Vector3().crossVectors(curve.getTangentAt(u), up).normalize().multiplyScalar(0.7 + u * 0.5);
      pos.push(c.x - side.x, c.y, c.z - side.z, c.x + side.x, c.y, c.z + side.z);
      if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }, []);
  const isleGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(1, 1.6, 8, 3);
    g.rotateX(Math.PI);
    return g;
  }, []);

  // ---- animation state (0..1). Restored worlds snap; changes made now animate.
  const anim = useRef({ steps: 0, pillar: 0, link: 0, snapped: false });
  const stepRefs = useRef<(THREE.Mesh | null)[]>([]);
  const glowRefs = useRef<(THREE.Mesh | null)[]>([]);
  const pillarRef = useRef<THREE.Group>(null);
  const pillarGlowRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const a = anim.current;
    const target = { steps: formed ? 1 : 0, pillar: standing ? 1 : 0, link: linked ? 1 : 0 };
    if (!hydrated || !a.snapped) {
      Object.assign(a, target);
      if (hydrated) a.snapped = true;
    } else {
      a.steps = target.steps ? Math.min(1, a.steps + dt / 2.2) : 0;
      a.pillar = target.pillar ? Math.min(1, a.pillar + dt / 2.6) : 0;
      a.link = target.link ? Math.min(1, a.link + dt / 3.2) : 0;
    }
    // FORM: steps grow one after another, glowing gold while they form
    for (let i = 0; i < GATE.steps; i++) {
      const p = ease(a.steps * (GATE.steps + 1) - i);
      const m = stepRefs.current[i];
      if (m) {
        m.visible = p > 0.001;
        m.scale.y = Math.max(0.001, p);
      }
      const gm = glowRefs.current[i];
      if (gm) {
        gm.visible = p > 0.001 && p < 0.999;
        gm.scale.y = Math.max(0.001, p);
      }
    }
    formGlow.opacity = 0.55 * Math.sin(Math.PI * Math.min(1, a.steps));
    // CHANGE: the pillar swings upright on its base
    const pp = ease(a.pillar);
    if (pillarRef.current) {
      pillarRef.current.rotation.z = (-Math.PI / 2) * (1 - pp);
      pillarRef.current.position.y = GATE.h + 0.48 * (1 - pp);
    }
    changeGlow.opacity = 0.6 * Math.sin(Math.PI * Math.min(1, a.pillar));
    if (pillarGlowRef.current) pillarGlowRef.current.visible = changeGlow.opacity > 0.01;
    crystalS.emissiveIntensity = standing ? 0.6 + a.link * 2 : 0.15;
    // CONNECTION: the thread draws across, then the gate and the bridge light up
    const lp = a.link;
    const thread = ease(lp / 0.4);
    if (beamRef.current) {
      beamRef.current.visible = thread > 0.001;
      beamRef.current.scale.set(1, Math.max(0.001, thread), 1);
      beamRef.current.position.z = P.north + (GATE.pillarZ * 2 * thread) / 2;
    }
    const pulse = 0.85 + Math.sin(clock.elapsedTime * 2.2) * 0.15;
    beamMat.opacity = thread * 0.9 * pulse;
    crystalN.emissiveIntensity = 0.6 + lp * 2 * pulse;
    portalMat.opacity = ease((lp - 0.3) / 0.4) * 0.9 * pulse;
    portalTex.offset.y = (clock.elapsedTime * 0.15) % 1;
    const bp = ease((lp - 0.5) / 0.5);
    bridgeMat.opacity = bp * 0.9;
    const idx = bridgeGeo.index!.count;
    bridgeGeo.setDrawRange(0, Math.floor((idx * bp) / 6) * 6);
  });

  // ---- story trigger: finding the gate
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.3) return;
    acc.current = 0;
    const st = useAetheria.getState();
    const s = st.world;
    if (!st.hydrated || !s.flags.includes(E.bondChosen) || s.flags.includes(G.found)) return;
    if (Math.hypot(telemetry.x - GATE.x, telemetry.z - GATE.z) < 11 && st.dispatch(onGateFound())) {
      useAetheriaUi.getState().say("השער הישן. הבמה גבוהה מדי לטפס. אולי צורה תבנה דרך?");
    }
  });

  // ---- resonance sites (interaction points). Every site is offered whatever power is selected:
  // choosing the right force is the puzzle, and the engine is the judge.
  useEffect(() => {
    const sites = [
      { id: SITE.steps, done: formed, x: RAMP.x0 + 1.0, y: 0, z: GATE.z, r: 2.3, fx: { x: RAMP.x0 - 1.2, y: 0.8, z: GATE.z } },
      { id: SITE.pillar, done: standing, x: P.x + 2.2, y: GATE.h, z: P.south - 1.3, r: 1.9, fx: { x: P.x + 2, y: GATE.h + 0.6, z: P.south } },
      { id: SITE.link, done: linked, x: P.x + 1.3, y: GATE.h, z: GATE.z - 0.6, r: 1.6, fx: { x: P.x, y: CRYSTAL_Y, z: GATE.z } },
    ];
    const ids: string[] = [];
    for (const s of sites) {
      if (s.done || !canUse) continue;
      const id = `site-${s.id}`;
      ids.push(id);
      const title = GATE_SITES[s.id].title;
      interactables.set(id, {
        id,
        label: power ? `הפעילו ${FORCE_TITLES[power]}: ${title}` : `${title}: בחרו כוח`,
        x: s.x,
        y: s.y,
        z: s.z,
        radius: s.r,
        onContact: () => resonateSite(s.id, s.fx),
      });
    }
    return () => ids.forEach((id) => interactables.delete(id));
  }, [formed, standing, linked, canUse, power]);

  const rampL = Math.hypot(RAMP.x0 - RAMP.x1, GATE.h);
  const rampA = Math.atan2(GATE.h, RAMP.x0 - RAMP.x1);
  const T = 0.1;

  return (
    <group userData={{ noBatch: true }}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[GATE.half, GATE.h / 2, GATE.half]} position={[GATE.x, GATE.h / 2, GATE.z]} />
        <CylinderCollider args={[GATE.pillarH / 2, 0.5]} position={[P.x, GATE.h + GATE.pillarH / 2, P.north]} />
        {standing ? (
          <CylinderCollider args={[GATE.pillarH / 2, 0.5]} position={[P.x, GATE.h + GATE.pillarH / 2, P.south]} />
        ) : (
          <CuboidCollider args={[GATE.pillarH / 2, 0.48, 0.48]} position={[P.x + GATE.pillarH / 2, GATE.h + 0.48, P.south]} />
        )}
        {formed && (
          // one smooth ramp under the steps (the KCC climbs slopes more reliably than step edges)
          <CuboidCollider
            args={[rampL / 2, T / 2, STEP_W / 2]}
            position={[(RAMP.x0 + RAMP.x1) / 2 - (Math.sin(rampA) * T) / 2, GATE.h / 2 - (Math.cos(rampA) * T) / 2, GATE.z]}
            rotation={[0, 0, -rampA]}
          />
        )}
      </RigidBody>

      {/* dais */}
      <mesh geometry={daisGeo} material={stone} position={[GATE.x, GATE.h / 2, GATE.z]} castShadow receiveShadow />
      <mesh geometry={rimGeo} material={stone} position={[GATE.x, GATE.h - 0.09, GATE.z]} receiveShadow />

      {/* FORM: steps */}
      {stepGeos.map((g, i) => {
        const s = gateStep(i);
        return (
          <group key={i} position={[s.x, 0, GATE.z]}>
            <mesh ref={(m) => void (stepRefs.current[i] = m)} geometry={g} material={stone} castShadow receiveShadow visible={false} />
            <mesh ref={(m) => void (glowRefs.current[i] = m)} geometry={stepGlowGeos[i]} material={formGlow} visible={false} />
          </group>
        );
      })}

      {/* north pillar (standing) */}
      <group position={[P.x, GATE.h, P.north]}>
        <mesh geometry={pillarGeo} material={stone} position={[0, GATE.pillarH / 2, 0]} castShadow receiveShadow />
        <mesh geometry={capGeo} material={stone} position={[0, GATE.pillarH + 0.15, 0]} castShadow />
        <mesh material={crystalN} position={[0, GATE.pillarH + 0.75, 0]} scale={[0.22, 0.4, 0.22]}>
          <octahedronGeometry args={[1, 0]} />
        </mesh>
      </group>

      {/* CHANGE: south pillar, pivoting on its base */}
      <group ref={pillarRef} position={[P.x, GATE.h, P.south]}>
        <mesh geometry={pillarGeo} material={stone} position={[0, GATE.pillarH / 2, 0]} castShadow receiveShadow />
        <mesh geometry={capGeo} material={stone} position={[0, GATE.pillarH + 0.15, 0]} castShadow />
        <mesh material={crystalS} position={[0, GATE.pillarH + 0.75, 0]} scale={[0.22, 0.4, 0.22]}>
          <octahedronGeometry args={[1, 0]} />
        </mesh>
        <mesh ref={pillarGlowRef} material={changeGlow} position={[0, GATE.pillarH / 2, 0]} visible={false}>
          <cylinderGeometry args={[0.62, 0.7, GATE.pillarH + 0.3, 14, 1, true]} />
        </mesh>
      </group>

      {/* CONNECTION: thread of light between the crystals, the gate's light, the bridge */}
      <mesh ref={beamRef} material={beamMat} position={[P.x, CRYSTAL_Y + 0.3, GATE.z]} rotation-x={Math.PI / 2} visible={false}>
        <cylinderGeometry args={[0.06, 0.06, GATE.pillarZ * 2, 8, 1, true]} />
      </mesh>
      <mesh material={portalMat} position={[P.x, GATE.h + GATE.pillarH / 2, GATE.z]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[GATE.pillarZ * 2 - 0.9, GATE.pillarH]} />
      </mesh>
      <mesh geometry={bridgeGeo} material={bridgeMat} frustumCulled={false} />

      {/* the destination: a floating isle beyond the edge (Phase 4 and beyond) */}
      <mesh geometry={isleGeo} material={rock} position={[ISLE.x, ISLE.y, ISLE.z]} scale={[7, 6, 7]} />
      <mesh position={[ISLE.x, ISLE.y + 1.6, ISLE.z]} scale={[0.6, 1.2, 0.6]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={linked ? 0xffe2a0 : 0x6e7f8f} toneMapped={false} />
      </mesh>
    </group>
  );
}
