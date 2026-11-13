/**
 * AETHERIA — the Kingdom of Social: the Village of the Hearth.
 * Visual identity: a twilight village on floating islands — plaster houses with tiled roofs and
 * warm windows, a cobbled plaza with a great stone hearth, wooden bells in each hamlet, bridges
 * between; people as soft figures of light. The first place the player cannot finish alone.
 * Gameplay (engine-validated): CONNECTION rebuilds each bridge; ringing a hamlet's bell brings its
 * people back; the Common Flame needs two keepers — you and the Echo, if you ask it; FORM kindles it.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { usePBR } from "../../../world/materials";
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
import { ECHO_HELPS, HAMLETS, HEARTH_SITE, S, SOCIAL_SITES, bellFlag, bridgeSite, onBell, onEnterVillage, onKeepers, type HamletId } from "../../content/socialKingdom";
import { resonateSite } from "../sanctuary/SleepingGate";
import { FutureEcho } from "../sanctuary/FutureEcho";
import { isleGeometry } from "../sanctuary/environment";
import { LightPath } from "../shared/LightPath";
import { ResonanceFx } from "../../fx/ResonanceFx";
import { PostFx } from "../../../world/PostFx";
import { Arrival } from "../../../world/Arrival";
import { SoundController, DustMotes } from "../sanctuary/Life";
import { HEARTH_GATE_ARRIVAL } from "../career/layout";
import { FALL_Y, GATHER, HAMLET_SPOTS, HEARTH, KEEPER_STONES, PLAZA, SPAWN, VILLAGE_BRIDGES, WAYSTONE } from "./layout";

const showJournal = (before: number, tone: "discovery" | "resonance" | "echo" = "discovery") => {
  for (const j of useAetheria.getState().world.journal.slice(before)) {
    const text = JOURNAL[j.id];
    if (text) useAetheriaUi.getState().showCard({ title: text.title, body: text.body, tone });
  }
};
/** how lit the village is (0..1): the Common Flame */
const village = { lit: 0 };

// ------------------------------------------------------------------ islands
function IslandTop({ x, y, z, r, seed, material }: { x: number; y: number; z: number; r: number; seed: number; material: THREE.Material }) {
  const rock = usePBR("rock", { tint: 0x6a6460 });
  const under = useMemo(() => isleGeometry(seed), [seed]);
  const top = useMemo(() => {
    const g = new THREE.CylinderGeometry(r, r * 0.97, 0.6, 56);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2);
    return g;
  }, [r]);
  const S2 = r * 1.1;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.3, r]} position={[x, y - 0.3, z]} />
      </RigidBody>
      <mesh geometry={top} material={material} position={[x, y - 0.3, z]} receiveShadow />
      <group position={[x, y - 0.6 - 0.12 * S2, z]} scale={[S2, S2 * 1.2, S2]}>
        <mesh geometry={under} material={rock} />
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ houses
function House({ x, y, z, yaw, s = 1 }: { x: number; y: number; z: number; yaw: number; s?: number }) {
  const plaster = usePBR("plaster", { tint: 0xe8dcc8 });
  const wood = usePBR("wood", { tint: 0x7a5a40 });
  const roof = usePBR("brick", { tint: 0x9a4a38 });
  const win = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x1a1612, emissive: new THREE.Color("#ffb060"), emissiveIntensity: 0.05 }), []);
  const roofGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0, 2.6, 1.8, 4, 1);
    g.rotateY(Math.PI / 4);
    return g;
  }, []);
  useFrame(({ clock }) => void (win.emissiveIntensity = 0.05 + village.lit * (1.8 + Math.sin(clock.elapsedTime * 3 + x) * 0.15)));
  return (
    <group position={[x, y, z]} rotation-y={yaw} scale={s}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.6 * s, 1.3 * s, 1.6 * s]} position={[0, 1.3 * s, 0]} />
      </RigidBody>
      <mesh material={plaster} position={[0, 1.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 2.6, 3.2]} />
      </mesh>
      <mesh geometry={roofGeo} material={roof} position={[0, 3.5, 0]} castShadow />
      <mesh material={wood} position={[0, 0.85, 1.61]}>
        <planeGeometry args={[0.9, 1.7]} />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} material={win} position={[sx * 1.0, 1.55, 1.61]}>
          <planeGeometry args={[0.55, 0.6]} />
        </mesh>
      ))}
      <mesh material={win} position={[1.61, 1.55, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[0.55, 0.6]} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ hamlets: bridge anchor + bell
function Hamlet({ id }: { id: HamletId }) {
  const grass = usePBR("meadow", { tint: 0x8fa070 });
  const wood = usePBR("wood", { tint: 0x6a4a30 });
  const bronze = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xb07a3a, metalness: 1, roughness: 0.35 }), []);
  const h = HAMLET_SPOTS[id];
  const whole = useAetheria((s) => siteState(s.world, SOCIAL_SITES[bridgeSite(id)]) === "whole");
  const rung = useAetheria((s) => s.world.flags.includes(bellFlag(id)));
  const power = useAetheriaUi((s) => s.power);
  const path = VILLAGE_BRIDGES[id];
  const anchor = { x: path[0][0] * 0.94, y: 0, z: path[0][2] * 0.94 };
  const toPlaza = Math.atan2(PLAZA.x - h.x, PLAZA.z - h.z);
  const bell = useRef<THREE.Group>(null);
  const swing = useRef(0);
  useFrame(({ clock }, dt) => {
    swing.current = Math.max(0, swing.current - dt * 0.4);
    if (bell.current) bell.current.rotation.x = Math.sin(clock.elapsedTime * 6) * 0.5 * swing.current;
  });
  // the bridge anchor (on the plaza): CONNECTION rebuilds the bridge
  useEffect(() => {
    if (whole) return;
    const key = `anchor-${id}`;
    interactables.set(key, {
      id: key,
      label: power ? `הפעילו ${FORCE_TITLES[power]}: הגשר השבור` : "הגשר השבור: בחרו כוח",
      ...anchor,
      radius: 2,
      onContact: () => resonateSite(bridgeSite(id), { x: path[1][0], y: path[1][1] + 0.5, z: path[1][2] }),
    });
    return () => void interactables.delete(key);
  }, [whole, power, id]); // eslint-disable-line react-hooks/exhaustive-deps
  // the greeting bell (in the hamlet): ringing it is a social act, not a power
  useEffect(() => {
    if (rung || !whole) return;
    const key = `bell-${id}`;
    interactables.set(key, {
      id: key,
      label: "צלצלו בפעמון הברכה",
      x: h.x + Math.sin(toPlaza) * 1.6,
      y: h.y,
      z: h.z + Math.cos(toPlaza) * 1.6,
      radius: 1.8,
      onContact: () => {
        swing.current = 1;
        const st = useAetheria.getState();
        if (st.dispatch(onBell(id))) {
          playerReactions.emit("celebrate");
          const n = HAMLETS.filter((x) => useAetheria.getState().world.flags.includes(bellFlag(x))).length;
          useAetheriaUi.getState().say(n < HAMLETS.length ? "מישהו ענה לפעמון. אנשים חוזרים אל הרחבה." : "כל הכפרים ענו. הם מחכים ליד האש.");
        }
      },
    });
    return () => void interactables.delete(key);
  }, [rung, whole, id]); // eslint-disable-line react-hooks/exhaustive-deps
  const houses = useMemo(
    () =>
      [0, 1, 2].map((i) => {
        const a = toPlaza + Math.PI + (i - 1) * 1.15;
        return { x: h.x + Math.sin(a) * 3.8, z: h.z + Math.cos(a) * 3.8, yaw: a + Math.PI };
      }),
    [h.x, h.z, toPlaza],
  );
  return (
    <group userData={{ noBatch: true }}>
      <IslandTop x={h.x} y={h.y} z={h.z} r={h.r} seed={140 + HAMLETS.indexOf(id)} material={grass} />
      {houses.map((p, i) => (
        <House key={i} x={p.x} y={h.y} z={p.z} yaw={p.yaw} s={0.9 + (i % 2) * 0.15} />
      ))}
      {/* the greeting bell */}
      <group position={[h.x, h.y, h.z]} rotation-y={toPlaza}>
        {[-0.8, 0.8].map((sx) => (
          <mesh key={sx} material={wood} position={[sx, 1.4, 0]} castShadow>
            <boxGeometry args={[0.18, 2.8, 0.18]} />
          </mesh>
        ))}
        <mesh material={wood} position={[0, 2.8, 0]}>
          <boxGeometry args={[1.9, 0.2, 0.25]} />
        </mesh>
        <group ref={bell} position={[0, 2.7, 0]}>
          <mesh material={bronze} position={[0, -0.4, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.42, 0.7, 16, 1, true]} />
          </mesh>
        </group>
      </group>
      {/* the bridge: broken stubs, then a warm path once reconnected */}
      {whole ? (
        <LightPath points={path} width={2.2} color="#ffd8a0" />
      ) : (
        <mesh material={wood} position={[path[0][0] + (path[1][0] - path[0][0]) * 0.12, -0.05, path[0][2] + (path[1][2] - path[0][2]) * 0.12]} rotation-y={Math.atan2(path[2][0] - path[0][0], path[2][2] - path[0][2])}>
          <boxGeometry args={[2, 0.15, 2.4]} />
        </mesh>
      )}
    </group>
  );
}

// ------------------------------------------------------------------ the plaza: hearth, keepers' stones
function Plaza() {
  const cobble = usePBR("plaza", { tint: 0xc8b8a0 });
  const stone = usePBR("ruinwall", { tint: 0xa89c8c });
  const keeperMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x6a645c, emissive: new THREE.Color("#ffd8a0"), emissiveIntensity: 0, roughness: 0.8 }), []);
  const flameMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffa040").multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), []);
  const burning = useAetheria((s) => siteState(s.world, SOCIAL_SITES[HEARTH_SITE]) === "burning");
  const keepers = useAetheria((s) => s.world.flags.includes(S.keepers));
  const helping = useAetheria((s) => s.world.memory[ECHO_HELPS] === true);
  const power = useAetheriaUi((s) => s.power);
  const light = useRef<THREE.PointLight>(null);
  const flames = useRef<(THREE.Mesh | null)[]>([]);
  const lit = useRef(-1);
  useFrame(({ clock }, dt) => {
    if (lit.current < 0) lit.current = burning ? 1 : 0;
    lit.current += ((burning ? 1 : 0) - lit.current) * (1 - Math.exp(-0.9 * Math.min(dt, 0.1)));
    village.lit = lit.current;
    const t = clock.elapsedTime;
    flameMat.opacity = lit.current * 0.85;
    flames.current.forEach((f, i) => f && (f.scale.set(1, 0.8 + Math.sin(t * (7 + i) + i) * 0.25, 1), (f.rotation.y = t * (0.6 + i * 0.2))));
    if (light.current) light.current.intensity = lit.current * (14 + Math.sin(t * 11) * 2);
    keeperMat.emissiveIntensity = (helping ? 0.6 : 0) + (keepers ? 1.2 : 0) + Math.max(0, Math.sin(t * 2)) * (helping && !keepers ? 0.6 : 0);
  });
  useEffect(() => {
    if (burning) return;
    interactables.set("hearth", {
      id: "hearth",
      label: power ? `הפעילו ${FORCE_TITLES[power]}: האש המשותפת` : "האש המשותפת: בחרו כוח",
      x: HEARTH.x,
      y: 0,
      z: HEARTH.z + HEARTH.r + 1.4,
      radius: 2,
      onContact: () => {
        resonateSite(HEARTH_SITE, { x: HEARTH.x, y: 1, z: HEARTH.z });
        if (useAetheria.getState().lastRejection === "resonance:not_ready") {
          const w = useAetheria.getState().world;
          const bells = HAMLETS.every((h) => w.flags.includes(bellFlag(h)));
          useAetheriaUi.getState().say(!bells ? "האש מחכה לאנשים. צלצלו בפעמונים בכפרים." : "אש כזאת צריכה שני שומרים. בקשו מהד העתיד לעמוד איתכם.");
        }
      },
    });
    return () => void interactables.delete("hearth");
  }, [burning, power]);
  // two keepers at once: you on your stone while the Echo stands on its own
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const st = useAetheria.getState();
    const w = st.world;
    if (w.flags.includes(S.keepers) || w.memory[ECHO_HELPS] !== true) return;
    if (Math.hypot(telemetry.x - KEEPER_STONES.player.x, telemetry.z - KEEPER_STONES.player.z) < 1.3) {
      const before = w.journal.length;
      if (st.dispatch(onKeepers())) {
        playerReactions.emit("acknowledge");
        showJournal(before, "echo");
      }
    }
  });
  return (
    <group userData={{ noBatch: true }}>
      <IslandTop {...PLAZA} seed={150} material={cobble} />
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.35, HEARTH.r + 0.3]} position={[HEARTH.x, 0.35, HEARTH.z]} />
      </RigidBody>
      <mesh material={stone} position={[HEARTH.x, 0.35, HEARTH.z]} castShadow receiveShadow>
        <cylinderGeometry args={[HEARTH.r + 0.3, HEARTH.r + 0.45, 0.7, 20, 1, true]} />
      </mesh>
      <mesh material={stone} position={[HEARTH.x, 0.3, HEARTH.z]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[HEARTH.r + 0.3, 20]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(el) => void (flames.current[i] = el)} material={flameMat} position={[HEARTH.x + Math.cos(i * 1.6) * 0.4, 1.2, HEARTH.z + Math.sin(i * 1.6) * 0.4]}>
          <coneGeometry args={[0.55 - i * 0.07, 1.8 - i * 0.2, 8, 1, true]} />
        </mesh>
      ))}
      <pointLight ref={light} position={[HEARTH.x, 2.2, HEARTH.z]} color={0xffa050} distance={22} decay={1.5} intensity={0} />
      {/* the two keepers' stones */}
      {[KEEPER_STONES.player, KEEPER_STONES.echo].map((p, i) => (
        <mesh key={i} material={keeperMat} position={[p.x, 0.05, p.z]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.9, 24]} />
        </mesh>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ the people, returning
const personVert = "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * instanceMatrix * vec4(position,1.0); vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }";
const personFrag = "uniform float uO; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6); gl_FragColor = vec4(vec3(1.0, 0.82, 0.55) * (0.25 + 1.2 * f) * uO, 1.0); }";
function Villagers() {
  const bells = useAetheria((s) => HAMLETS.filter((h) => s.world.flags.includes(bellFlag(h))).length);
  const body = useMemo(() => {
    const g = new THREE.CapsuleGeometry(0.28, 1.0, 4, 10);
    g.translate(0, 0.8, 0);
    return g;
  }, []);
  const head = useMemo(() => {
    const g = new THREE.SphereGeometry(0.2, 12, 8);
    g.translate(0, 1.72, 0);
    return g;
  }, []);
  const mat = useMemo(() => new THREE.ShaderMaterial({ uniforms: { uO: { value: 1 } }, vertexShader: personVert, fragmentShader: personFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const shown = useRef(0);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }, dt) => {
    const want = bells * 4;
    shown.current += (want - shown.current) * (1 - Math.exp(-0.8 * Math.min(dt, 0.1)));
    const t = clock.elapsedTime;
    for (let i = 0; i < GATHER.length; i++) {
      const g = GATHER[i];
      const vis = THREE.MathUtils.clamp(shown.current - i, 0, 1);
      // before the fire: they wander a little; after: they stand facing it and sway
      const wander = (1 - village.lit) * 1.2;
      o.position.set(g.x + Math.sin(t * 0.3 + i) * wander, 0, g.z + Math.cos(t * 0.27 + i * 1.3) * wander);
      o.rotation.set(0, g.face + Math.sin(t * 0.8 + i) * 0.15 * village.lit, Math.sin(t * 1.4 + i) * 0.05 * village.lit);
      o.scale.setScalar(Math.max(0.0001, vis) * (0.9 + (i % 3) * 0.08));
      o.updateMatrix();
      bodyRef.current?.setMatrixAt(i, o.matrix);
      headRef.current?.setMatrixAt(i, o.matrix);
    }
    if (bodyRef.current) bodyRef.current.instanceMatrix.needsUpdate = true;
    if (headRef.current) headRef.current.instanceMatrix.needsUpdate = true;
    mat.uniforms.uO.value = 0.55 + village.lit * 0.45;
  });
  return (
    <group userData={{ noBatch: true }}>
      <instancedMesh ref={bodyRef} args={[body, mat, GATHER.length]} frustumCulled={false} />
      <instancedMesh ref={headRef} args={[head, mat, GATHER.length]} frustumCulled={false} />
    </group>
  );
}

// ------------------------------------------------------------------ the Echo (and its stone), the way back, story
const ECHO_IDLE = { x: 6.5, y: 0, z: 5.5 };
function EchoInVillage() {
  const stage = useAetheria((s) => s.world.echo);
  const helping = useAetheria((s) => s.world.memory[ECHO_HELPS] === true);
  const inDialogue = useDialogue((s) => !!s.defId);
  const awake = stage !== "dormant" && stage !== "silent_observer";
  // asked to keep the fire, it stands on its stone across the hearth
  const spot = helping ? { x: KEEPER_STONES.echo.x, y: 0, z: KEEPER_STONES.echo.z } : ECHO_IDLE;
  useEffect(() => {
    if (!awake || inDialogue) {
      interactables.delete("echo-s");
      return;
    }
    interactables.set("echo-s", { id: "echo-s", label: "לדבר עם הד העתיד", x: spot.x - 0.8, y: 0, z: spot.z + 0.8, radius: 2.2, onContact: () => useDialogue.getState().open(ECHO_TALK) });
    return () => void interactables.delete("echo-s");
  }, [awake, inDialogue, spot.x, spot.z]);
  return <FutureEcho stage={stage} anchors={[spot]} waitAnchor={spot} waiting inDialogue={inDialogue} tint={{ color: "#ffd8a0", accent: "#fff4e4", veils: ["#ffb070", "#a8c8ff"] }} />;
}

function Waystone() {
  const stone = usePBR("rock", { tint: 0x8a8278 });
  const rune = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: new THREE.Color("#ffd8a0"), emissiveIntensity: 2.5 }), []);
  useEffect(() => {
    if (!worldAvailable("career")) return;
    interactables.set("waystone-s", {
      id: "waystone-s",
      label: "אבן הדרך: חזרה אל מגדל המלאכה",
      x: WAYSTONE.x - 1,
      y: 0,
      z: WAYSTONE.z,
      radius: 1.8,
      onContact: () => {
        setArrival("career", HEARTH_GATE_ARRIVAL);
        void goToWorld("career", { style: "resonance" });
      },
    });
    return () => void interactables.delete("waystone-s");
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
    if (st.world.flags.includes(S.entered)) return;
    const before = st.world.journal.length;
    if (st.dispatch(onEnterVillage())) {
      playerReactions.emit("surprise");
      showJournal(before);
    }
  }, [hydrated]);
  const cooldown = useRef(0);
  useFrame((_, dt) => {
    cooldown.current = Math.max(0, cooldown.current - dt);
    if (telemetry.y > FALL_Y || cooldown.current > 0) return;
    cooldown.current = 1.5;
    playerCommands.teleport(SPAWN.x, SPAWN.y + 0.3, SPAWN.z, SPAWN.yaw);
    useAetheriaUi.getState().say("מישהו תפס לך את היד והחזיר אותך אל הרחבה.");
  });
  return null;
}

export function SocialScene({ quality }: { quality: Quality }) {
  return (
    <group>
      <Plaza />
      {HAMLETS.map((h) => (
        <Hamlet key={h} id={h} />
      ))}
      <Villagers />
      <EchoInVillage />
      <Waystone />
      <Story />
      <Arrival world="social" />
      <ResonanceFx />
      <PostFx quality={quality} />
      <SoundController />
      <DustMotes count={quality === "low" ? 100 : 200} />
    </group>
  );
}
