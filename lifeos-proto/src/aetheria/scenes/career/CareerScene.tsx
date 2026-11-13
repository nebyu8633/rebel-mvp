/**
 * AETHERIA — the Kingdom of Career: the Great Works.
 * Visual identity: an iron-and-stone platform at the edge of a chasm over a molten glow; the face of
 * a great machine (brick and iron, brass gears, chimneys breathing smoke); a giant girder standing
 * upright at the edge; the Tower of Works across the void; an ember dusk.
 * Gameplay (engine-validated): FORM forges the three missing gears (any order); CHANGE throws the
 * gearbox lever to drive (only with all gears in); CONNECTION couples the drive to the girder, which
 * lowers across the chasm as a bridge. The blueprint waits on the tower.
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
import { C, CAREER_SITES, CRANE_SITE, GEARS, LEVER_SITE, gearSite, onBlueprint, onEnterWorks, type GearId } from "../../content/careerKingdom";
import { resonateSite } from "../sanctuary/SleepingGate";
import { FutureEcho } from "../sanctuary/FutureEcho";
import { isleGeometry } from "../sanctuary/environment";
import { ResonanceFx } from "../../fx/ResonanceFx";
import { PostFx } from "../../../world/PostFx";
import { Arrival } from "../../../world/Arrival";
import { SoundController, DustMotes } from "../sanctuary/Life";
import { WORKS_DOOR_ARRIVAL } from "../mind/layout";
import { BLUEPRINT, CHASM, CRANE, FALL_Y, GEAR_WALL, HEARTH_GATE, LEVER, SPAN, SPAWN, TOWER, WAYSTONE, WORKS } from "./layout";
import { useSanctuaryKit } from "../sanctuary/architecture";

const ease = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const CHIMNEYS = [GEAR_WALL.x - 4.5, GEAR_WALL.x, GEAR_WALL.x + 5];
/** shared "machine is running" amount (0..1), read by gears, smoke, lamps */
const drive = { on: 0 };

function gearGeometry(teeth: number, r: number, depth: number) {
  const s = new THREE.Shape();
  const inner = r * 0.82;
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2;
    const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : inner;
    if (i === 0) s.moveTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
    else s.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
    s.lineTo(Math.cos(a1) * rr, Math.sin(a1) * rr);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.22, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// ------------------------------------------------------------------ the platform, the chasm, the tower
function Ground() {
  const stone = usePBR("ruinfloor", { tint: 0x9a8e84 });
  const rock = usePBR("rock", { tint: 0x5e5048 });
  const brick = usePBR("brick", { tint: 0x8a6a58 });
  const under = useMemo(() => isleGeometry(131), []);
  const under2 = useMemo(() => isleGeometry(132), []);
  const top = useMemo(() => {
    const g = new THREE.CylinderGeometry(WORKS.r, WORKS.r * 0.98, 0.6, 64);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 2.5, p.getZ(i) / 2.5);
    return g;
  }, []);
  const towerTop = useMemo(() => {
    const g = new THREE.CylinderGeometry(TOWER.r, TOWER.r * 0.97, 0.6, 48);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 2.5, p.getZ(i) / 2.5);
    return g;
  }, []);
  const molten = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform float uTime; varying vec2 vUv;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
          float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
          void main(){ vec2 p = vUv * 18.0; float v = n(p + vec2(uTime * 0.05, 0.0)) * 0.6 + n(p * 2.3 - uTime * 0.08) * 0.4;
            vec3 col = mix(vec3(0.25, 0.04, 0.0), vec3(1.0, 0.45, 0.08), smoothstep(0.45, 0.85, v));
            gl_FragColor = vec4(col * 1.6, 1.0); }`,
        toneMapped: false,
      }),
    [],
  );
  useFrame(({ clock }) => void (molten.uniforms.uTime.value = clock.elapsedTime));
  const S = WORKS.r * 1.05;
  const S2 = TOWER.r * 1.2;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.3, WORKS.r]} position={[WORKS.x, -0.3, WORKS.z]} />
        <CylinderCollider args={[0.3, TOWER.r]} position={[TOWER.x, -0.3, TOWER.z]} />
      </RigidBody>
      <mesh geometry={top} material={stone} position={[WORKS.x, -0.3, WORKS.z]} receiveShadow />
      <group position={[WORKS.x, -0.6 - 0.12 * S, WORKS.z]} scale={[S, S * 1.2, S]}>
        <mesh geometry={under} material={rock} />
      </group>
      <mesh geometry={towerTop} material={stone} position={[TOWER.x, -0.3, TOWER.z]} receiveShadow />
      <group position={[TOWER.x, -0.6 - 0.12 * S2, TOWER.z]} scale={[S2, S2 * 1.6, S2]}>
        <mesh geometry={under2} material={rock} />
      </group>
      {/* the canyon's walls far to each side, and the molten river far below */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={rock} position={[s * 46, -10, CHASM.zEdge - 10]} scale={[10, 40, 90]}>
          <dodecahedronGeometry args={[1, 1]} />
        </mesh>
      ))}
      <mesh material={molten} position={[0, -70, -10]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[400, 400]} />
      </mesh>
      {/* the Tower of Works */}
      <mesh material={brick} position={[TOWER.x, 12, TOWER.z - 1.5]} castShadow receiveShadow>
        <cylinderGeometry args={[3.2, 3.8, 24, 24]} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[12, 3.8]} position={[TOWER.x, 12, TOWER.z - 1.5]} />
      </RigidBody>
    </group>
  );
}

// ------------------------------------------------------------------ the machine face, gears, chimneys
function MachineFace() {
  const brick = usePBR("brick", { tint: 0x8a6a58 });
  const iron = usePBR("metal", { tint: 0x5a5856 });
  const brass = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xc19a5b, metalness: 1, roughness: 0.3 }), []);
  const bigGear = useMemo(() => gearGeometry(18, 3.2, 0.5), []);
  const bigRefs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((_, dt) => bigRefs.current.forEach((m, i) => m && (m.rotation.z += dt * drive.on * (i % 2 ? -0.25 : 0.25))));
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[GEAR_WALL.width / 2, 4.5, 1]} position={[GEAR_WALL.x, 4.5, GEAR_WALL.z - 1]} />
      </RigidBody>
      {/* the machine's face: brick with iron bands */}
      <mesh material={brick} position={[GEAR_WALL.x, 4.5, GEAR_WALL.z - 1]} castShadow receiveShadow>
        <boxGeometry args={[GEAR_WALL.width, 9, 2]} />
      </mesh>
      {[1.2, 5.2, 8.6].map((y) => (
        <mesh key={y} material={iron} position={[GEAR_WALL.x, y, GEAR_WALL.z + 0.02]}>
          <boxGeometry args={[GEAR_WALL.width + 0.2, 0.35, 0.2]} />
        </mesh>
      ))}
      {/* two great gears turning on top once the machine runs */}
      {[GEAR_WALL.x - 4, GEAR_WALL.x + 4].map((x, i) => (
        <mesh key={x} ref={(el) => void (bigRefs.current[i] = el)} geometry={bigGear} material={brass} position={[x, 10.5, GEAR_WALL.z - 0.4]} castShadow />
      ))}
      {/* chimneys */}
      {CHIMNEYS.map((x, i) => (
        <mesh key={x} material={brick} position={[x, 12 + i, GEAR_WALL.z - 1.6]} castShadow>
          <cylinderGeometry args={[0.7, 0.9, 6 + i * 2, 12]} />
        </mesh>
      ))}
    </group>
  );
}

function Smoke() {
  const N = 180;
  const { geo, mat, seeds } = useMemo(() => {
    const pos = new Float32Array(N * 3);
    const seeds = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) seeds.set([Math.random(), Math.floor(Math.random() * 3)], i * 2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,.7)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const mat = new THREE.PointsMaterial({ color: 0x5a4a44, map: new THREE.CanvasTexture(c), size: 2.6, transparent: true, opacity: 0.35, depthWrite: false });
    return { geo, mat, seeds };
  }, []);
  const tops = useMemo(() => CHIMNEYS.map((x, i) => new THREE.Vector3(x, 12 + i + (6 + i * 2) / 2, GEAR_WALL.z - 1.6)), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      const s = seeds[i * 2];
      const top = tops[seeds[i * 2 + 1]];
      const life = (t * (0.08 + 0.12 * drive.on) + s) % 1;
      pos.setXYZ(i, top.x + Math.sin(s * 40 + t * 0.3) * life * 3 + life * 6, top.y + life * 14, top.z + Math.cos(s * 31) * life * 2);
    }
    pos.needsUpdate = true;
    mat.opacity = 0.18 + drive.on * 0.25;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} userData={{ noBatch: true }} />;
}

function GearSocket({ id, x }: { id: GearId; x: number }) {
  const iron = usePBR("metal", { tint: 0x4a4846 });
  const brass = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xd2a860, metalness: 1, roughness: 0.28, emissive: new THREE.Color("#ffb060"), emissiveIntensity: 0 }), []);
  const geo = useMemo(() => gearGeometry(12, 1.5, 0.4), []);
  const forged = useAetheria((s) => siteState(s.world, CAREER_SITES[gearSite(id)]) === "forged");
  const power = useAetheriaUi((s) => s.power);
  const g = useRef<THREE.Mesh>(null);
  const grow = useRef(-1);
  useFrame((_, dt) => {
    if (grow.current < 0) grow.current = forged ? 1 : 0;
    grow.current = forged ? Math.min(1, grow.current + Math.min(dt, 0.1) / 1.6) : 0;
    if (g.current) {
      g.current.visible = grow.current > 0.01;
      g.current.scale.setScalar(Math.max(0.001, ease(grow.current)));
      // neighbouring gears turn in opposite directions
      g.current.rotation.z += dt * drive.on * (x === 0 ? -0.9 : 0.9);
    }
    // freshly forged gears glow like hot metal, then cool
    brass.emissiveIntensity = forged ? Math.max(0, 1.5 * (1 - grow.current)) + 0.05 : 0;
  });
  const pos = { x, y: GEAR_WALL.y, z: GEAR_WALL.z + 0.35 };
  useEffect(() => {
    if (forged) return;
    const key = `gear-${id}`;
    interactables.set(key, {
      id: key,
      label: power ? `הפעילו ${FORCE_TITLES[power]}: שקע גלגל השיניים` : "שקע גלגל השיניים: בחרו כוח",
      x,
      y: 0,
      z: GEAR_WALL.z + 1.6,
      radius: 1.8,
      onContact: () => resonateSite(gearSite(id), pos),
    });
    return () => void interactables.delete(key);
  }, [forged, power, id, x]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group userData={{ noBatch: true }}>
      {/* the empty socket: an iron ring and an axle */}
      <mesh material={iron} position={[x, GEAR_WALL.y, GEAR_WALL.z + 0.05]}>
        <torusGeometry args={[1.6, 0.12, 8, 40]} />
      </mesh>
      <mesh material={iron} position={[x, GEAR_WALL.y, GEAR_WALL.z + 0.2]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.18, 0.18, 0.5, 12]} />
      </mesh>
      <mesh ref={g} geometry={geo} material={brass} position={[x, GEAR_WALL.y, GEAR_WALL.z + 0.35]} castShadow />
    </group>
  );
}

function Lever() {
  const iron = usePBR("metal", { tint: 0x4a4846 });
  const brass = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xc19a5b, metalness: 1, roughness: 0.3 }), []);
  const onDrive = useAetheria((s) => siteState(s.world, CAREER_SITES[LEVER_SITE]) === "drive");
  const power = useAetheriaUi((s) => s.power);
  const arm = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    drive.on += ((onDrive ? 1 : 0) - drive.on) * (1 - Math.exp(-0.8 * Math.min(dt, 0.1)));
    if (arm.current) arm.current.rotation.x = -0.7 + 1.4 * ease(drive.on);
  });
  useEffect(() => {
    if (onDrive) return;
    interactables.set("lever", {
      id: "lever",
      label: power ? `הפעילו ${FORCE_TITLES[power]}: ידית תיבת ההילוכים` : "ידית תיבת ההילוכים: בחרו כוח",
      x: LEVER.x,
      y: 0,
      z: LEVER.z + 1.2,
      radius: 1.8,
      onContact: () => {
        resonateSite(LEVER_SITE, { x: LEVER.x, y: 1.4, z: LEVER.z });
        if (useAetheria.getState().lastRejection === "resonance:not_ready") useAetheriaUi.getState().say("הידית נתקעת. בקיר עדיין חסרים גלגלי שיניים.");
      },
    });
    return () => void interactables.delete("lever");
  }, [onDrive, power]);
  return (
    <group position={[LEVER.x, 0, LEVER.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.6, 0.5, 0.5]} position={[0, 0.5, 0]} />
      </RigidBody>
      <mesh material={iron} position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1.2, 1, 1]} />
      </mesh>
      <group ref={arm} position={[0, 1, 0]}>
        <mesh material={brass} position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 1.4, 8]} />
        </mesh>
        <mesh material={brass} position={[0, 1.42, 0]}>
          <sphereGeometry args={[0.14, 12, 8]} />
        </mesh>
      </group>
    </group>
  );
}

/** The great girder: upright at the chasm's edge until CONNECTION lowers it across as a bridge. */
function Girder() {
  const iron = usePBR("metal", { tint: 0x5a5856 });
  const brass = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xc19a5b, metalness: 1, roughness: 0.3 }), []);
  const spanning = useAetheria((s) => siteState(s.world, CAREER_SITES[CRANE_SITE]) === "spanning");
  const power = useAetheriaUi((s) => s.power);
  const from = new THREE.Vector3(...SPAN.from);
  const to = new THREE.Vector3(...SPAN.to);
  const len = from.distanceTo(to);
  const yaw = Math.atan2(to.x - from.x, to.z - from.z);
  const pivot = useRef<THREE.Group>(null);
  const t = useRef(-1);
  const settled = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (t.current < 0) t.current = spanning ? 1 : 0;
    t.current = spanning ? Math.min(1, t.current + Math.min(dt, 0.1) / 4) : 0;
    // from upright (pointing up) to lying along the span; it falls slowly, then lands
    // rotation about X by -90° points +Z (the girder) straight up
    if (pivot.current) pivot.current.rotation.x = (-Math.PI / 2) * (1 - ease(t.current));
    if (settled.current) settled.current.visible = t.current >= 1;
  });
  useEffect(() => {
    if (spanning) return;
    interactables.set("girder", {
      id: "girder",
      label: power ? `הפעילו ${FORCE_TITLES[power]}: זרוע הגשר` : "זרוע הגשר: בחרו כוח",
      // west of the machine's face, on the open way round to the chasm
      x: from.x - 1.2,
      y: 0,
      z: from.z + 2.5,
      radius: 2.2,
      onContact: () => {
        resonateSite(CRANE_SITE, { x: from.x, y: 3, z: from.z });
        if (useAetheria.getState().lastRejection === "resonance:not_ready") useAetheriaUi.getState().say("הזרוע לא זזה. המכונה עדיין לא בהנעה.");
      },
    });
    return () => void interactables.delete("girder");
  }, [spanning, power]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group position={from} rotation-y={yaw} userData={{ noBatch: true }}>
      {/* the hinge block */}
      <mesh material={iron} position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[3, 1.2, 1.6]} />
      </mesh>
      <group ref={pivot} position={[0, 0.2, 0]}>
        {/* the girder lies along +Z (toward the tower) when lowered */}
        <mesh material={iron} position={[0, 0, len / 2]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.35, len]} />
        </mesh>
        {[-1.1, 1.1].map((x) => (
          <mesh key={x} material={brass} position={[x, 0.45, len / 2]}>
            <boxGeometry args={[0.12, 0.6, len]} />
          </mesh>
        ))}
      </group>
      {/* walkable only once it has landed */}
      <group ref={settled} visible={false}>
        {spanning && (
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[1.1, 0.1, len / 2]} position={[0, 0.27, len / 2]} />
          </RigidBody>
        )}
      </group>
    </group>
  );
}

function Blueprint() {
  const wood = usePBR("wood", { tint: 0x8a6a4a });
  const paper = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xe8dcc0, emissive: new THREE.Color("#ffd27a"), emissiveIntensity: 0.2, roughness: 0.9 }), []);
  const read = useAetheria((s) => s.world.flags.includes(C.blueprint));
  const spanning = useAetheria((s) => siteState(s.world, CAREER_SITES[CRANE_SITE]) === "spanning");
  useFrame(({ clock }) => void (paper.emissiveIntensity = read ? 0.15 : 0.25 + Math.max(0, Math.sin(clock.elapsedTime * 2)) * 0.5));
  useEffect(() => {
    if (read || !spanning) return;
    interactables.set("blueprint", {
      id: "blueprint",
      label: "קראו את התוכנית",
      x: BLUEPRINT.x,
      y: 0,
      z: BLUEPRINT.z + 4.6,
      radius: 2,
      onContact: () => {
        const st = useAetheria.getState();
        const before = st.world.journal.length;
        if (st.dispatch(onBlueprint())) {
          playerReactions.emit("celebrate");
          for (const j of useAetheria.getState().world.journal.slice(before)) {
            const text = JOURNAL[j.id];
            if (text) useAetheriaUi.getState().showCard({ title: text.title, body: text.body, tone: "resonance" });
          }
        }
      },
    });
    return () => void interactables.delete("blueprint");
  }, [read, spanning]);
  return (
    <group position={[BLUEPRINT.x, 0, BLUEPRINT.z + 3.6]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.9, 0.5, 0.6]} position={[0, 0.5, 0]} />
      </RigidBody>
      <mesh material={wood} position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1.8, 1, 1.2]} />
      </mesh>
      <mesh material={paper} position={[0, 1.02, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.6, 1.0]} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ the Echo, the way back, story
const ECHO_SPOT = { x: -4, y: 0, z: 12 };
function EchoInWorks() {
  const stage = useAetheria((s) => s.world.echo);
  const inDialogue = useDialogue((s) => !!s.defId);
  const awake = stage !== "dormant" && stage !== "silent_observer";
  useEffect(() => {
    if (!awake || inDialogue) {
      interactables.delete("echo-c");
      return;
    }
    interactables.set("echo-c", { id: "echo-c", label: "לדבר עם הד העתיד", x: ECHO_SPOT.x + 0.6, y: 0, z: ECHO_SPOT.z + 0.6, radius: 2.2, onContact: () => useDialogue.getState().open(ECHO_TALK) });
    return () => void interactables.delete("echo-c");
  }, [awake, inDialogue]);
  return <FutureEcho stage={stage} anchors={[ECHO_SPOT]} waitAnchor={ECHO_SPOT} waiting inDialogue={inDialogue} tint={{ color: "#ffc890", accent: "#fff2e0", veils: ["#ff9a4a", "#ffe2a0"] }} />;
}

function Waystone() {
  const stone = usePBR("rock", { tint: 0x8a7a70 });
  const rune = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: new THREE.Color("#ffb060"), emissiveIntensity: 2.5 }), []);
  useEffect(() => {
    if (!worldAvailable("mind")) return;
    interactables.set("waystone-c", {
      id: "waystone-c",
      label: "אבן הדרך: חזרה אל היכל ההשתקפויות",
      x: WAYSTONE.x - 1,
      y: 0,
      z: WAYSTONE.z,
      radius: 1.8,
      onContact: () => {
        setArrival("mind", WORKS_DOOR_ARRIVAL);
        void goToWorld("mind", { style: "resonance" });
      },
    });
    return () => void interactables.delete("waystone-c");
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
    if (st.world.flags.includes(C.entered)) return;
    const before = st.world.journal.length;
    if (st.dispatch(onEnterWorks())) {
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
    useAetheriaUi.getState().say("משב חם מהתהום החזיר אותך אל הרציף.");
  });
  return null;
}


/** The Gate of the Hearth: once the blueprint is read, a warm passage opens on the tower's platform. */
function HearthGate() {
  const open = useAetheria((s) => s.world.flags.includes(C.blueprint));
  const stone = usePBR("ruinwall", { tint: 0xb8a898 });
  const kit = useSanctuaryKit();
  const seal = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOn: { value: 0 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform float uTime; uniform float uOn; varying vec2 vUv;
          void main(){ vec2 p = vUv - 0.5; float r = length(p * vec2(1.0, 0.7));
            float flick = 0.6 + 0.4 * sin(uTime * 3.0 + r * 14.0) * sin(uTime * 1.7 + p.x * 9.0);
            float a = smoothstep(0.6, 0.15, r) * (0.35 + 0.5 * flick) * uOn;
            gl_FragColor = vec4(vec3(1.0, 0.7, 0.4) * a * 1.5, 1.0); }`,
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
    seal.uniforms.uOn.value += ((open ? 1 : 0) - seal.uniforms.uOn.value) * 0.03;
  });
  useEffect(() => {
    if (!open || !worldAvailable("social")) return;
    interactables.set("hearth-gate", {
      id: "hearth-gate",
      label: "היכנסו לכפר האח",
      x: HEARTH_GATE.x - 1.6,
      y: 0,
      z: HEARTH_GATE.z + 1.2,
      radius: 2,
      onContact: () => void goToWorld("social", { style: "resonance" }),
    });
    return () => void interactables.delete("hearth-gate");
  }, [open]);
  return (
    <group position={[HEARTH_GATE.x, 0, HEARTH_GATE.z]} rotation-y={-Math.PI / 4} userData={{ noBatch: true }}>
      {open && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[1.8, 1.6, 0.4]} position={[0, 1.6, 0]} />
        </RigidBody>
      )}
      <group visible={open} scale={0.45}>
        <mesh geometry={kit.arch_gate} material={stone} castShadow receiveShadow />
        <mesh material={seal} position={[0, 2.4, 0]}>
          <planeGeometry args={[3.6, 5.2]} />
        </mesh>
      </group>
    </group>
  );
}

export function CareerScene({ quality }: { quality: Quality }) {
  return (
    <group>
      <Ground />
      <MachineFace />
      {GEARS.map((g, i) => (
        <GearSocket key={g} id={g} x={GEAR_WALL.sockets[i]} />
      ))}
      <Lever />
      <Girder />
      <Blueprint />
      <HearthGate />
      <Smoke />
      <EchoInWorks />
      <Waystone />
      <Story />
      <Arrival world="career" />
      <ResonanceFx />
      <PostFx quality={quality} />
      <SoundController />
      <DustMotes count={quality === "low" ? 80 : 160} />
    </group>
  );
}
