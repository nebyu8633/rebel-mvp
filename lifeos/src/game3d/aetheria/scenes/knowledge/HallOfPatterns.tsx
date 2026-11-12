/**
 * The Hall of Patterns — the Kingdom of Knowledge's first puzzle.
 *   - a brass star dial on each satellite platform (four signs; CHANGE turns it one step)
 *   - the lens floating over the hall: one sign faces each platform — stand by a dial and look at
 *     the lens to see which sign that dial must point at
 *   - the codex at the hall's centre: CONNECTION opens it only when all three dials match
 *     (validated by the rules engine; otherwise the force dissipates and says why)
 *   - the Future Echo, in the kingdom's blue, waits by the codex; it hints, it never solves
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { usePBR } from "../../../world/materials";
import { interactables } from "../../../store";
import { useAetheria } from "../../store";
import { useAetheriaUi } from "../../ui/uiStore";
import { useDialogue } from "../../ui/dialogueRunner";
import { FORCE_TITLES } from "../../core/model";
import { siteState } from "../../core/state";
import { ECHO_TALK } from "../../content/echoAwakening";
import { CODEX_SITE, DIAL_GLYPHS, DIAL_TARGET, DIALS, K, KNOWLEDGE_SITES, dialSite, type DialId } from "../../content/knowledgeKingdom";
import { kingdomGlyph } from "../sanctuary/glyphs";
import { resonateSite } from "../sanctuary/SleepingGate";
import { FutureEcho } from "../sanctuary/FutureEcho";
import { HALL, SATELLITES } from "./layout";

const LENS_Y = 4.4;
const BLUE = new THREE.Color("#3f8cff");

function useGlyphMats(color: THREE.Color, mul = 2) {
  return useMemo(
    () => DIAL_GLYPHS.map((k) => new THREE.MeshBasicMaterial({ map: kingdomGlyph(k), color: color.clone().multiplyScalar(mul), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })),
    [color, mul],
  );
}

function placement(d: DialId) {
  const s = SATELLITES.find((x) => x.id === d)!;
  const toHall = new THREE.Vector2(HALL.x - s.x, HALL.z - s.z).normalize();
  return {
    s,
    // the dial stands at the far side of its platform, facing the hall (the player stands in front)
    dial: { x: s.x - toHall.x * 1.4, y: s.y, z: s.z - toHall.y * 1.4 },
    stand: { x: s.x + toHall.x * 0.6, y: s.y, z: s.z + toHall.y * 0.6 },
    yaw: Math.atan2(toHall.x, toHall.y),
    toHall,
  };
}

function Dial({ id }: { id: DialId }) {
  const stone = usePBR("ruinwall", { tint: 0x9a9cae });
  const brass = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 1, roughness: 0.3 }), []);
  const glyphs = useGlyphMats(new THREE.Color("#ffe2a0"), 1.6);
  const pointer = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd27a").multiplyScalar(2), toneMapped: false }), []);
  const state = useAetheria((s) => siteState(s.world, KNOWLEDGE_SITES[dialSite(id)]));
  const solved = useAetheria((s) => s.world.flags.includes(K.codex));
  const power = useAetheriaUi((s) => s.power);
  const step = Number(state.slice(1));
  const P = useMemo(() => placement(id), [id]);
  const disc = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!disc.current) return;
    const target = step * (Math.PI / 2);
    // turn the short way round (p3 -> p0 continues forward)
    let diff = target - disc.current.rotation.z;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    disc.current.rotation.z += diff * (1 - Math.exp(-4 * Math.min(dt, 0.1)));
  });
  useEffect(() => {
    if (solved) return;
    const key = `dial-${id}`;
    interactables.set(key, {
      id: key,
      label: power ? `הפעילו ${FORCE_TITLES[power]}: חוגת הכוכבים` : "חוגת הכוכבים: בחרו כוח",
      ...P.stand,
      radius: 2.2,
      onContact: () => resonateSite(dialSite(id), { x: P.dial.x, y: P.dial.y + 1.7, z: P.dial.z }),
    });
    return () => void interactables.delete(key);
  }, [id, power, solved, P]);
  return (
    <group position={[P.dial.x, P.dial.y, P.dial.z]} rotation-y={P.yaw}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.45, 0.55, 0.35]} position={[0, 0.55, 0]} />
      </RigidBody>
      <mesh material={stone} position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 1.1, 0.7]} />
      </mesh>
      <group position={[0, 1.95, 0.05]}>
        {/* the fixed pointer at the top */}
        <mesh material={pointer} position={[0, 0.98, 0.06]} rotation-z={Math.PI}>
          <coneGeometry args={[0.1, 0.22, 3]} />
        </mesh>
        <group ref={disc}>
          <mesh material={brass}>
            <torusGeometry args={[0.78, 0.05, 10, 64]} />
          </mesh>
          <mesh material={brass}>
            <torusGeometry args={[0.32, 0.03, 8, 40]} />
          </mesh>
          {DIAL_GLYPHS.map((_, i) => {
            // sign i sits so that turning the disc by i quarter-turns brings it under the pointer
            const a = Math.PI / 2 - i * (Math.PI / 2);
            return (
              <group key={i}>
                <mesh material={brass} position={[Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0]} rotation-z={a}>
                  <boxGeometry args={[0.36, 0.03, 0.03]} />
                </mesh>
                <mesh material={glyphs[i]} position={[Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0.04]} rotation-z={a - Math.PI / 2}>
                  <planeGeometry args={[0.3, 0.3]} />
                </mesh>
              </group>
            );
          })}
        </group>
      </group>
    </group>
  );
}

/** The lens over the hall: the sign facing each platform is the one its dial must show. */
function Lens() {
  const signs = useGlyphMats(BLUE, 2.4);
  const ring = useMemo(() => new THREE.MeshBasicMaterial({ color: BLUE.clone().multiplyScalar(1.6), transparent: true, opacity: 0.8, toneMapped: false }), []);
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => g.current && (g.current.position.y = LENS_Y + Math.sin(clock.elapsedTime * 0.9) * 0.08));
  return (
    <group ref={g} position={[HALL.x, LENS_Y, HALL.z]} userData={{ noBatch: true }}>
      <mesh material={ring} rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.1, 0.04, 8, 64]} />
      </mesh>
      {DIALS.map((d) => {
        const P = placement(d);
        // facing outward, toward its platform (readable from the dial)
        const yaw = Math.atan2(-P.toHall.x, -P.toHall.y);
        return (
          <mesh key={d} material={signs[DIAL_TARGET[d]]} position={[-P.toHall.x * 1.15, 0, -P.toHall.y * 1.15]} rotation-y={yaw}>
            <planeGeometry args={[0.7, 0.7]} />
          </mesh>
        );
      })}
    </group>
  );
}

function Codex() {
  const stone = usePBR("ruinwall", { tint: 0x9a9cae });
  const leather = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x2d3a5c, roughness: 0.7, emissive: BLUE, emissiveIntensity: 0.15 }), []);
  const pages = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.9, emissive: new THREE.Color("#bcd4ff"), emissiveIntensity: 0 }), []);
  const beam = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#bcd4ff").multiplyScalar(1.5), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  const open = useAetheria((s) => siteState(s.world, KNOWLEDGE_SITES[CODEX_SITE]) === "open");
  const power = useAetheriaUi((s) => s.power);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const t = useRef(0);
  useFrame(({ clock }, dt) => {
    t.current += ((open ? 1 : 0) - t.current) * (1 - Math.exp(-1.2 * Math.min(dt, 0.1)));
    const a = t.current * 1.25;
    if (left.current) left.current.rotation.z = a;
    if (right.current) right.current.rotation.z = -a;
    pages.emissiveIntensity = t.current * (1.2 + Math.sin(clock.elapsedTime * 2) * 0.2);
    leather.emissiveIntensity = 0.15 + (open ? 0 : Math.max(0, Math.sin(clock.elapsedTime * 1.6)) * 0.35);
    beam.opacity = t.current * 0.35;
  });
  useEffect(() => {
    if (open) return;
    interactables.set("codex", {
      id: "codex",
      label: power ? `הפעילו ${FORCE_TITLES[power]}: הקודקס` : "הקודקס: בחרו כוח",
      x: HALL.x,
      y: HALL.y,
      z: HALL.z + 1.2,
      radius: 1.8,
      onContact: () => {
        resonateSite(CODEX_SITE, { x: HALL.x, y: 1.4, z: HALL.z });
        if (useAetheria.getState().lastRejection === "resonance:not_ready") useAetheriaUi.getState().say("החוגות עדיין לא תואמות לעדשה. עמדו ליד כל חוגה והסתכלו למעלה.");
      },
    });
    return () => void interactables.delete("codex");
  }, [open, power]);
  return (
    <group position={[HALL.x, HALL.y, HALL.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.45, 0.55, 0.35]} position={[0, 0.55, 0]} />
      </RigidBody>
      <mesh material={stone} position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 1.1, 0.7]} />
      </mesh>
      <group position={[0, 1.16, 0]} rotation-x={-0.35}>
        <group ref={left}>
          <mesh material={leather} position={[-0.26, 0.03, 0]}>
            <boxGeometry args={[0.52, 0.06, 0.7]} />
          </mesh>
          <mesh material={pages} position={[-0.25, 0.065, 0]}>
            <boxGeometry args={[0.48, 0.015, 0.64]} />
          </mesh>
        </group>
        <group ref={right}>
          <mesh material={leather} position={[0.26, 0.03, 0]}>
            <boxGeometry args={[0.52, 0.06, 0.7]} />
          </mesh>
          <mesh material={pages} position={[0.25, 0.065, 0]}>
            <boxGeometry args={[0.48, 0.015, 0.64]} />
          </mesh>
        </group>
      </group>
      <mesh material={beam} position={[0, 10, 0]}>
        <cylinderGeometry args={[0.25, 0.6, 18, 16, 1, true]} />
      </mesh>
    </group>
  );
}

const ECHO_SPOT = { x: 3.6, y: 0, z: -2.4 };
function EchoInKingdom() {
  const stage = useAetheria((s) => s.world.echo);
  const inDialogue = useDialogue((s) => !!s.defId);
  const awake = stage !== "dormant" && stage !== "silent_observer";
  useEffect(() => {
    if (!awake || inDialogue) {
      interactables.delete("echo-k");
      return;
    }
    interactables.set("echo-k", { id: "echo-k", label: "לדבר עם הד העתיד", x: ECHO_SPOT.x - 0.6, y: 0, z: ECHO_SPOT.z + 0.6, radius: 2.2, onContact: () => useDialogue.getState().open(ECHO_TALK) });
    return () => void interactables.delete("echo-k");
  }, [awake, inDialogue]);
  return <FutureEcho stage={stage} anchors={[ECHO_SPOT]} waitAnchor={ECHO_SPOT} waiting inDialogue={inDialogue} tint={{ color: "#8fb6ff", accent: "#e3ecff", veils: ["#5f8cff", "#cfe0ff"] }} />;
}

export function HallOfPatterns() {
  return (
    <>
      {DIALS.map((d) => (
        <Dial key={d} id={d} />
      ))}
      <Lens />
      <Codex />
      <EchoInKingdom />
    </>
  );
}

