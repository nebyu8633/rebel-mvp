"use client";
/**
 * Top-down 3D arena renderer. Reads the latest match frame every animation frame (no React
 * re-render per tick): heroes are interpolated between the last two states, effects come from
 * fixed-size pools. Pointer → ground raycast gives the aim point.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { HERO_BY_ID } from "@/lib/arena/heroes";
import { MAP_BY_ID, type MapDef } from "@/lib/arena/maps";
import type { Session } from "@/lib/arena/session";
import type { MatchState, Player } from "@/lib/arena/types";
import { HeroModel, type HeroRig } from "./HeroModel";

import { TEAM_COLORS, type Aim } from "./colors";
import { initialQuality, pinnedQuality, PostFX, QualityGovernor, RendererTone, SceneLighting, type Quality } from "@/components/visual/Atmosphere";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
function alphaOf(at: number) {
  return Math.min(1, Math.max(0, (performance.now() - at) / 50));
}
function playerPos(prev: MatchState, cur: MatchState, id: string, a: number) {
  const p = cur.players.find((x) => x.id === id);
  const q = prev.players.find((x) => x.id === id) ?? p;
  if (!p || !q) return null;
  const jump = Math.hypot(p.pos.x - q.pos.x, p.pos.z - q.pos.z) > 4; // respawn / teleport: don't slide
  return { p, x: jump ? p.pos.x : lerp(q.pos.x, p.pos.x, a), z: jump ? p.pos.z : lerp(q.pos.z, p.pos.z, a), facing: lerpAngle(q.facing, p.facing, a) };
}
const onField = (p: Player) => !p.eliminated && p.respawn <= 0 && p.heroes[p.active]?.alive;

// ───────── static environment ─────────

function checkerTexture(a: string, b: string, cells: [number, number]) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = a;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = b;
  g.fillRect(0, 0, 32, 32);
  g.fillRect(32, 32, 32, 32);
  g.strokeStyle = "rgba(0,0,0,0.18)";
  g.lineWidth = 2;
  g.strokeRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(cells[0], cells[1]);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function BorderPosts({ map }: { map: MapDef }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const pts = useMemo(() => {
    const out: Array<[number, number]> = [];
    for (let x = -map.w / 2; x <= map.w / 2; x += 3) out.push([x, -map.h / 2 - 0.5], [x, map.h / 2 + 0.5]);
    for (let z = -map.h / 2 + 3; z < map.h / 2; z += 3) out.push([-map.w / 2 - 0.5, z], [map.w / 2 + 0.5, z]);
    return out;
  }, [map]);
  useEffect(() => {
    const m = new THREE.Matrix4();
    pts.forEach(([x, z], i) => ref.current?.setMatrixAt(i, m.makeTranslation(x, 0.45, z)));
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, [pts]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, pts.length]} castShadow>
      <cylinderGeometry args={[0.22, 0.28, 0.9, 6]} />
      <meshStandardMaterial color={map.palette.obstacle} roughness={0.6} />
    </instancedMesh>
  );
}

function Environment({ map }: { map: MapDef }) {
  const pal = map.palette;
  const tex = useMemo(() => checkerTexture(pal.ground, new THREE.Color(pal.ground).offsetHSL(0, 0, 0.035).getStyle(), [map.w / 4, map.h / 4]), [map, pal.ground]);
  return (
    <group>
      {/* surrounding cliff + ground */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.6, 0]}>
        <planeGeometry args={[map.w + 40, map.h + 40]} />
        <meshStandardMaterial color={pal.edge} roughness={1} />
      </mesh>
      <mesh position={[0, -0.3, 0]}>
        <boxGeometry args={[map.w + 1.2, 0.6, map.h + 1.2]} />
        <meshStandardMaterial color={pal.edge} roughness={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[map.w, map.h]} />
        <meshStandardMaterial map={tex} roughness={0.95} />
      </mesh>
      <BorderPosts map={map} />
      {map.obstacles.map((o, i) =>
        o.kind === "circle" ? (
          <group key={i} position={[o.x, 0, o.z]}>
            <mesh castShadow receiveShadow position={[0, o.h / 2, 0]}>
              <cylinderGeometry args={[o.r * 0.92, o.r, o.h, 10]} />
              <meshStandardMaterial color={pal.obstacle} roughness={0.55} metalness={0.15} flatShading />
            </mesh>
            <mesh position={[0, o.h + 0.08, 0]}>
              <cylinderGeometry args={[o.r * 0.6, o.r * 0.92, 0.16, 10]} />
              <meshStandardMaterial color={pal.accent} emissive={pal.accent} emissiveIntensity={0.35} />
            </mesh>
          </group>
        ) : (
          <mesh key={i} castShadow receiveShadow position={[o.x, o.h / 2, o.z]}>
            <boxGeometry args={[o.w, o.h, o.d]} />
            <meshStandardMaterial color={pal.obstacle} roughness={0.6} metalness={0.2} flatShading />
          </mesh>
        ),
      )}
      {map.fields.map((f, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[f.x, 0.02, f.z]}>
          <circleGeometry args={[f.r, 40]} />
          <meshStandardMaterial color={f.kind === "spring" ? "#5fd3c0" : "#b9a8e8"} transparent opacity={f.kind === "spring" ? 0.55 : 0.35} emissive={f.kind === "spring" ? "#2a8a7a" : "#5a4a8a"} emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// ───────── dynamic objects ─────────

function Pickups({ session, map }: { session: Session; map: MapDef }) {
  const refs = useRef<Array<THREE.Mesh | null>>([]);
  useFrame(({ clock }) => {
    const f = session.frame();
    if (!f) return;
    f.cur.pickups.forEach((pk, i) => {
      const m = refs.current[i];
      if (!m) return;
      m.visible = pk.ready <= 0;
      m.position.y = 0.7 + Math.sin(clock.elapsedTime * 3 + i) * 0.12;
      m.rotation.y += 0.03;
    });
  });
  return (
    <>
      {map.pickups.map((pk, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} position={[pk.x, 0.7, pk.z]}>
          <octahedronGeometry args={[0.32, 0]} />
          <meshStandardMaterial color={pk.kind === "heal" ? "#7dffb0" : "#8fd0ff"} emissive={pk.kind === "heal" ? "#2fbf6a" : "#2f7fbf"} emissiveIntensity={1.2} />
        </mesh>
      ))}
    </>
  );
}

function Crystals({ session }: { session: Session }) {
  const f0 = session.frame();
  const crystals = f0?.cur.crystals ?? [];
  const gem = useRef<Array<THREE.Mesh | null>>([]);
  const ring = useRef<Array<THREE.Mesh | null>>([]);
  useFrame(({ clock }) => {
    const f = session.frame();
    if (!f) return;
    f.cur.crystals.forEach((c, i) => {
      const g = gem.current[i];
      const r = ring.current[i];
      const col = c.owner == null ? "#e8e8f0" : TEAM_COLORS[c.owner];
      if (g) {
        g.rotation.y = clock.elapsedTime;
        g.position.y = 1.6 + Math.sin(clock.elapsedTime * 2 + i) * 0.15;
        (g.material as THREE.MeshStandardMaterial).color.set(col);
        (g.material as THREE.MeshStandardMaterial).emissive.set(col);
      }
      if (r) {
        const m = r.material as THREE.MeshBasicMaterial;
        m.color.set(c.progress < 0 ? TEAM_COLORS[0] : c.progress > 0 ? TEAM_COLORS[1] : "#ffffff");
        r.scale.setScalar(0.3 + 0.7 * Math.abs(c.progress));
      }
    });
  });
  return (
    <>
      {crystals.map((c, i) => (
        <group key={c.id} position={[c.pos.x, 0, c.pos.z]}>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
            <ringGeometry args={[c.radius - 0.15, c.radius, 48]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
          </mesh>
          <mesh ref={(m) => void (ring.current[i] = m)} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
            <circleGeometry args={[c.radius, 48]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.22} />
          </mesh>
          <mesh ref={(m) => void (gem.current[i] = m)} position={[0, 1.6, 0]} castShadow>
            <octahedronGeometry args={[0.6, 0]} />
            <meshStandardMaterial color="#e8e8f0" emissive="#e8e8f0" emissiveIntensity={0.8} metalness={0.3} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.7, 0.9, 0.5, 6]} />
            <meshStandardMaterial color="#5a5a6a" />
          </mesh>
        </group>
      ))}
    </>
  );
}

const POOL = { proj: 64, zone: 24, wall: 12, fx: 48 };
const TRAIL = 3;

function Effects({ session }: { session: Session }) {
  const proj = useRef<Array<THREE.Mesh | null>>([]);
  const trail = useRef<Array<THREE.Mesh | null>>([]);
  const zoneDisc = useRef<Array<THREE.Mesh | null>>([]);
  const zoneRing = useRef<Array<THREE.Mesh | null>>([]);
  const walls = useRef<Array<THREE.Mesh | null>>([]);
  const fx = useRef<Array<THREE.Mesh | null>>([]);
  useFrame(({ clock }) => {
    const f = session.frame();
    if (!f) return;
    const a = alphaOf(f.at);
    const st = f.cur;
    for (let i = 0; i < POOL.proj; i++) {
      const m = proj.current[i];
      if (!m) continue;
      const pr = st.projectiles[i];
      m.visible = !!pr;
      if (!pr) continue;
      const before = f.prev.projectiles.find((x) => x.id === pr.id);
      m.position.set(before ? lerp(before.pos.x, pr.pos.x, a) : pr.pos.x, 1.1, before ? lerp(before.pos.z, pr.pos.z, a) : pr.pos.z);
      m.scale.setScalar(pr.radius / 0.35);
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.color.set(pr.color);
      mat.emissive.set(pr.color);
      // glowing trail behind the projectile
      for (let k = 0; k < TRAIL; k++) {
        const t = trail.current[i * TRAIL + k];
        if (!t) continue;
        const back = (k + 1) * 0.45 * (pr.radius / 0.35 + 0.4);
        t.position.set(m.position.x - pr.dir.x * back, 1.1, m.position.z - pr.dir.z * back);
        t.scale.setScalar((pr.radius / 0.35) * (0.75 - k * 0.2));
        (t.material as THREE.MeshBasicMaterial).color.set(pr.color);
      }
    }
    for (let i = 0; i < POOL.proj; i++) for (let k = 0; k < TRAIL; k++) {
      const t = trail.current[i * TRAIL + k];
      if (t) t.visible = !!st.projectiles[i];
    }
    for (let i = 0; i < POOL.zone; i++) {
      const d = zoneDisc.current[i];
      const r = zoneRing.current[i];
      const z = st.zones[i];
      if (d) d.visible = !!z;
      if (r) r.visible = !!z;
      if (!z || !d || !r) continue;
      d.position.set(z.pos.x, 0.04, z.pos.z);
      r.position.set(z.pos.x, 0.05, z.pos.z);
      d.scale.setScalar(z.radius);
      // telegraph: one-shot areas shrink their ring toward impact
      r.scale.setScalar(z.oneShot ? z.radius * (0.4 + 0.6 * (1 - Math.max(0, z.left) / 1)) : z.radius * (1 + Math.sin(clock.elapsedTime * 6) * 0.03));
      const dm = d.material as THREE.MeshBasicMaterial;
      const rm = r.material as THREE.MeshBasicMaterial;
      const enemyZone = z.target === "enemies";
      dm.color.set(enemyZone ? (z.oneShot ? "#ff5a4a" : z.color) : "#7dffb0");
      dm.opacity = z.oneShot ? 0.18 : 0.22;
      rm.color.set(enemyZone ? "#ff8a6a" : "#9fffc8");
    }
    for (let i = 0; i < POOL.wall; i++) {
      const m = walls.current[i];
      const w = st.walls[i];
      if (!m) continue;
      m.visible = !!w;
      if (!w) continue;
      const len = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z);
      m.position.set((w.a.x + w.b.x) / 2, 0.9, (w.a.z + w.b.z) / 2);
      m.rotation.y = Math.atan2(w.b.x - w.a.x, w.b.z - w.a.z);
      m.scale.set(0.6, Math.min(1, w.left * 3) * 1.8, len);
    }
    const evs = st.events.filter((e) => st.time - e.t < 0.6);
    for (let i = 0; i < POOL.fx; i++) {
      const m = fx.current[i];
      const e = evs[evs.length - 1 - i];
      if (!m) continue;
      m.visible = !!e;
      if (!e) continue;
      const k = (st.time - e.t) / 0.6;
      const base = e.kind === "ko" ? 2.2 : e.kind === "hit" ? 0.7 : e.kind === "switch" ? 1.6 : e.kind === "capture" ? (e.radius ?? 2.6) : (e.radius ?? 1.2);
      m.position.set(e.pos.x, e.kind === "heal" ? 0.3 + k * 1.5 : 0.08, e.pos.z);
      m.scale.setScalar(base * (0.35 + k * 0.8));
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.set(e.kind === "heal" ? "#7dffb0" : e.kind === "shield" ? "#9fd8ff" : e.kind === "ko" ? "#ff6a5a" : e.color);
      mat.opacity = (1 - k) * (e.kind === "hit" ? 0.9 : 0.7);
    }
  });
  return (
    <>
      {Array.from({ length: POOL.proj }).map((_, i) => (
        <mesh key={`p${i}`} ref={(m) => void (proj.current[i] = m)} visible={false}>
          <sphereGeometry args={[0.35, 12, 10]} />
          <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      ))}
      {Array.from({ length: POOL.proj * TRAIL }).map((_, i) => (
        <mesh key={`t${i}`} ref={(m) => void (trail.current[i] = m)} visible={false}>
          <sphereGeometry args={[0.3, 8, 6]} />
          <meshBasicMaterial transparent opacity={0.45 - (i % TRAIL) * 0.12} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {Array.from({ length: POOL.zone }).map((_, i) => (
        <group key={`z${i}`}>
          <mesh ref={(m) => void (zoneDisc.current[i] = m)} rotation-x={-Math.PI / 2} visible={false}>
            <circleGeometry args={[1, 40]} />
            <meshBasicMaterial transparent opacity={0.2} depthWrite={false} />
          </mesh>
          <mesh ref={(m) => void (zoneRing.current[i] = m)} rotation-x={-Math.PI / 2} visible={false}>
            <ringGeometry args={[0.92, 1, 48]} />
            <meshBasicMaterial transparent opacity={0.85} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: POOL.wall }).map((_, i) => (
        <mesh key={`w${i}`} ref={(m) => void (walls.current[i] = m)} visible={false} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#9fd8e8" emissive="#2a6a7a" emissiveIntensity={0.6} transparent opacity={0.85} />
        </mesh>
      ))}
      {Array.from({ length: POOL.fx }).map((_, i) => (
        <mesh key={`f${i}`} ref={(m) => void (fx.current[i] = m)} rotation-x={-Math.PI / 2} visible={false}>
          <ringGeometry args={[0.7, 1, 40]} />
          <meshBasicMaterial transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </>
  );
}

function Actor({ session, id, colorIndex }: { session: Session; id: string; colorIndex: number }) {
  const group = useRef<THREE.Group>(null);
  const rig = useRef<HeroRig>(null);
  const shield = useRef<THREE.Mesh>(null);
  const swap = useRef<THREE.Mesh>(null);
  const [heroId, setHeroId] = useState<string | null>(null);
  const fall = useRef(0);
  useFrame(({ clock }, dt) => {
    const f = session.frame();
    const g = group.current;
    if (!f || !g) return;
    const pp = playerPos(f.prev, f.cur, id, alphaOf(f.at));
    if (!pp) {
      g.visible = false;
      return;
    }
    const { p } = pp;
    const h = p.heroes[p.active];
    if (h && h.heroId !== heroId) setHeroId(h.heroId);
    const show = onField(p);
    fall.current = show ? 0 : Math.min(1, fall.current + dt * 2.5);
    g.visible = show || fall.current < 1;
    g.position.set(pp.x, 0, pp.z);
    g.rotation.y = pp.facing;
    const r = rig.current;
    if (r?.root) {
      const speed = Math.hypot(p.vel.x, p.vel.z);
      const t = clock.elapsedTime * (6 + speed * 1.2);
      const swing = Math.min(1, speed / 4) * 0.7;
      if (r.legL) r.legL.rotation.x = Math.sin(t) * swing;
      if (r.legR) r.legR.rotation.x = -Math.sin(t) * swing;
      if (r.armL) r.armL.rotation.x = -Math.sin(t) * swing * 0.6;
      const casting = p.castLock > 0 || (f.cur.events.some((e) => e.playerId === id && e.kind === "cast" && f.cur.time - e.t < 0.2));
      if (r.armR) r.armR.rotation.x = casting ? -1.4 : Math.sin(t) * swing * 0.6;
      if (r.body) {
        r.body.position.y = Math.abs(Math.sin(t)) * swing * 0.08 + Math.sin(clock.elapsedTime * 2) * 0.02;
        r.body.rotation.x = casting ? 0.15 : speed * 0.02;
      }
      // switching: grow in; knocked out: sink and fade
      const s = p.switchFx > 0 ? 1 - p.switchFx / 0.6 : 1;
      r.root.scale.setScalar((HERO_BY_ID[h?.heroId ?? ""]?.role === "tank" ? 1.25 : 0.92) * (0.4 + 0.6 * Math.min(1, s)) * (1 - fall.current * 0.6));
      r.root.position.y = -fall.current * 0.8;
      for (const m of r.mats) {
        if (m.userData.base === undefined) {
          m.userData.base = m.emissive.getHex();
          m.userData.baseI = m.emissiveIntensity;
        }
        if (p.hitFlash > 0) {
          m.emissive.set("#ffffff");
          m.emissiveIntensity = 0.8;
        } else {
          m.emissive.setHex(m.userData.base);
          m.emissiveIntensity = m.userData.baseI;
        }
      }
    }
    if (shield.current) {
      shield.current.visible = show && (h?.shield ?? 0) > 0;
      shield.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 5) * 0.03);
    }
    if (swap.current) {
      swap.current.visible = p.switchFx > 0;
      const k = 1 - p.switchFx / 0.6;
      swap.current.scale.setScalar(0.5 + k * 2);
      (swap.current.material as THREE.MeshBasicMaterial).opacity = 1 - k;
    }
  });
  const def = heroId ? HERO_BY_ID[heroId] : null;
  return (
    <group ref={group}>
      {def && <HeroModel key={def.id} ref={rig} def={def} teamColor={TEAM_COLORS[colorIndex % TEAM_COLORS.length]} />}
      <mesh ref={shield} position={[0, 1.1, 0]} visible={false}>
        <sphereGeometry args={[1.25, 20, 14]} />
        <meshStandardMaterial color="#8fd0ff" transparent opacity={0.22} emissive="#4aa3ff" emissiveIntensity={0.6} depthWrite={false} />
      </mesh>
      <mesh ref={swap} rotation-x={-Math.PI / 2} position={[0, 0.06, 0]} visible={false}>
        <ringGeometry args={[0.8, 1, 40]} />
        <meshBasicMaterial color={def?.look.glow ?? "#fff"} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CameraRig({ session, map }: { session: Session; map: MapDef }) {
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3());
  const portrait = size.width < size.height;
  useFrame((_, dt) => {
    const f = session.frame();
    if (!f) return;
    const pp = playerPos(f.prev, f.cur, session.you, alphaOf(f.at));
    const x = pp?.x ?? 0;
    const z = pp?.z ?? 0;
    // keep the arena readable: follow the hero but stay inside the bounds
    const mx = Math.max(0, map.w / 2 - (portrait ? 5 : 9));
    const mz = Math.max(0, map.h / 2 - (portrait ? 7 : 5));
    const tx = Math.max(-mx, Math.min(mx, x));
    const tz = Math.max(-mz, Math.min(mz, z));
    target.current.lerp(new THREE.Vector3(tx, 0, tz), 1 - Math.exp(-dt * 6));
    const h = portrait ? 24 : 20;
    const d = portrait ? 13 : 12;
    camera.position.set(target.current.x, h, target.current.z + d);
    camera.lookAt(target.current.x, 0, target.current.z - 0.5);
  });
  return null;
}

function AimPlane({ aim }: { aim: React.MutableRefObject<Aim> }) {
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[0, 0, 0]}
      onPointerMove={(e) => {
        aim.current = { x: e.point.x, z: e.point.z, fromPointer: true };
      }}
      onPointerDown={(e) => {
        aim.current = { x: e.point.x, z: e.point.z, fromPointer: true };
      }}
    >
      <planeGeometry args={[400, 400]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

/** Screen-space HP bars over heroes (DOM, positioned each frame). */
function BarProjector({ session, bars }: { session: Session; bars: React.MutableRefObject<Record<string, HTMLDivElement | null>> }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const f = session.frame();
    if (!f) return;
    const a = alphaOf(f.at);
    for (const p of f.cur.players) {
      const el = bars.current[p.id];
      if (!el) continue;
      const pp = playerPos(f.prev, f.cur, p.id, a);
      const h = p.heroes[p.active];
      if (!pp || !onField(p) || !h) {
        el.style.display = "none";
        continue;
      }
      v.set(pp.x, 2.7, pp.z).project(camera);
      el.style.display = "block";
      el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`;
      const hp = el.querySelector<HTMLDivElement>("[data-hp]");
      const sh = el.querySelector<HTMLDivElement>("[data-sh]");
      if (hp) hp.style.width = `${(Math.max(0, h.hp) / h.maxHp) * 100}%`;
      if (sh) sh.style.width = `${Math.min(100, (h.shield / h.maxHp) * 100)}%`;
    }
  });
  return null;
}

export default function Arena3D({ session, aim, lowPower: lowPowerHint }: { session: Session; aim: React.MutableRefObject<Aim>; lowPower: boolean }) {
  const [quality, setQuality] = useState<Quality>(() => (lowPowerHint && !pinnedQuality() ? "low" : initialQuality()));
  useEffect(() => {
    if (lowPowerHint && !pinnedQuality()) setQuality("low");
  }, [lowPowerHint]);
  const lowPower = quality === "low";
  const [ready, setReady] = useState<MatchState | null>(() => session.frame()?.cur ?? null);
  const bars = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (ready) return;
    const t = setInterval(() => {
      const f = session.frame();
      if (f) {
        setReady(f.cur);
        clearInterval(t);
      }
    }, 50);
    return () => clearInterval(t);
  }, [ready, session]);
  if (!ready) return <div className="flex h-full items-center justify-center text-sm text-slate-300">טוען זירה…</div>;
  const map = MAP_BY_ID[ready.mapId];
  return (
    <div className="relative h-full w-full" data-quality={quality}>
      <Canvas shadows={lowPower ? false : { type: THREE.PCFShadowMap }} dpr={lowPower ? 1 : [1, 2]} camera={{ fov: 45, position: [0, 20, 12], near: 0.5, far: 200 }} gl={{ antialias: !lowPower }} data-testid="arena-canvas">
        <color attach="background" args={[map.palette.sky]} />
        <fog attach="fog" args={[map.palette.fog, 40, 90]} />
        <hemisphereLight args={["#ffffff", map.palette.edge, lowPower ? 0.85 : 0.7]} />
        {!lowPower && <SceneLighting warm={map.palette.accent} cool="#a8c8ff" intensity={0.9} />}
        <directionalLight position={[12, 26, 10]} intensity={1.7} castShadow={!lowPower} shadow-mapSize={quality === "high" ? [2048, 2048] : [1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} />
        <Environment map={map} />
        <Pickups session={session} map={map} />
        <Crystals session={session} />
        <Effects session={session} />
        {ready.players.map((p, i) => (
          <Actor key={p.id} session={session} id={p.id} colorIndex={ready.mode === "ffa" ? i : p.team} />
        ))}
        <AimPlane aim={aim} />
        <RendererTone quality={quality} />
        <PostFX quality={quality} bloom={1.1} />
        <QualityGovernor quality={quality} onChange={setQuality} />
        <CameraRig session={session} map={map} />
        <BarProjector session={session} bars={bars} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {ready.players.map((p, i) => (
          <div key={p.id} ref={(el) => void (bars.current[p.id] = el)} className="absolute left-0 top-0 w-16" style={{ display: "none" }}>
            <div className="mb-0.5 truncate text-center text-[10px] font-semibold text-white drop-shadow" dir="rtl">
              {p.id === session.you ? "אתה" : p.name}
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-black/60">
              <div data-hp className="h-full" style={{ background: p.id === session.you ? "#5ee08a" : TEAM_COLORS[(ready.mode === "ffa" ? i : p.team) % TEAM_COLORS.length] }} />
              <div data-sh className="absolute inset-y-0 left-0 bg-sky-200/80" style={{ width: 0 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
