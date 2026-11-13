/**
 * AETHERIA — the Kingdom of Wealth: the Vault of Value (the sixth kingdom).
 * Visual identity: monumental, precious, metallic — a gilded marble terrace ringed by fluted columns,
 * the vault's facade with a great round door, a balance the size of a house, rings of gold turning in
 * a clear golden morning.
 * Gameplay (engine-validated): CHANGE refines each plinth's ore into gold; CONNECTION carries each
 * ingot onto the empty pan (the scale tips toward balance); FORM shapes the key and the door rolls
 * aside; the sixth shard waits inside — and the way back to the Origin.
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
import { PLINTHS, VAULT_SITE, W, WEALTH_SITES, onEnterVault, onShard, plinthSite, type PlinthId } from "../../content/wealthKingdom";
import { resonateSite } from "../sanctuary/SleepingGate";
import { FutureEcho } from "../sanctuary/FutureEcho";
import { isleGeometry } from "../sanctuary/environment";
import { useSanctuaryKit } from "../sanctuary/architecture";
import { kingdomGlyph } from "../sanctuary/glyphs";
import { ResonanceFx } from "../../fx/ResonanceFx";
import { PostFx } from "../../../world/PostFx";
import { Arrival } from "../../../world/Arrival";
import { SoundController, DustMotes } from "../sanctuary/Life";
import { GOLD_GATE_ARRIVAL } from "../social/layout";
import { ORIGIN_ARRIVAL } from "../sanctuary/layout";
import { FALL_Y, PANS, PLINTH_SPOTS, SCALE, SHARD, SPAWN, TERRACE, VAULT, WAYSTONE } from "./layout";

const ease = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const showJournal = (before: number, tone: "discovery" | "resonance" | "echo" = "discovery") => {
  for (const j of useAetheria.getState().world.journal.slice(before)) {
    const text = JOURNAL[j.id];
    if (text) useAetheriaUi.getState().showCard({ title: text.title, body: text.body, tone });
  }
};
const VAULT_DEPTH = 8; // the vault room behind the facade

function useGold() {
  return useMemo(() => new THREE.MeshStandardMaterial({ color: 0xe0b860, metalness: 1, roughness: 0.22 }), []);
}

// ------------------------------------------------------------------ the terrace, columns, sky rings
function Terrace() {
  const marble = usePBR("granite", { tint: 0xf0e6d4 });
  const rock = usePBR("rock", { tint: 0x8a7a68 });
  const gold = useGold();
  const kit = useSanctuaryKit();
  const under = useMemo(() => isleGeometry(161), []);
  const top = useMemo(() => {
    const g = new THREE.CylinderGeometry(TERRACE.r, TERRACE.r * 0.98, 0.6, 72);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 3, p.getZ(i) / 3);
    return g;
  }, []);
  // a ring of fluted columns, open toward the arrival (south) and the vault (north)
  const columns = useMemo(() => {
    const out: { x: number; z: number; yaw: number }[] = [];
    for (let b = 0; b < 360; b += 24) {
      const nearVault = b < 40 || b > 320;
      const nearArrival = b > 155 && b < 205;
      if (nearVault || nearArrival) continue;
      const a = (b * Math.PI) / 180;
      out.push({ x: TERRACE.x + Math.sin(a) * (TERRACE.r - 1.4), z: TERRACE.z - Math.cos(a) * (TERRACE.r - 1.4), yaw: a });
    }
    return out;
  }, []);
  const S = TERRACE.r * 1.05;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.3, TERRACE.r]} position={[TERRACE.x, -0.3, TERRACE.z]} />
        {columns.map((c, i) => (
          <CylinderCollider key={i} args={[3, 0.5]} position={[c.x, 3, c.z]} />
        ))}
      </RigidBody>
      <mesh geometry={top} material={marble} position={[TERRACE.x, -0.3, TERRACE.z]} receiveShadow />
      <group position={[TERRACE.x, -0.6 - 0.12 * S, TERRACE.z]} scale={[S, S * 1.1, S]}>
        <mesh geometry={under} material={rock} />
      </group>
      {columns.map((c, i) => (
        <mesh key={i} geometry={kit.col_full} material={marble} position={[c.x, 0, c.z]} rotation-y={c.yaw} castShadow receiveShadow />
      ))}
    </group>
  );
}

function SkyRings() {
  const gold = useGold();
  const rings = useMemo(
    () => [
      { r: 18, y: 34, z: -30, tilt: 0.4, speed: 0.05 },
      { r: 11, y: 26, z: -40, tilt: -0.6, speed: -0.08 },
      { r: 26, y: 48, z: -55, tilt: 0.2, speed: 0.03 },
    ],
    [],
  );
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((_, dt) => refs.current.forEach((m, i) => m && (m.rotation.z += dt * rings[i].speed)));
  return (
    <group userData={{ noBatch: true }}>
      {rings.map((r, i) => (
        <mesh key={i} ref={(el) => void (refs.current[i] = el)} material={gold} position={[0, r.y, r.z]} rotation-x={r.tilt}>
          <torusGeometry args={[r.r, 0.5, 10, 120]} />
        </mesh>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ the vault
function Vault() {
  const marble = usePBR("granite", { tint: 0xf0e6d4 });
  const gold = useGold();
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xb8a070, metalness: 1, roughness: 0.3 }), []);
  const emblem = useMemo(() => new THREE.MeshBasicMaterial({ map: kingdomGlyph("wealth"), color: new THREE.Color("#ffd27a").multiplyScalar(2), transparent: true, toneMapped: false }), []);
  const treasure = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xe8c068, metalness: 0.85, roughness: 0.3, emissive: new THREE.Color("#c08a30"), emissiveIntensity: 0.35 }), []);
  const shardMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff0c8").multiplyScalar(2.2), toneMapped: false }), []);
  const open = useAetheria((s) => siteState(s.world, WEALTH_SITES[VAULT_SITE]) === "open");
  const placed = useAetheria((s) => PLINTHS.filter((p) => siteState(s.world, WEALTH_SITES[plinthSite(p)]) === "placed").length);
  const hasShard = useAetheria((s) => s.world.flags.includes(W.shard));
  const power = useAetheriaUi((s) => s.power);
  const door = useRef<THREE.Group>(null);
  const shard = useRef<THREE.Mesh>(null);
  const t = useRef(-1);
  useFrame(({ clock }, dt) => {
    if (t.current < 0) t.current = open ? 1 : 0;
    t.current = open ? Math.min(1, t.current + Math.min(dt, 0.1) / 3) : 0;
    const k = ease(t.current);
    // the round door rolls aside along the facade
    if (door.current) {
      door.current.position.x = VAULT.x + k * (VAULT.doorR * 2 + 0.4);
      door.current.rotation.z = -k * 2.1;
    }
    if (shard.current) {
      shard.current.visible = !hasShard;
      shard.current.rotation.y += Math.min(dt, 0.1);
      shard.current.position.y = 1.7 + Math.sin(clock.elapsedTime * 1.4) * 0.1;
    }
  });
  useEffect(() => {
    if (open) return;
    interactables.set("vault", {
      id: "vault",
      label: power ? `הפעילו ${FORCE_TITLES[power]}: דלת הכספת` : "דלת הכספת: בחרו כוח",
      x: VAULT.x,
      y: 0,
      z: VAULT.z + 2.2,
      radius: 2.2,
      onContact: () => {
        resonateSite(VAULT_SITE, { x: VAULT.x, y: VAULT.doorR, z: VAULT.z + 0.4 });
        if (useAetheria.getState().lastRejection === "resonance:not_ready") useAetheriaUi.getState().say(`המאזניים לא מאוזנים (${placed} מתוך ${PLINTHS.length}). אין מפתח למה שלא שווה כלום.`);
      },
    });
    return () => void interactables.delete("vault");
  }, [open, power, placed]);
  useEffect(() => {
    if (!open || hasShard) return;
    interactables.set("shard", {
      id: "shard",
      label: "קחו את הרסיס השישי",
      x: SHARD.x,
      y: 0,
      z: SHARD.z + 1.3,
      radius: 1.8,
      onContact: () => {
        const st = useAetheria.getState();
        const before = st.world.journal.length;
        if (st.dispatch(onShard())) {
          playerReactions.emit("celebrate");
          showJournal(before, "resonance");
        }
      },
    });
    return () => void interactables.delete("shard");
  }, [open, hasShard]);
  // with the shard in hand, the vault's far wall becomes the way back to the Origin
  useEffect(() => {
    if (!hasShard || !worldAvailable("sanctuary")) return;
    interactables.set("to-origin", {
      id: "to-origin",
      label: "חזרו אל שבר המקור",
      x: SHARD.x,
      y: 0,
      z: SHARD.z - 1.4,
      radius: 1.8,
      onContact: () => {
        setArrival("sanctuary", ORIGIN_ARRIVAL);
        void goToWorld("sanctuary", { style: "resonance" });
      },
    });
    return () => void interactables.delete("to-origin");
  }, [hasShard]);
  const fz = VAULT.z - 1.5; // facade centre (3 m thick)
  const half = VAULT.facadeW / 2;
  return (
    <group userData={{ noBatch: true }}>
      <RigidBody type="fixed" colliders={false}>
        {/* the facade, with an opening for the door */}
        <CuboidCollider args={[(half - VAULT.doorR) / 2, VAULT.facadeH / 2, 1.5]} position={[-(half + VAULT.doorR) / 2, VAULT.facadeH / 2, fz]} />
        <CuboidCollider args={[(half - VAULT.doorR) / 2, VAULT.facadeH / 2, 1.5]} position={[(half + VAULT.doorR) / 2, VAULT.facadeH / 2, fz]} />
        <CuboidCollider args={[VAULT.doorR, (VAULT.facadeH - VAULT.doorR * 2) / 2, 1.5]} position={[0, VAULT.doorR * 2 + (VAULT.facadeH - VAULT.doorR * 2) / 2, fz]} />
        {/* the vault room behind */}
        <CuboidCollider args={[5, 0.3, VAULT_DEPTH / 2]} position={[0, -0.3, VAULT.z - 3 - VAULT_DEPTH / 2 + 0.5]} />
        <CuboidCollider args={[0.4, 4, VAULT_DEPTH / 2]} position={[-5, 4, VAULT.z - 3 - VAULT_DEPTH / 2 + 0.5]} />
        <CuboidCollider args={[0.4, 4, VAULT_DEPTH / 2]} position={[5, 4, VAULT.z - 3 - VAULT_DEPTH / 2 + 0.5]} />
        <CuboidCollider args={[5, 4, 0.4]} position={[0, 4, VAULT.z - 3 - VAULT_DEPTH]} />
        <CylinderCollider args={[0.5, 0.6]} position={[SHARD.x, 0.5, SHARD.z]} />
      </RigidBody>
      {/* the closed door (its own body, so it goes away cleanly when the vault opens) */}
      {!open && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[VAULT.doorR, VAULT.doorR, 0.4]} position={[VAULT.x, VAULT.doorR, VAULT.z + 0.2]} />
        </RigidBody>
      )}
      {/* facade */}
      <mesh material={marble} position={[-(half + VAULT.doorR) / 2, VAULT.facadeH / 2, fz]} castShadow receiveShadow>
        <boxGeometry args={[half - VAULT.doorR, VAULT.facadeH, 3]} />
      </mesh>
      <mesh material={marble} position={[(half + VAULT.doorR) / 2, VAULT.facadeH / 2, fz]} castShadow receiveShadow>
        <boxGeometry args={[half - VAULT.doorR, VAULT.facadeH, 3]} />
      </mesh>
      <mesh material={marble} position={[0, VAULT.doorR * 2 + (VAULT.facadeH - VAULT.doorR * 2) / 2, fz]} castShadow receiveShadow>
        <boxGeometry args={[VAULT.doorR * 2, VAULT.facadeH - VAULT.doorR * 2, 3]} />
      </mesh>
      {/* gilded cornice + a plinth band on either side of the doorway */}
      <mesh material={gold} position={[0, VAULT.facadeH - 0.5, VAULT.z + 0.05]}>
        <boxGeometry args={[VAULT.facadeW + 0.4, 0.3, 0.2]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} material={gold} position={[(side * (half + VAULT.doorR + 0.2)) / 2, 1.5, VAULT.z + 0.05]}>
          <boxGeometry args={[half - VAULT.doorR + 0.2, 0.3, 0.2]} />
        </mesh>
      ))}
      <mesh material={gold} position={[0, VAULT.doorR, VAULT.z + 0.05]}>
        <torusGeometry args={[VAULT.doorR + 0.15, 0.2, 12, 64]} />
      </mesh>
      {/* the round door */}
      <group ref={door} position={[VAULT.x, VAULT.doorR, VAULT.z + 0.2]}>
        <mesh material={steel} rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[VAULT.doorR - 0.05, VAULT.doorR - 0.05, 0.7, 48]} />
        </mesh>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <mesh key={i} material={gold} position={[Math.cos(a) * (VAULT.doorR - 0.5), Math.sin(a) * (VAULT.doorR - 0.5), 0.38]} rotation-z={a}>
              <boxGeometry args={[0.7, 0.18, 0.12]} />
            </mesh>
          );
        })}
        <mesh material={emblem} position={[0, 0, 0.37]}>
          <circleGeometry args={[1.2, 32]} />
        </mesh>
      </group>
      {/* the vault room and the sixth shard */}
      <mesh material={marble} position={[0, -0.3, VAULT.z - 3 - VAULT_DEPTH / 2 + 0.5]} receiveShadow>
        <boxGeometry args={[10, 0.6, VAULT_DEPTH]} />
      </mesh>
      {[-5, 5].map((x) => (
        <mesh key={x} material={marble} position={[x, 4, VAULT.z - 3 - VAULT_DEPTH / 2 + 0.5]}>
          <boxGeometry args={[0.8, 8, VAULT_DEPTH]} />
        </mesh>
      ))}
      <mesh material={marble} position={[0, 4, VAULT.z - 3 - VAULT_DEPTH]}>
        <boxGeometry args={[10, 8, 0.8]} />
      </mesh>
      {/* the treasury: gilded bands along the walls and stacks of ingots, the value that waited */}
      {[-4.55, 4.55].map((x) => (
        <group key={x}>
          {[2.2, 6.2].map((y) => (
            <mesh key={y} material={treasure} position={[x, y, VAULT.z - 3 - VAULT_DEPTH / 2 + 0.5]}>
              <boxGeometry args={[0.12, 0.22, VAULT_DEPTH - 0.4]} />
            </mesh>
          ))}
          {[-1, 1].map((k) => (
            <group key={k} position={[x * 0.78, 0, VAULT.z - 3 - VAULT_DEPTH / 2 + 0.5 + k * 2]}>
              {[0, 1, 2].map((row) =>
                [0, 1, 2 - row].slice(0, 3 - row).map((c) => (
                  <mesh key={`${row}-${c}`} material={treasure} position={[0, 0.13 + row * 0.26, (c - (2 - row) / 2) * 0.55]} castShadow>
                    <boxGeometry args={[0.9, 0.25, 0.5]} />
                  </mesh>
                )),
              )}
            </group>
          ))}
        </group>
      ))}
      <mesh material={treasure} position={[0, 8, VAULT.z - 3 - VAULT_DEPTH + 0.45]}>
        <boxGeometry args={[9.2, 0.3, 0.12]} />
      </mesh>
      <mesh material={marble} position={[SHARD.x, 0.5, SHARD.z]}>
        <cylinderGeometry args={[0.5, 0.6, 1, 16]} />
      </mesh>
      <mesh ref={shard} material={shardMat} position={[SHARD.x, 1.7, SHARD.z]} scale={[0.22, 0.42, 0.22]}>
        <octahedronGeometry args={[1, 0]} />
      </mesh>
      {open && <pointLight position={[SHARD.x, 2.5, SHARD.z]} color={0xffe2a0} intensity={10} distance={12} />}
    </group>
  );
}

// ------------------------------------------------------------------ the balance
function Balance() {
  const marble = usePBR("granite", { tint: 0xf0e6d4 });
  const gold = useGold();
  const bronze = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x5a4028, metalness: 0.8, roughness: 0.5 }), []);
  const placed = useAetheria((s) => PLINTHS.filter((p) => siteState(s.world, WEALTH_SITES[plinthSite(p)]) === "placed").length);
  const beam = useRef<THREE.Group>(null);
  const pans = useRef<(THREE.Group | null)[]>([]);
  const tilt = useRef(-1);
  useFrame((_, dt) => {
    // the ancient weight (3) against the gold: heavier side down
    const want = ((3 - placed) / 3) * 0.28;
    if (tilt.current < 0) tilt.current = want;
    tilt.current += (want - tilt.current) * (1 - Math.exp(-1.2 * Math.min(dt, 0.1)));
    if (beam.current) beam.current.rotation.z = tilt.current;
    // the pans hang plumb from the beam's ends
    pans.current.forEach((p, i) => {
      if (!p) return;
      const side = i === 0 ? -1 : 1;
      p.position.set(side * (SCALE.beam / 2) * Math.cos(tilt.current), 5.2 + side * (SCALE.beam / 2) * Math.sin(tilt.current) - 2.6, 0);
    });
  });
  return (
    <group position={[SCALE.x, 0, SCALE.z]} userData={{ noBatch: true }}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[2.6, 0.5]} position={[0, 2.6, 0]} />
        <CylinderCollider args={[0.4, 1.2]} position={[0, 0.4, 0]} />
      </RigidBody>
      <mesh material={marble} position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[1.1, 1.3, 0.8, 24]} />
      </mesh>
      <mesh material={gold} position={[0, 2.9, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.42, 4.6, 16]} />
      </mesh>
      <group ref={beam} position={[0, 5.2, 0]}>
        <mesh material={gold} castShadow>
          <boxGeometry args={[SCALE.beam + 0.4, 0.3, 0.3]} />
        </mesh>
      </group>
      {[0, 1].map((i) => (
        <group key={i} ref={(el) => void (pans.current[i] = el)}>
          {/* chains (three lines of gold) */}
          {[0, 1, 2].map((k) => {
            const a = (k / 3) * Math.PI * 2;
            return (
              <mesh key={k} material={gold} position={[Math.cos(a) * 0.7, 1.3, Math.sin(a) * 0.7]} rotation={[Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25]}>
                <cylinderGeometry args={[0.02, 0.02, 2.6, 4]} />
              </mesh>
            );
          })}
          <mesh material={gold} castShadow>
            <cylinderGeometry args={[SCALE.panR, SCALE.panR * 0.8, 0.2, 32]} />
          </mesh>
          {i === 0 ? (
            <mesh material={bronze} position={[0, 0.5, 0]} castShadow>
              <boxGeometry args={[1.1, 0.8, 1.1]} />
            </mesh>
          ) : (
            Array.from({ length: placed }, (_, k) => (
              <mesh key={k} material={gold} position={[(k - 1) * 0.55, 0.22, 0]} castShadow>
                <boxGeometry args={[0.5, 0.25, 0.9]} />
              </mesh>
            ))
          )}
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ plinths: ore -> gold -> onto the pan
function Plinth({ id }: { id: PlinthId }) {
  const marble = usePBR("granite", { tint: 0xe8dcc8 });
  const gold = useGold();
  const oreMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x3a342e, roughness: 0.9, metalness: 0.3, emissive: new THREE.Color("#ffb040"), emissiveIntensity: 0.08 }), []);
  const spot = PLINTH_SPOTS[id];
  const state = useAetheria((s) => siteState(s.world, WEALTH_SITES[plinthSite(id)]));
  const power = useAetheriaUi((s) => s.power);
  const ingot = useRef<THREE.Mesh>(null);
  const fly = useRef(-1);
  useFrame(({ clock }, dt) => {
    // a placed ingot flies (once) from the plinth to the right pan, then this one hides
    if (fly.current < 0) fly.current = state === "placed" ? 1 : 0;
    if (state === "placed") fly.current = Math.min(1, fly.current + Math.min(dt, 0.1) / 1.2);
    if (!ingot.current) return;
    const k = ease(fly.current);
    const from = new THREE.Vector3(spot.x, 1.45, spot.z);
    const to = new THREE.Vector3(PANS.right.x, 2.8, PANS.right.z);
    ingot.current.position.lerpVectors(from, to, k);
    ingot.current.position.y += Math.sin(k * Math.PI) * 3;
    ingot.current.visible = state === "gold" || (state === "placed" && fly.current < 1);
    oreMat.emissiveIntensity = 0.08 + Math.max(0, Math.sin(clock.elapsedTime * 2 + spot.x)) * 0.12;
  });
  useEffect(() => {
    if (state === "placed") return;
    const key = `plinth-${id}`;
    interactables.set(key, {
      id: key,
      label: power ? `הפעילו ${FORCE_TITLES[power]}: ${state === "ore" ? "עפרה גולמית" : "מטיל זהב"}` : `${state === "ore" ? "עפרה גולמית" : "מטיל זהב"}: בחרו כוח`,
      x: spot.x + (spot.x > 0 ? -1.4 : 1.4),
      y: 0,
      z: spot.z,
      radius: 1.8,
      onContact: () => resonateSite(plinthSite(id), { x: spot.x, y: 1.5, z: spot.z }),
    });
    return () => void interactables.delete(key);
  }, [state, power, id, spot.x, spot.z]);
  return (
    <group userData={{ noBatch: true }}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.6, 0.55]} position={[spot.x, 0.6, spot.z]} />
      </RigidBody>
      <mesh material={marble} position={[spot.x, 0.6, spot.z]} castShadow>
        <cylinderGeometry args={[0.5, 0.6, 1.2, 16]} />
      </mesh>
      {state === "ore" && (
        <mesh material={oreMat} position={[spot.x, 1.55, spot.z]} castShadow>
          <dodecahedronGeometry args={[0.38, 0]} />
        </mesh>
      )}
      <mesh ref={ingot} material={gold} position={[spot.x, 1.45, spot.z]} castShadow visible={false}>
        <boxGeometry args={[0.5, 0.25, 0.9]} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ the Echo, the way back, story
const ECHO_SPOT = { x: -7, y: 0, z: -1 };
function EchoInVault() {
  const stage = useAetheria((s) => s.world.echo);
  const inDialogue = useDialogue((s) => !!s.defId);
  const awake = stage !== "dormant" && stage !== "silent_observer";
  useEffect(() => {
    if (!awake || inDialogue) {
      interactables.delete("echo-w");
      return;
    }
    interactables.set("echo-w", { id: "echo-w", label: "לדבר עם הד העתיד", x: ECHO_SPOT.x + 0.8, y: 0, z: ECHO_SPOT.z + 0.8, radius: 2.2, onContact: () => useDialogue.getState().open(ECHO_TALK) });
    return () => void interactables.delete("echo-w");
  }, [awake, inDialogue]);
  return <FutureEcho stage={stage} anchors={[ECHO_SPOT]} waitAnchor={ECHO_SPOT} waiting inDialogue={inDialogue} tint={{ color: "#ffe6a8", accent: "#fffaf0", veils: ["#ffd27a", "#bfefff"] }} />;
}

function Waystone() {
  const stone = usePBR("granite", { tint: 0xd8ccb8 });
  const rune = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: new THREE.Color("#ffd27a"), emissiveIntensity: 2.5 }), []);
  useEffect(() => {
    if (!worldAvailable("social")) return;
    interactables.set("waystone-w", {
      id: "waystone-w",
      label: "אבן הדרך: חזרה אל כפר האח",
      x: WAYSTONE.x - 1,
      y: 0,
      z: WAYSTONE.z,
      radius: 1.8,
      onContact: () => {
        setArrival("social", GOLD_GATE_ARRIVAL);
        void goToWorld("social", { style: "resonance" });
      },
    });
    return () => void interactables.delete("waystone-w");
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
    if (st.world.flags.includes(W.entered)) return;
    const before = st.world.journal.length;
    if (st.dispatch(onEnterVault())) {
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
  });
  return null;
}

export function WealthScene({ quality }: { quality: Quality }) {
  return (
    <group>
      <Terrace />
      <SkyRings />
      <Vault />
      <Balance />
      {PLINTHS.map((p) => (
        <Plinth key={p} id={p} />
      ))}
      <EchoInVault />
      <Waystone />
      <Story />
      <Arrival world="wealth" />
      <ResonanceFx />
      <PostFx quality={quality} />
      <SoundController />
      <DustMotes count={quality === "low" ? 100 : 200} />
    </group>
  );
}
