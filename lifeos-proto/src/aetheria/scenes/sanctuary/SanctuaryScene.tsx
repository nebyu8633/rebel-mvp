/**
 * AETHERIA — The First Sanctuary: a misty plateau above the clouds with an abandoned observatory.
 * Gameplay: reach the observatory -> touch the Origin Fragment (the Future Echo appears as the
 * Silent Observer) -> align the three astrolabe rings (Form, Change, Connection) -> awaken the
 * Resonance (the dome opens, the broken stair reassembles: new colliders, a new path upward) ->
 * read the six kingdom sigils on the gallery.
 * All world changes go through the AETHERIA rules engine; the scene only renders state.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, BallCollider, RigidBody } from "@react-three/rapier";
import { usePBR } from "../../../world/materials";
import { rng, worldBox, worldCylinder } from "../../../world/geometry";
import { Batched } from "../../../world/Batched";
import { Tree } from "../../../world/Trees";
import { interactables, type Quality } from "../../../store";
import { telemetry } from "../../../player/Player";
import { playerReactions } from "../../../engine/events";
import { goToWorld, worldAvailable } from "../../../engine/worldStore";
import { useAetheria } from "../../store";
import { useAetheriaUi } from "../../ui/uiStore";
import { FORCES, FORCE_TITLES, type Force } from "../../core/model";
import {
  F,
  JOURNAL,
  SIGILS,
  canReadSigils,
  canResonate,
  fragmentGlowBoost,
  memoryShards,
  onAlign,
  onArrive,
  onObservatory,
  onReadSigils,
  onResonanceComplete,
  onTerrace,
  onTouchFragment,
} from "../../content/firstResonance";
import { BOUND_R, CONSOLES, FLOOR_Y, FRAGMENT, GALLERY, OBS, PEDESTAL, SIGIL_WALL, STAIR, WAYSTONE, around, insideObservatory, onGallery, stepAt, stepRun } from "./layout";
import { forceGlyph, kingdomGlyph } from "./glyphs";
import { FutureEcho } from "./FutureEcho";

const RESONANCE_S = 10;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const glowMat = (color: string | number, i = 2) => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: color, emissiveIntensity: i, roughness: 0.5 });

/** Shared resonance clock (0..1), read by every animated part. */
const resonance = { p: 0, running: false, t: 0 };

// ------------------------------------------------------------------ terrain: plateau above a sea of clouds
function Terrain() {
  const meadow = usePBR("meadow", { tint: 0xc9d3b2 });
  const rock = usePBR("rock", { tint: 0xb9b4aa });
  const path = usePBR("mosspath");
  const geo = useMemo(() => {
    const S = 260;
    const g = new THREE.PlaneGeometry(S, S, 130, 130);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const r = rng(5);
    const bumps = Array.from({ length: 24 }, () => ({ a: r() * Math.PI * 2, f: 1 + Math.floor(r() * 5), amp: r() }));
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const d = Math.hypot(x, z);
      const ang = Math.atan2(z, x);
      let ripple = 0;
      for (const b of bumps) ripple += Math.sin(ang * b.f + b.a) * b.amp;
      const hills = smooth(38, 52, d) * (3 + ripple * 0.9);
      const cliff = -smooth(62, 78, d) * 60;
      p.setY(i, d < 34 ? Math.sin(x * 0.15) * Math.cos(z * 0.13) * 0.04 : hills + cliff);
      uv.setXY(i, x / 4, z / 4);
    }
    g.computeVertexNormals();
    const pathGeo = new THREE.PlaneGeometry(3.4, 33, 1, 1);
    pathGeo.rotateX(-Math.PI / 2);
    const puv = pathGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < puv.count; i++) puv.setXY(i, (puv.getX(i) * 3.4) / 2, (puv.getY(i) * 33) / 2);
    return { ground: g, path: pathGeo };
  }, []);
  const rocks = useMemo(() => {
    const r = rng(17);
    const out: { x: number; z: number; y: number; s: [number, number, number]; rot: number; geo: THREE.BufferGeometry; collide: boolean }[] = [];
    const make = (seed: number) => {
      const g = new THREE.IcosahedronGeometry(1, 2);
      const p = g.attributes.position as THREE.BufferAttribute;
      const rr = rng(seed);
      const amp = Array.from({ length: 6 }, () => rr());
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i);
        const n = 1 + 0.18 * (Math.sin(v.x * 3 + amp[0] * 6) + Math.sin(v.y * 4 + amp[1] * 6) + Math.sin(v.z * 3.5 + amp[2] * 6)) / 3 - (v.y < -0.3 ? 0.25 : 0);
        v.multiplyScalar(n);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
      return g;
    };
    // boulders on the plateau (colliders) — keep the path and observatory clear
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const d = 14 + r() * 22;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (Math.abs(x) < 6 && z > -2) continue;
      if (Math.hypot(x - OBS.x, z - OBS.z) < 11) continue;
      const s = 0.6 + r() * 1.6;
      out.push({ x, z, y: s * 0.35, s: [s * (1 + r() * 0.6), s * (0.7 + r() * 0.5), s * (1 + r() * 0.5)], rot: r() * 6, geo: make(100 + i), collide: true });
    }
    // crags on the rim
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + r() * 0.1;
      const d = 44 + r() * 14;
      const s = 4 + r() * 8;
      out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: s * 0.4 + 2, s: [s, s * (1.2 + r()), s], rot: r() * 6, geo: make(300 + i), collide: false });
    }
    return out;
  }, []);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[60, 0.5, 60]} position={[0, -0.5, 0]} />
        {/* edge of the walkable plateau */}
        {Array.from({ length: 28 }, (_, i) => {
          const a = (i / 28) * Math.PI * 2;
          return <CuboidCollider key={i} args={[4.6, 4, 0.5]} position={[Math.cos(a) * BOUND_R, 4, Math.sin(a) * BOUND_R]} rotation={[0, -a + Math.PI / 2, 0]} />;
        })}
        {rocks
          .filter((k) => k.collide)
          .map((k, i) => (
            <BallCollider key={i} args={[Math.min(k.s[0], k.s[2]) * 0.85]} position={[k.x, k.y, k.z]} />
          ))}
      </RigidBody>
      <mesh geometry={geo.ground} material={meadow} receiveShadow />
      <mesh geometry={geo.path} material={path} position={[0, 0.015, 34 - 33 / 2]} receiveShadow />
      {rocks.map((k, i) => (
        <mesh key={i} geometry={k.geo} material={rock} position={[k.x, k.y, k.z]} scale={k.s} rotation-y={k.rot} castShadow={k.collide} receiveShadow />
      ))}
    </group>
  );
}

/** Distant floating isles + a sea of clouds below the cliffs (fantasy silhouette). */
function Sky() {
  const rock = usePBR("rock", { tint: 0x9d9a94 });
  const isles = useMemo(() => {
    const r = rng(41);
    return Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2 + r();
      const d = 95 + r() * 70;
      const g = new THREE.ConeGeometry(1, 1.6, 7, 3);
      g.rotateX(Math.PI);
      return { x: Math.cos(a) * d, z: Math.sin(a) * d, y: 18 + r() * 40, s: 5 + r() * 9, phase: r() * 6, g };
    });
  }, []);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => (c.position.y = isles[i].y + Math.sin(clock.elapsedTime * 0.3 + isles[i].phase) * 0.8));
  });
  const clouds = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xe9e6f2, roughness: 1, emissive: 0x6c6f88, emissiveIntensity: 0.25 }), []);
  return (
    <group userData={{ noBatch: true }}>
      <mesh rotation-x={-Math.PI / 2} position={[0, -22, 0]} material={clouds}>
        <circleGeometry args={[600, 48]} />
      </mesh>
      <group ref={ref}>
        {isles.map((s, i) => (
          <mesh key={i} geometry={s.g} material={rock} position={[s.x, s.y, s.z]} scale={[s.s, s.s, s.s]} />
        ))}
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ the approach: ruined colonnade + arch
function Ruins() {
  const wall = usePBR("ruinwall", { tint: 0xd6cfc2 });
  const cols = useMemo(() => {
    const r = rng(23);
    const out: { x: number; z: number; h: number; tilt: number }[] = [];
    for (let z = 28; z >= 6; z -= 5.5) for (const x of [-3.3, 3.3]) out.push({ x, z, h: r() < 0.35 ? 1.2 + r() * 2 : 4.2 + r() * 0.6, tilt: (r() - 0.5) * 0.06 });
    return out;
  }, []);
  const colGeo = useMemo(() => worldCylinder(0.38, 0.45, 1, 1.5, 14), []);
  const capGeo = useMemo(() => worldBox(1.1, 0.3, 1.1, 1.5), []);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {cols.map((c, i) => (
          <CylinderCollider key={i} args={[c.h / 2, 0.45]} position={[c.x, c.h / 2, c.z]} />
        ))}
        {/* fallen column */}
        <CuboidCollider args={[2.4, 0.42, 0.42]} position={[6.2, 0.42, 15]} rotation={[0, 0.5, 0]} />
        {/* the arch pillars */}
        <CuboidCollider args={[0.55, 2.4, 0.55]} position={[-2.4, 2.4, 19]} />
        <CuboidCollider args={[0.55, 2.4, 0.55]} position={[2.4, 2.4, 19]} />
      </RigidBody>
      {cols.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} rotation-z={c.tilt}>
          <mesh geometry={colGeo} material={wall} scale={[1, c.h, 1]} position={[0, c.h / 2, 0]} castShadow receiveShadow />
          {c.h > 4 && <mesh geometry={capGeo} material={wall} position={[0, c.h + 0.15, 0]} castShadow />}
        </group>
      ))}
      <mesh geometry={colGeo} material={wall} scale={[1, 4.8, 1]} position={[6.2, 0.42, 15]} rotation={[0, 0.5, Math.PI / 2]} castShadow receiveShadow />
      <mesh geometry={useMemo(() => worldBox(1.1, 4.8, 1.1, 2), [])} material={wall} position={[-2.4, 2.4, 19]} castShadow receiveShadow />
      <mesh geometry={useMemo(() => worldBox(1.1, 4.8, 1.1, 2), [])} material={wall} position={[2.4, 2.4, 19]} castShadow receiveShadow />
      <mesh geometry={useMemo(() => worldBox(6.2, 0.9, 1.2, 2), [])} material={wall} position={[0, 5.25, 19]} castShadow receiveShadow />
    </group>
  );
}

// ------------------------------------------------------------------ the observatory
function Observatory({ done }: { done: boolean }) {
  const wall = usePBR("ruinwall", { tint: 0xe2dbcf });
  const floor = usePBR("ruinfloor", { tint: 0xcfc9bf });
  const segs = useMemo(() => {
    const out: { b: number; h: number; w: number }[] = [];
    const r = rng(31);
    for (let b = -180; b < 180; b += 10) {
      const mid = b + 5;
      if (Math.abs(((mid - OBS.doorBearing + 540) % 360) - 180) < OBS.doorHalfDeg) continue;
      const breach = mid > 55 && mid < 85; // a collapsed section on the east side
      out.push({ b: mid, h: breach ? 2 + r() * 1.5 : OBS.wallH - (r() < 0.2 ? r() * 1.8 : 0), w: 2 * OBS.wallR * Math.sin(((10 / 2) * Math.PI) / 180) + 0.12 });
    }
    return out;
  }, []);
  const gallery = useMemo(() => {
    const out: number[] = [];
    for (let b = GALLERY.from; b < GALLERY.to; b += 5) out.push(b + 2.5);
    return out;
  }, []);
  const galleryW = 2 * GALLERY.rOut * Math.sin(((5 / 2) * Math.PI) / 180) + 0.05;
  const galleryD = GALLERY.rOut - GALLERY.rIn;
  const segGeo = useMemo(() => new Map<number, THREE.BufferGeometry>(), []);
  const geoFor = (w: number, h: number) => {
    const k = Math.round(h * 100);
    if (!segGeo.has(k)) segGeo.set(k, worldBox(w, h, OBS.wallT, 3));
    return segGeo.get(k)!;
  };
  const gGeo = useMemo(() => worldBox(galleryW, GALLERY.thick, galleryD, 2), [galleryW, galleryD]);
  const floorGeo = useMemo(() => worldCylinder(OBS.floorR + 0.4, OBS.floorR + 0.6, FLOOR_Y, 2.5, 48), []);
  const floorTop = useMemo(() => {
    const g = new THREE.CircleGeometry(OBS.floorR + 0.4, 48);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 2.5, p.getZ(i) / 2.5);
    return g;
  }, []);
  const stepGeo = useMemo(() => worldBox(STAIR.width, 1, stepRun() + 0.02, 1.5), []);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[FLOOR_Y / 2, OBS.floorR + 0.5]} position={[OBS.x, FLOOR_Y / 2, OBS.z]} />
        {segs.map((s) => {
          const p = around(s.b, OBS.wallR);
          return <CuboidCollider key={s.b} args={[s.w / 2, s.h / 2, OBS.wallT / 2]} position={[p.x, s.h / 2, p.z]} rotation={[0, (-s.b * Math.PI) / 180, 0]} />;
        })}
        {gallery.map((b) => {
          const p = around(b, (GALLERY.rIn + GALLERY.rOut) / 2);
          return <CuboidCollider key={b} args={[galleryW / 2, GALLERY.thick / 2, galleryD / 2]} position={[p.x, GALLERY.y - GALLERY.thick / 2, p.z]} rotation={[0, (-b * Math.PI) / 180, 0]} />;
        })}
        {/* stair collision = smooth ramps under the visual steps (standard game practice: no snagging on
            step edges). Before the Resonance only the intact lower flight is walkable; the upper flight is a
            solid block, so the gallery can't be reached. After it, one ramp spans floor -> gallery. */}
        {done ? <StairRamp from={-1} to={STAIR.steps - 1} /> : <StairRamp from={-1} to={STAIR.broken[0] - 1} />}
        {!done &&
          Array.from({ length: STAIR.steps }, (_, i) => i)
            .filter((i) => i > STAIR.broken[STAIR.broken.length - 1])
            .map((i) => {
              const st = stepAt(i);
              return <CuboidCollider key={i} args={[STAIR.width / 2, st.topY / 2, stepRun() / 2]} position={[OBS.x + STAIR.x, st.topY / 2, OBS.z + st.z]} />;
            })}
        <CylinderCollider args={[PEDESTAL.h / 2, PEDESTAL.r]} position={[OBS.x, FLOOR_Y + PEDESTAL.h / 2, OBS.z]} />
      </RigidBody>
      <mesh geometry={floorGeo} material={floor} position={[OBS.x, FLOOR_Y / 2, OBS.z]} receiveShadow />
      <mesh geometry={floorTop} material={floor} position={[OBS.x, FLOOR_Y + 0.002, OBS.z]} receiveShadow />
      {segs.map((s) => {
        const p = around(s.b, OBS.wallR);
        return <mesh key={s.b} geometry={geoFor(s.w, s.h)} material={wall} position={[p.x, s.h / 2, p.z]} rotation-y={(-s.b * Math.PI) / 180} castShadow receiveShadow />;
      })}
      {gallery.map((b) => {
        const p = around(b, (GALLERY.rIn + GALLERY.rOut) / 2);
        return <mesh key={b} geometry={gGeo} material={wall} position={[p.x, GALLERY.y - GALLERY.thick / 2, p.z]} rotation-y={(-b * Math.PI) / 180} castShadow receiveShadow />;
      })}
      {/* intact steps (static) */}
      {Array.from({ length: STAIR.steps }, (_, i) => i)
        .filter((i) => !STAIR.broken.includes(i))
        .map((i) => {
          const s = stepAt(i);
          return <mesh key={i} geometry={stepGeo} material={wall} scale={[1, s.topY, 1]} position={[OBS.x + STAIR.x, s.topY / 2, OBS.z + s.z]} castShadow receiveShadow />;
        })}
      {/* buttresses */}
      {[-150, -110, -60, -20, 25, 100, 140].map((b) => {
        const p = around(b, OBS.wallR + 0.9);
        return (
          <mesh key={b} material={wall} position={[p.x, 2.6, p.z]} rotation-y={(-b * Math.PI) / 180} castShadow receiveShadow>
            <boxGeometry args={[0.9, 5.2, 1.2]} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Ramp collider from the top edge of step `from` (-1 = floor) to the top edge of step `to`. */
function StairRamp({ from, to }: { from: number; to: number }) {
  const run = stepRun();
  const z0 = STAIR.z0 - run * (from + 1);
  const z1 = STAIR.z0 - run * (to + 1);
  const y0 = from < 0 ? FLOOR_Y : stepAt(from).topY;
  const y1 = stepAt(to).topY;
  const L = Math.hypot(z0 - z1, y1 - y0);
  const ang = Math.atan2(y1 - y0, z0 - z1);
  const T = 0.1;
  // centre of the slab, pushed down by half its thickness along the slab normal
  const cy = (y0 + y1) / 2 - (T / 2) * Math.cos(ang);
  const cz = (z0 + z1) / 2 - (T / 2) * Math.sin(ang);
  return <CuboidCollider args={[STAIR.width / 2, T / 2, L / 2]} position={[OBS.x + STAIR.x, cy, OBS.z + cz]} rotation={[ang, 0, 0]} />;
}

/** Broken steps: debris on the floor before the Resonance, flying into place during it. */
function BrokenStair() {
  const wall = usePBR("ruinwall", { tint: 0xe2dbcf });
  const stepGeo = useMemo(() => worldBox(STAIR.width, 1, stepRun() + 0.02, 1.5), []);
  const pieces = useMemo(() => {
    const r = rng(61);
    return STAIR.broken.map((i, k) => {
      const s = stepAt(i);
      const to = new THREE.Vector3(OBS.x + STAIR.x, s.topY / 2, OBS.z + s.z);
      const from = new THREE.Vector3(OBS.x + STAIR.x + 1.6 + r() * 1.6, 0.35 + r() * 0.2, OBS.z + 1.5 - k * 0.9 + r() * 0.4);
      return { i, to, from, h: s.topY, rot: new THREE.Euler(r() * 0.6, r() * 3, r() * 0.8), delay: k * 0.06 };
    });
  }, []);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    pieces.forEach((p, k) => {
      const m = refs.current[k];
      if (!m) return;
      const t = smooth(0.32 + p.delay, 0.62 + p.delay, resonance.p);
      m.position.lerpVectors(p.from, p.to, t);
      m.position.y += Math.sin(t * Math.PI) * 1.4; // lift through the air
      m.rotation.set(p.rot.x * (1 - t), p.rot.y * (1 - t), p.rot.z * (1 - t));
      // debris lies flat-ish (short) on the floor, grows to the full step height as it settles
      m.scale.set(1, THREE.MathUtils.lerp(0.35, p.h, t), 1);
    });
  });
  return (
    <group userData={{ noBatch: true }}>
      {pieces.map((p, k) => (
        <mesh key={p.i} ref={(el) => void (refs.current[k] = el)} geometry={stepGeo} material={wall} castShadow receiveShadow />
      ))}
    </group>
  );
}

/** Ruined dome: petals that open to the sky during the Resonance. */
function Dome() {
  const base = usePBR("ruinwall", { tint: 0xd8d0c4 });
  const wall = useMemo(() => {
    const m = base.clone();
    m.side = THREE.DoubleSide;
    return m;
  }, [base]);
  const N = 10;
  const R = OBS.wallR + 0.05;
  const petals = useMemo(() => {
    const r = rng(73);
    return Array.from({ length: N }, (_, i) => {
      const phiLen = ((Math.PI * 2) / N) * 0.94;
      const phi = (i / N) * Math.PI * 2;
      const g = new THREE.SphereGeometry(R, 10, 8, phi, phiLen, 0, Math.PI / 2);
      const mid = phi + phiLen / 2;
      // three.js sphere: x = -cos(phi)·sinθ, z = sin(phi)·sinθ
      const rim = new THREE.Vector3(-Math.cos(mid) * R, 0, Math.sin(mid) * R);
      g.translate(-rim.x, 0, -rim.z);
      const axis = new THREE.Vector3(0, 1, 0).cross(rim.clone().normalize()).normalize();
      return { g, rim, axis, missing: i === 3 || i === 7, crack: (r() - 0.5) * 0.12, open: 0.55 + r() * 0.2 };
    });
  }, [R]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const t = smooth(0.12, 0.5, resonance.p);
    petals.forEach((p, i) => {
      const g = refs.current[i];
      // positive angle about (up × outward) tips the petal outward, like a flower opening
      if (g) g.quaternion.setFromAxisAngle(p.axis, p.crack + t * p.open);
    });
  });
  return (
    <group position={[OBS.x, OBS.wallH, OBS.z]} userData={{ noBatch: true }}>
      {petals.map((p, i) =>
        p.missing ? null : (
          <group key={i} position={p.rim} ref={(el) => void (refs.current[i] = el)}>
            <mesh geometry={p.g} material={wall} castShadow />
          </group>
        ),
      )}
    </group>
  );
}

// ------------------------------------------------------------------ astrolabe: fragment, rings, consoles
function Astrolabe() {
  const world = useAetheria((s) => s.world);
  const granite = usePBR("ruinwall", { tint: 0xcfc7ba });
  const touched = world.flags.includes(F.fragment);
  const glowBoost = fragmentGlowBoost(world) ? 1.4 : 1;
  const fragMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xdff6ff, emissive: 0x8fd8ff, emissiveIntensity: 2.2, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.92 }), []);
  const ringMats = useMemo(() => ({ form: glowMat(0xffd27a, 0.35), change: glowMat(0x9fd8ff, 0.35), connection: glowMat(0xc4a7ff, 0.35) }) as Record<Force, THREE.MeshStandardMaterial>, []);
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 1, roughness: 0.3 }), []);
  const frag = useRef<THREE.Mesh>(null);
  const ringRefs = useRef<Record<Force, THREE.Group | null>>({ form: null, change: null, connection: null });
  const light = useRef<THREE.PointLight>(null);
  const beam = useRef<THREE.Mesh>(null);
  const radii: Record<Force, number> = { form: 1.15, change: 1.45, connection: 1.75 };
  const chaos: Record<Force, THREE.Euler> = useMemo(() => ({ form: new THREE.Euler(0.9, 0.2, 0.4), change: new THREE.Euler(-0.5, 1.1, 1.2), connection: new THREE.Euler(0.3, -0.8, -1.0) }), []);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const p = resonance.p;
    if (frag.current) {
      frag.current.rotation.y += dt * (0.6 + p * 4);
      frag.current.position.y = FRAGMENT.y + Math.sin(t * 1.3) * 0.08;
      fragMat.emissiveIntensity = (touched ? 2.6 : 1.6) * glowBoost + Math.sin(t * 2.2) * 0.3 + smooth(0, 0.3, p) * 6 - smooth(0.7, 1, p) * 4;
    }
    for (const f of FORCES) {
      const g = ringRefs.current[f];
      if (!g) continue;
      const aligned = world.flags.includes(F.ring(f));
      const target = aligned ? new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)) : new THREE.Quaternion().setFromEuler(chaos[f]);
      g.quaternion.slerp(target, 1 - Math.exp(-2.5 * dt));
      g.rotateOnAxis(new THREE.Vector3(0, 0, 1), dt * (aligned ? 0.4 + p * 3 : 0.15));
      g.scale.setScalar(1 + smooth(0.05, 0.4, p) * 0.35 - smooth(0.75, 1, p) * 0.2);
      ringMats[f].emissiveIntensity = aligned ? 2.2 + p * 3 : 0.35;
    }
    if (light.current) light.current.intensity = 6 + (touched ? 6 : 0) + smooth(0, 0.35, p) * 40 - smooth(0.7, 1, p) * 28;
    if (beam.current) {
      const m = beam.current.material as THREE.MeshBasicMaterial;
      // strong during the event, then a faint lingering glow (it was a near-opaque column on iPhone)
      m.opacity = smooth(0.08, 0.3, p) * (0.85 - smooth(0.72, 1, p) * 0.75);
      beam.current.visible = m.opacity > 0.01;
    }
  });
  return (
    <group position={[OBS.x, 0, OBS.z]}>
      <mesh geometry={useMemo(() => worldCylinder(PEDESTAL.r * 0.75, PEDESTAL.r, PEDESTAL.h, 1.5, 24), [])} material={granite} position={[0, FLOOR_Y + PEDESTAL.h / 2, 0]} castShadow receiveShadow />
      <group userData={{ noBatch: true }}>
        <mesh ref={frag} material={fragMat} position={[0, FRAGMENT.y, 0]} scale={[0.32, 0.6, 0.32]}>
          <octahedronGeometry args={[1, 0]} />
        </mesh>
        <pointLight ref={light} position={[0, FRAGMENT.y, 0]} color={0xa8e2ff} distance={18} decay={1.6} />
        {FORCES.map((f) => (
          <group key={f} ref={(el) => void (ringRefs.current[f] = el)} position={[0, FRAGMENT.y, 0]}>
            <mesh material={metal}>
              <torusGeometry args={[radii[f], 0.045, 10, 72]} />
            </mesh>
            <mesh material={ringMats[f]}>
              <torusGeometry args={[radii[f], 0.018, 6, 72]} />
            </mesh>
          </group>
        ))}
        <mesh ref={beam} position={[0, FRAGMENT.y + 60, 0]}>
          <cylinderGeometry args={[0.55, 1.4, 120, 24, 1, true]} />
          <meshBasicMaterial color={0xcff0ff} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function Console({ force, bearing, r }: { force: Force; bearing: number; r: number }) {
  const stone = usePBR("ruinwall", { tint: 0xc9c1b4 });
  const aligned = useAetheria((s) => s.world.flags.includes(F.ring(force)));
  const touched = useAetheria((s) => s.world.flags.includes(F.fragment));
  const p = around(bearing, r);
  const yaw = Math.atan2(OBS.x - p.x, OBS.z - p.z);
  const glyph = useMemo(() => new THREE.MeshBasicMaterial({ map: forceGlyph(force), transparent: true, toneMapped: false, color: 0x6a6a6a, depthWrite: false }), [force]);
  useEffect(() => {
    glyph.color.set(aligned ? 0xffe9b0 : touched ? 0x9fd8ff : 0x555555);
  }, [aligned, touched, glyph]);
  useEffect(() => {
    if (aligned || !touched) return;
    const ip = around(bearing, r - 1.1);
    const id = `console-${force}`;
    interactables.set(id, {
      id,
      label: `כוונו את טבעת ה${FORCE_TITLES[force]}`,
      x: ip.x,
      y: FLOOR_Y,
      z: ip.z,
      radius: 1.6,
      onContact: () => {
        useAetheria.getState().dispatch(onAlign(force));
        playerReactions.emit("acknowledge");
      },
    });
    return () => void interactables.delete(id);
  }, [aligned, touched, force, bearing, r]);
  return (
    <group position={[p.x, FLOOR_Y, p.z]} rotation-y={yaw}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.3, 0.7, 0.3]} position={[0, 0.7, 0]} />
      </RigidBody>
      <mesh material={stone} position={[0, 0.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 1.4, 0.6]} />
      </mesh>
      <mesh material={glyph} position={[0, 1.0, 0.305]} userData={{ noBatch: true }}>
        <planeGeometry args={[0.5, 0.5]} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ sigil wall on the gallery
function SigilWall() {
  const done = useAetheria((s) => s.world.flags.includes(F.resonance));
  const read = useAetheria((s) => s.world.flags.includes(F.kingdoms));
  const mats = useMemo(() => SIGILS.map((s) => new THREE.MeshBasicMaterial({ map: kingdomGlyph(s.kingdom), transparent: true, toneMapped: false, color: 0x333333, depthWrite: false })), []);
  const forceMats = useMemo(() => FORCES.map((f) => new THREE.MeshBasicMaterial({ map: forceGlyph(f), transparent: true, toneMapped: false, color: 0x333333, depthWrite: false })), []);
  useFrame(({ clock }) => {
    const lit = done ? 1 : smooth(0.55, 0.95, resonance.p);
    mats.forEach((m, i) => m.color.set(SIGILS[i].color).multiplyScalar(0.15 + lit * (read ? 1.6 : 1.1 + Math.sin(clock.elapsedTime * 2 + i) * 0.25)));
    forceMats.forEach((m) => m.color.setScalar(0.15 + lit * 1.2));
  });
  return (
    <group userData={{ noBatch: true }}>
      {SIGILS.map((s, i) => {
        const b = SIGIL_WALL.bearing - 40 + i * 16;
        const p = around(b, SIGIL_WALL.r);
        return (
          <mesh key={s.kingdom} material={mats[i]} position={[p.x, GALLERY.y + 1.5, p.z]} rotation-y={Math.atan2(OBS.x - p.x, OBS.z - p.z)}>
            <planeGeometry args={[1.05, 1.05]} />
          </mesh>
        );
      })}
      {FORCES.map((f, i) => {
        const p = around(SIGIL_WALL.bearing - 14 + i * 14, SIGIL_WALL.r);
        return (
          <mesh key={f} material={forceMats[i]} position={[p.x, GALLERY.y + 2.75, p.z]} rotation-y={Math.atan2(OBS.x - p.x, OBS.z - p.z)}>
            <planeGeometry args={[0.7, 0.7]} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Optional real-life memories: small crystals on the east gallery (never required). */
function MemoryShards() {
  const world = useAetheria((s) => s.world);
  const shards = useMemo(() => memoryShards(world), [world]);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => ref.current?.children.forEach((c, i) => (c.position.y = GALLERY.y + 1.1 + Math.sin(clock.elapsedTime * 1.4 + i) * 0.12)));
  return (
    <group ref={ref} userData={{ noBatch: true }}>
      {shards.map((k, i) => {
        const p = around(80 + i * 6, 6.6);
        const s = SIGILS.find((x) => x.kingdom === k)!;
        return (
          <mesh key={k} position={[p.x, GALLERY.y + 1.1, p.z]} material={glowMat(s.color, 3)} scale={[0.12, 0.22, 0.12]}>
            <octahedronGeometry args={[1, 0]} />
          </mesh>
        );
      })}
    </group>
  );
}

function Waystone() {
  const stone = usePBR("rock", { tint: 0xb7b2a8 });
  const rune = useMemo(() => glowMat(0x9fd8ff, 2.5), []);
  useEffect(() => {
    if (!worldAvailable("city")) return;
    interactables.set("waystone", {
      id: "waystone",
      label: "אבן הדרך: חזרה לעיר (שכבת המציאות)",
      x: WAYSTONE.x - 1,
      y: 0,
      z: WAYSTONE.z,
      radius: 1.8,
      onContact: () => void goToWorld("city", { style: "resonance" }),
    });
    return () => void interactables.delete("waystone");
  }, []);
  return (
    <group position={[WAYSTONE.x, 0, WAYSTONE.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.45, 1.2, 0.35]} position={[0, 1.2, 0]} />
      </RigidBody>
      <mesh material={stone} position={[0, 1.2, 0]} scale={[0.5, 1.25, 0.38]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh material={rune} position={[-0.42, 1.4, 0]} rotation-y={-Math.PI / 2}>
        <ringGeometry args={[0.16, 0.22, 6]} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ story triggers + the resonance sequence
function Story() {
  const world = useAetheria((s) => s.world);
  const hydrated = useAetheria((s) => s.hydrated);
  const dispatch = useAetheria((s) => s.dispatch);
  const showCard = useAetheriaUi((s) => s.showCard);
  const [, force] = useState(0);
  const acc = useRef(0);

  // returning after the Resonance: the world is already changed (persistent consequence)
  useEffect(() => {
    if (!hydrated) return;
    resonance.p = world.flags.includes(F.resonance) ? 1 : 0;
    resonance.running = false;
  }, [hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hydrated || world.flags.includes(F.arrived)) return;
    if (dispatch(onArrive())) {
      // the Living Architect's starter kit (World Progress, never Life XP)
      const st = useAetheria.getState();
      st.equipItem("architect_staff");
      st.equipItem("wayfinder_lantern");
      showCard({ title: JOURNAL["j.sanctuary"].title, body: JOURNAL["j.sanctuary"].body, tone: "discovery" });
    }
  }, [hydrated, world.flags, dispatch, showCard]);

  // the Origin Fragment: touch it, then (with the rings aligned) awaken the Resonance
  const touched = world.flags.includes(F.fragment);
  const ready = canResonate(world);
  useEffect(() => {
    if (!hydrated) return;
    const ip = around(180, 1.9);
    const label = !touched ? "גע באור שבמרכז המצפה" : ready ? "עוררו את התהודה" : null;
    if (!label || resonance.running) {
      interactables.delete("fragment");
      return;
    }
    interactables.set("fragment", {
      id: "fragment",
      label,
      x: ip.x,
      y: FLOOR_Y,
      z: ip.z,
      radius: 1.8,
      onContact: () => {
        const s = useAetheria.getState().world;
        if (!s.flags.includes(F.fragment)) {
          if (useAetheria.getState().dispatch(onTouchFragment(s))) {
            useAetheria.getState().equipItem("origin_pendant");
            playerReactions.emit("surprise");
            showCard({ title: JOURNAL["j.fragment"].title, body: JOURNAL["j.fragment"].body, tone: "discovery" });
            showCard({ title: JOURNAL["j.echo"].title, body: JOURNAL["j.echo"].body, tone: "echo" });
          }
        } else if (canResonate(s) && !resonance.running) {
          resonance.running = true;
          resonance.t = 0;
          interactables.delete("fragment");
          playerReactions.emit("surprise");
          force((n) => n + 1);
        }
      },
    });
    return () => void interactables.delete("fragment");
  }, [hydrated, touched, ready, showCard]);

  // sigils: readable once the stair is whole and the player stands on the gallery
  const sigilsReady = canReadSigils(world);
  useEffect(() => {
    if (!world.flags.includes(F.resonance) || world.flags.includes(F.kingdoms)) return;
    const ip = around(SIGIL_WALL.bearing, 6.2);
    interactables.set("sigils", {
      id: "sigils",
      label: "קראו את חותמות הבריאה",
      x: ip.x,
      y: GALLERY.y,
      z: ip.z,
      radius: 2.4,
      onContact: () => {
        if (useAetheria.getState().dispatch(onReadSigils())) {
          playerReactions.emit("celebrate");
          showCard({ title: JOURNAL["j.kingdoms"].title, body: JOURNAL["j.kingdoms"].body, tone: "discovery" });
          useAetheriaUi.getState().setPanel("kingdoms");
        }
      },
    });
    return () => void interactables.delete("sigils");
  }, [world.flags, sigilsReady, showCard]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    // the world already resonated (save, or a state change from elsewhere): show the changed world
    if (!resonance.running && resonance.p < 1 && useAetheria.getState().world.flags.includes(F.resonance)) resonance.p = 1;
    if (resonance.running) {
      resonance.t += dt;
      resonance.p = Math.min(1, resonance.t / RESONANCE_S);
      if (resonance.p >= 1) {
        resonance.running = false;
        if (useAetheria.getState().dispatch(onResonanceComplete())) {
          playerReactions.emit("celebrate");
          showCard({ title: JOURNAL["j.resonance"].title, body: JOURNAL["j.resonance"].body, tone: "resonance" });
        }
      }
    }
    acc.current += dt;
    if (acc.current < 0.2 || !useAetheria.getState().hydrated) return;
    acc.current = 0;
    const s = useAetheria.getState().world;
    if (!s.flags.includes(F.observatory) && insideObservatory(telemetry.x, telemetry.z)) useAetheria.getState().dispatch(onObservatory());
    if (s.flags.includes(F.resonance) && !s.flags.includes(F.terrace) && onGallery(telemetry.x, telemetry.y, telemetry.z)) useAetheria.getState().dispatch(onTerrace());
  });
  return null;
}

export function SanctuaryScene({ quality }: { quality: Quality }) {
  const world = useAetheria((s) => s.world);
  const done = world.flags.includes(F.resonance);
  const echoVisible = world.echo !== "dormant";
  const anchors = useMemo(() => {
    const a = around(95, 6.4);
    const b = around(30, 6.4);
    const c = around(-45, 6.5);
    return [
      { x: a.x, y: GALLERY.y, z: a.z },
      { x: b.x, y: GALLERY.y, z: b.z },
      { x: c.x, y: GALLERY.y, z: c.z },
    ];
  }, []);
  const trees = useMemo(() => {
    const r = rng(9);
    const out: { x: number; z: number; s: number }[] = [];
    while (out.length < 11) {
      const a = r() * Math.PI * 2;
      const d = 16 + r() * 19;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (Math.abs(x) < 7 && z > -2) continue;
      if (Math.hypot(x - OBS.x, z - OBS.z) < 12) continue;
      out.push({ x, z, s: out.length + 50 });
    }
    return out;
  }, []);
  return (
    <group>
      <Batched>
        <Terrain />
        <Ruins />
        <Observatory done={done} />
        <Astrolabe />
        {CONSOLES.map((c) => (
          <Console key={c.force} {...c} />
        ))}
        <Waystone />
      </Batched>
      <Sky />
      <BrokenStair />
      <Dome />
      <SigilWall />
      <MemoryShards />
      <FutureEcho anchors={anchors} visible={echoVisible} />
      {trees.map((t) => (
        <Tree key={t.s} x={t.x} z={t.z} seed={t.s} height={5.5 + (t.s % 3) * 1.2} shadows={quality !== "low"} />
      ))}
      <Story />
    </group>
  );
}
