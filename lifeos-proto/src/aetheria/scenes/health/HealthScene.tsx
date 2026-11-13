/**
 * AETHERIA — the Kingdom of Health: the Living Grove (the Withered Grove chapter).
 * Visual identity: a forest basin ringed by mossy cliffs and waterfalls, giant trees with flared
 * roots and dense crowns (instanced leaf cards), bioluminescent mushrooms in the shade, morning
 * light through green haze. At the centre, the Heart Tree — withered until the forces wake it.
 * Gameplay (engine-validated resonance sites): CHANGE revives each of three springs, CONNECTION
 * channels its water to the Heart Tree's roots, FORM makes the tree bloom (only when all three flow).
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { usePBR } from "../../../world/materials";
import { rng } from "../../../world/geometry";
import { Tree } from "../../../world/Trees";
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
import { H, HEALTH_SITES, HEART_SITE, SPRINGS, onEnterGrove, springSite, type SpringId } from "../../content/healthKingdom";
import { resonateSite } from "../sanctuary/SleepingGate";
import { FutureEcho } from "../sanctuary/FutureEcho";
import { ResonanceFx } from "../../fx/ResonanceFx";
import { PostFx } from "../../../world/PostFx";
import { Arrival } from "../../../world/Arrival";
import { SoundController, DustMotes } from "../sanctuary/Life";
import { LIVING_GATE_ARRIVAL } from "../knowledge/layout";
import { BOUND_R, DREAMS_GATE, GIANTS, HEART, SPAWN, SPRING_SPOTS, WAYSTONE } from "./layout";
import { useSanctuaryKit } from "../sanctuary/architecture";

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------ the basin
function Basin() {
  const meadowBase = usePBR("meadow", { tint: 0x8fa678 });
  // a high sun + a low camera made the ground mirror the bright sky (grazing reflections of the
  // environment map): the forest floor is matte
  const meadow = useMemo(() => {
    const m = meadowBase.clone();
    m.envMapIntensity = 0.12;
    m.roughnessMap = null;
    m.roughness = 1;
    m.metalness = 0;
    return m;
  }, [meadowBase]);
  const moss = usePBR("mosspath", { tint: 0xa8b89a });
  const rock = usePBR("rock", { tint: 0x7d8a72 });
  const ground = useMemo(() => {
    // a real grid (a CircleGeometry is only a fan from the centre to the rim: raising the rim
    // turned the whole floor into a shallow cone)
    const g = new THREE.PlaneGeometry((BOUND_R + 8) * 2, (BOUND_R + 8) * 2, 84, 84);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const d = Math.hypot(x, z);
      // gentle undulation only outside the walkable area (the physics floor is flat)
      p.setY(i, smooth(BOUND_R - 1, BOUND_R + 6, d) * 2.5 + Math.sin(x * 0.3) * Math.cos(z * 0.27) * 0.04);
      uv.setXY(i, x / 4, z / 4);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  // the cliff ring: a tall, irregular rock wall around the basin
  const cliff = useMemo(() => {
    const g = new THREE.CylinderGeometry(48, BOUND_R + 4, 34, 96, 10, true);
    const p = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const a = Math.atan2(z, x);
      const n = Math.sin(a * 7 + y * 0.2) * 1.4 + Math.sin(a * 17 - y * 0.35) * 0.7 + Math.sin(a * 3 + 1.3) * 2;
      const s = 1 + n / 45;
      p.setXYZ(i, x * s, y + 17 - 0.5, z * s);
      uv.setXY(i, (a / Math.PI) * 24, (y + 17) / 4);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  // seen from inside the basin: render both faces
  const cliffMat = useMemo(() => {
    const m = rock.clone();
    m.side = THREE.DoubleSide;
    m.envMapIntensity = 0.2;
    return m;
  }, [rock]);
  const path = useMemo(() => {
    const g = new THREE.PlaneGeometry(2.8, 26, 1, 1);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.4, uv.getY(i) * 13);
    return g;
  }, []);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.5, BOUND_R + 2]} position={[0, -0.5, 0]} />
        {Array.from({ length: 28 }, (_, i) => {
          const a = (i / 28) * Math.PI * 2;
          return <CuboidCollider key={i} args={[4.2, 4, 0.5]} position={[Math.cos(a) * BOUND_R, 4, Math.sin(a) * BOUND_R]} rotation={[0, -a + Math.PI / 2, 0]} />;
        })}
      </RigidBody>
      <mesh geometry={ground} material={meadow} receiveShadow />
      <mesh geometry={path} material={moss} position={[0, 0.02, HEART.z + HEART.r + 13]} receiveShadow />
      <mesh geometry={cliff} material={cliffMat} receiveShadow />
      <Waterfalls />
    </group>
  );
}

const waterVert = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }";
const waterfallFrag = `uniform float uTime; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    float x = vUv.x; float y = vUv.y + uTime * 0.55;
    float streak = h(vec2(floor(x * 40.0), 0.0));
    float flow = 0.55 + 0.45 * sin(y * 30.0 + streak * 20.0);
    float edge = smoothstep(0.0, 0.2, x) * smoothstep(1.0, 0.8, x);
    float a = edge * (0.35 + 0.45 * flow) * smoothstep(0.0, 0.1, vUv.y);
    gl_FragColor = vec4(vec3(0.82, 0.95, 1.0) * a, a);
  }`;
function Waterfalls() {
  const mat = useMemo(() => new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: waterVert, fragmentShader: waterfallFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide }), []);
  useFrame(({ clock }) => void (mat.uniforms.uTime.value = clock.elapsedTime));
  const falls = useMemo(() => [-130, 20, 95].map((b) => ({ a: (b * Math.PI) / 180 })), []);
  return (
    <group userData={{ noBatch: true }}>
      {falls.map((f, i) => {
        const r = BOUND_R + 7;
        return (
          <mesh key={i} material={mat} position={[Math.sin(f.a) * r, 13, -Math.cos(f.a) * r]} rotation-y={-f.a}>
            <planeGeometry args={[4, 28]} />
          </mesh>
        );
      })}
    </group>
  );
}

// ------------------------------------------------------------------ giant trees
function trunkGeometry(seed: number, r: number, h: number) {
  const rr = rng(seed);
  const prof: THREE.Vector2[] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = t * h;
    // flared roots at the base, tapering crown
    const rad = r * (1 + 1.3 * Math.pow(1 - smooth(0, 0.12, t), 2)) * (1 - 0.35 * t);
    prof.push(new THREE.Vector2(rad, y));
  }
  const g = new THREE.LatheGeometry(prof, 18);
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const off = rr() * 10;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    // bark ridges + root buttresses
    const ridge = 1 + Math.sin(a * 9 + y * 0.15 + off) * 0.05 + Math.max(0, Math.sin(a * 5 + off)) * 0.45 * (1 - smooth(0, h * 0.15, y));
    p.setXYZ(i, x * ridge, y, z * ridge);
    uv.setXY(i, (a / Math.PI) * r * 2, y / 1.5);
  }
  g.computeVertexNormals();
  return g;
}

/** Leaf cards scattered in crown clusters (one instanced mesh for many trees). */
function crownCards(trees: { x: number; z: number; h: number; r: number; seed: number }[], perTree: number) {
  const mats: THREE.Matrix4[] = [];
  const o = new THREE.Object3D();
  for (const t of trees) {
    const r = rng(t.seed);
    // a broad, layered canopy: clusters from mid-trunk up, spread wide (the grove is in shade)
    const clusters = Array.from({ length: 10 }, (_, k) => {
      const a = r() * Math.PI * 2;
      const d = t.r * (1.2 + r() * 4.5);
      return new THREE.Vector3(t.x + Math.cos(a) * d, t.h * (0.45 + (k / 10) * 0.45 + r() * 0.08), t.z + Math.sin(a) * d);
    });
    for (let i = 0; i < perTree; i++) {
      const c = clusters[i % clusters.length];
      const rad = 3.5 + r() * 3.5;
      const u = r() * Math.PI * 2;
      const v = Math.acos(2 * r() - 1);
      o.position.set(c.x + Math.sin(v) * Math.cos(u) * rad, c.y + Math.cos(v) * rad * 0.6, c.z + Math.sin(v) * Math.sin(u) * rad);
      o.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
      o.scale.setScalar(2 + r() * 2.2);
      o.updateMatrix();
      mats.push(o.matrix.clone());
    }
  }
  return mats;
}

function Giants({ quality }: { quality: Quality }) {
  const bark = usePBR("bark", { tint: 0x8a7a68 });
  const leaf = usePBR("leaf", { tint: 0x8fb070, normalScale: 0.6 });
  const trunks = useMemo(() => GIANTS.map((g, i) => ({ ...g, geo: trunkGeometry(200 + i, g.r, g.h) })), []);
  const per = quality === "low" ? 320 : quality === "medium" ? 520 : 720;
  const cards = useMemo(() => crownCards(GIANTS.map((g, i) => ({ x: g.x, z: g.z, h: g.h, r: g.r, seed: 300 + i })), per), [per]);
  const ref = useRef<THREE.InstancedMesh>(null);
  const plane = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    cards.forEach((mx, i) => m.setMatrixAt(i, mx));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [cards]);
  return (
    <group userData={{ noBatch: true }}>
      <RigidBody type="fixed" colliders={false}>
        {trunks.map((t, i) => (
          <CylinderCollider key={i} args={[4, t.r * 1.2]} position={[t.x, 4, t.z]} />
        ))}
      </RigidBody>
      {trunks.map((t, i) => (
        <mesh key={i} geometry={t.geo} material={bark} position={[t.x, 0, t.z]} castShadow receiveShadow />
      ))}
      <instancedMesh ref={ref} args={[plane, leaf, cards.length]} castShadow={quality === "high"} />
    </group>
  );
}

// ------------------------------------------------------------------ the Heart Tree
function HeartTree() {
  const bark = usePBR("bark", { tint: 0x8a7a68 });
  const deadBark = usePBR("bark", { tint: 0x6b6560 });
  const leaf = usePBR("leaf", { tint: 0x9fc27a, normalScale: 0.6 });
  const bloomed = useAetheria((s) => siteState(s.world, HEALTH_SITES[HEART_SITE]) === "blooming");
  const power = useAetheriaUi((s) => s.power);
  const trunk = useMemo(() => trunkGeometry(99, HEART.r, HEART.h), []);
  const cards = useMemo(() => crownCards([{ x: 0, z: 0, h: HEART.h, r: HEART.r, seed: 77 }], 1100), []);
  const blossomMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd6ec").multiplyScalar(1.6), toneMapped: false }), []);
  const blossoms = useMemo(() => crownCards([{ x: 0, z: 0, h: HEART.h, r: HEART.r, seed: 78 }], 360), []);
  const cardGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const blossomGeo = useMemo(() => new THREE.PlaneGeometry(0.35, 0.35), []);
  const crown = useRef<THREE.InstancedMesh>(null);
  const bl = useRef<THREE.InstancedMesh>(null);
  const grow = useRef<THREE.Group>(null);
  const t = useRef(-1);
  useEffect(() => {
    for (const [ref, list] of [[crown, cards], [bl, blossoms]] as const) {
      const m = ref.current;
      if (!m) continue;
      list.forEach((mx, i) => m.setMatrixAt(i, mx));
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [cards, blossoms]);
  useFrame((_, dt) => {
    // a restored world shows the tree in bloom at once; blooming now grows it over ~4 s
    if (t.current < 0) t.current = bloomed ? 1 : 0;
    t.current += ((bloomed ? 1 : 0) - t.current) * (1 - Math.exp(-0.7 * Math.min(dt, 0.1)));
    if (grow.current) {
      grow.current.scale.setScalar(Math.max(0.001, smooth(0, 1, t.current)));
      grow.current.visible = t.current > 0.01;
    }
  });
  useEffect(() => {
    if (bloomed) return;
    interactables.set("heart", {
      id: "heart",
      label: power ? `הפעילו ${FORCE_TITLES[power]}: עץ הלב` : "עץ הלב: בחרו כוח",
      x: HEART.x,
      y: 0,
      z: HEART.z + HEART.r + 2.2,
      radius: 2.4,
      onContact: () => {
        resonateSite(HEART_SITE, { x: HEART.x, y: 2.5, z: HEART.z + HEART.r });
        if (useAetheria.getState().lastRejection === "resonance:not_ready") useAetheriaUi.getState().say("השורשים עדיין צמאים. הזרימו מים מכל שלושת המעיינות.");
      },
    });
    return () => void interactables.delete("heart");
  }, [bloomed, power]);
  return (
    <group position={[HEART.x, 0, HEART.z]} userData={{ noBatch: true }}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[5, HEART.r * 1.25]} position={[0, 5, 0]} />
      </RigidBody>
      <mesh geometry={trunk} material={bloomed ? bark : deadBark} castShadow receiveShadow />
      {/* the crown grows from the top of the trunk */}
      <group position={[0, HEART.h * 0.75, 0]}>
        <group ref={grow}>
          <group position={[0, -HEART.h * 0.75, 0]}>
            <instancedMesh ref={crown} args={[cardGeo, leaf, cards.length]} castShadow />
            <instancedMesh ref={bl} args={[blossomGeo, blossomMat, blossoms.length]} />
          </group>
        </group>
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ springs, water, flowers
const poolFrag = `uniform float uTime; uniform float uOn; varying vec2 vUv;
  void main(){
    vec2 p = vUv - 0.5; float r = length(p) * 2.0;
    float ripples = 0.5 + 0.5 * sin(r * 22.0 - uTime * 2.4);
    vec3 dry = vec3(0.18, 0.14, 0.1) * (0.8 + 0.2 * sin(p.x * 60.0) * sin(p.y * 50.0));
    vec3 water = mix(vec3(0.1, 0.35, 0.4), vec3(0.5, 0.95, 0.95), ripples * 0.5) * (1.0 - r * 0.4);
    gl_FragColor = vec4(mix(dry, water * 1.3, uOn), smoothstep(1.0, 0.92, r));
  }`;
const streamFrag = `uniform float uTime; uniform float uOn; varying vec2 vUv;
  void main(){
    float edge = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
    float flow = 0.6 + 0.4 * sin(vUv.x * 40.0 - uTime * 4.0 + sin(vUv.y * 9.0) * 1.5);
    float reach = smoothstep(uOn + 0.02, uOn - 0.02, vUv.x);
    float a = edge * reach * (0.55 + 0.35 * flow);
    gl_FragColor = vec4(vec3(0.45, 0.92, 0.95) * a * 1.4, a);
  }`;

function Spring({ id }: { id: SpringId }) {
  const stone = usePBR("ruinwall", { tint: 0x9aa08c });
  const spot = SPRING_SPOTS[id];
  const state = useAetheria((s) => siteState(s.world, HEALTH_SITES[springSite(id)]));
  const power = useAetheriaUi((s) => s.power);
  const pool = useMemo(() => new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uOn: { value: 0 } }, vertexShader: waterVert, fragmentShader: poolFrag, transparent: true }), []);
  const stream = useMemo(() => new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uOn: { value: 0 } }, vertexShader: waterVert, fragmentShader: streamFrag, transparent: true, depthWrite: false, toneMapped: false }), []);
  // the channel: a ribbon on the ground from the pool's edge to the Heart Tree's roots
  const channel = useMemo(() => {
    const from = new THREE.Vector2(spot.x, spot.z);
    const to = new THREE.Vector2(HEART.x, HEART.z);
    const dir = to.clone().sub(from).normalize();
    const a = from.clone().addScaledVector(dir, spot.r);
    const b = to.clone().addScaledVector(dir, -HEART.r * 1.6);
    const len = a.distanceTo(b);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    return { mid, len, yaw: Math.atan2(dir.x, dir.y) };
  }, [spot]);
  const on = useRef({ pool: -1, stream: -1 });
  useFrame(({ clock }, dt) => {
    const k = 1 - Math.exp(-0.8 * Math.min(dt, 0.1));
    const wantPool = state === "dry" ? 0 : 1;
    const wantStream = state === "channelled" ? 1 : 0;
    if (on.current.pool < 0) Object.assign(on.current, { pool: wantPool, stream: wantStream });
    on.current.pool += (wantPool - on.current.pool) * k;
    on.current.stream += (wantStream - on.current.stream) * k * 0.6;
    pool.uniforms.uTime.value = stream.uniforms.uTime.value = clock.elapsedTime;
    pool.uniforms.uOn.value = on.current.pool;
    stream.uniforms.uOn.value = on.current.stream;
  });
  useEffect(() => {
    if (state === "channelled") return;
    const key = `spring-${id}`;
    interactables.set(key, {
      id: key,
      label: power ? `הפעילו ${FORCE_TITLES[power]}: ${HEALTH_SITES[springSite(id)].title}` : "מעיין: בחרו כוח",
      x: spot.x,
      y: 0,
      z: spot.z,
      radius: spot.r + 1.2,
      onContact: () => resonateSite(springSite(id), { x: spot.x, y: 0.6, z: spot.z }),
    });
    return () => void interactables.delete(key);
  }, [state, power, id, spot]);
  return (
    <group userData={{ noBatch: true }}>
      <mesh material={stone} position={[spot.x, 0.18, spot.z]} rotation-x={Math.PI / 2} castShadow receiveShadow>
        <torusGeometry args={[spot.r, 0.32, 8, 32]} />
      </mesh>
      <mesh material={pool} position={[spot.x, 0.06, spot.z]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[spot.r - 0.1, 40]} />
      </mesh>
      <mesh material={stream} position={[channel.mid.x, 0.05, channel.mid.y]} rotation={[-Math.PI / 2, 0, -channel.yaw + Math.PI / 2]}>
        <planeGeometry args={[channel.len, 0.9]} />
      </mesh>
    </group>
  );
}

/** Bioluminescent mushrooms in the shade; glowing flowers that spread when the tree blooms. */
function Flora() {
  const bloomed = useAetheria((s) => s.world.flags.includes(H.bloomed));
  const shroom = useMemo(() => {
    const g = new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const stem = new THREE.CylinderGeometry(0.04, 0.06, 0.25, 6);
    stem.translate(0, -0.12, 0);
    return { cap: g, stem };
  }, []);
  const capMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x0f1a1a, emissive: new THREE.Color("#5ff2dc"), emissiveIntensity: 1.6, roughness: 0.6 }), []);
  const stemMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xd8d4c4, roughness: 0.8 }), []);
  const flowerGeo = useMemo(() => new THREE.CircleGeometry(0.16, 5), []);
  const flowerMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffb8e0").multiplyScalar(1.5), toneMapped: false }), []);
  const spots = useMemo(() => {
    const r = rng(55);
    const out: THREE.Matrix4[] = [];
    const flowers: THREE.Matrix4[] = [];
    const o = new THREE.Object3D();
    while (out.length < 110) {
      const a = r() * Math.PI * 2;
      const d = 4 + r() * (BOUND_R - 6);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (Math.abs(x) < 2.2 && z > HEART.z) continue; // the path
      o.position.set(x, 0.24, z);
      o.rotation.set(0, r() * 6, 0);
      o.scale.setScalar(0.6 + r() * 1.2);
      o.updateMatrix();
      out.push(o.matrix.clone());
    }
    while (flowers.length < 220) {
      const a = r() * Math.PI * 2;
      const d = HEART.r * 1.8 + r() * 13;
      o.position.set(HEART.x + Math.cos(a) * d, 0.12, HEART.z + Math.sin(a) * d);
      o.rotation.set(-Math.PI / 2, 0, r() * 6);
      o.scale.setScalar(0.5 + r() * 0.7);
      o.updateMatrix();
      flowers.push(o.matrix.clone());
    }
    return { shrooms: out, flowers };
  }, []);
  const capRef = useRef<THREE.InstancedMesh>(null);
  const stemRef = useRef<THREE.InstancedMesh>(null);
  const flRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    for (const [ref, list] of [[capRef, spots.shrooms], [stemRef, spots.shrooms], [flRef, spots.flowers]] as const) {
      const m = ref.current;
      if (!m) continue;
      list.forEach((mx, i) => m.setMatrixAt(i, mx));
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [spots]);
  const grow = useRef(-1);
  useFrame(({ clock }, dt) => {
    if (grow.current < 0) grow.current = bloomed ? 1 : 0;
    grow.current += ((bloomed ? 1 : 0) - grow.current) * (1 - Math.exp(-0.5 * Math.min(dt, 0.1)));
    if (flRef.current) {
      flRef.current.visible = grow.current > 0.01;
      flRef.current.count = Math.floor(spots.flowers.length * grow.current);
    }
    capMat.emissiveIntensity = 1.3 + Math.sin(clock.elapsedTime * 1.3) * 0.3 + grow.current * 0.6;
  });
  return (
    <group userData={{ noBatch: true }}>
      <instancedMesh ref={capRef} args={[shroom.cap, capMat, spots.shrooms.length]} />
      <instancedMesh ref={stemRef} args={[shroom.stem, stemMat, spots.shrooms.length]} />
      <instancedMesh ref={flRef} args={[flowerGeo, flowerMat, spots.flowers.length]} />
    </group>
  );
}

// ------------------------------------------------------------------ the Echo, the way back, story
const ECHO_SPOT = { x: 4.5, y: 0, z: HEART.z + 5 };
function EchoInGrove() {
  const stage = useAetheria((s) => s.world.echo);
  const inDialogue = useDialogue((s) => !!s.defId);
  const awake = stage !== "dormant" && stage !== "silent_observer";
  useEffect(() => {
    if (!awake || inDialogue) {
      interactables.delete("echo-h");
      return;
    }
    interactables.set("echo-h", { id: "echo-h", label: "לדבר עם הד העתיד", x: ECHO_SPOT.x - 0.6, y: 0, z: ECHO_SPOT.z + 0.6, radius: 2.2, onContact: () => useDialogue.getState().open(ECHO_TALK) });
    return () => void interactables.delete("echo-h");
  }, [awake, inDialogue]);
  return <FutureEcho stage={stage} anchors={[ECHO_SPOT]} waitAnchor={ECHO_SPOT} waiting inDialogue={inDialogue} tint={{ color: "#9ff2b8", accent: "#f0fff2", veils: ["#5fe0a0", "#ffd6ec"] }} />;
}

function Waystone() {
  const stone = usePBR("rock", { tint: 0x8a9a80 });
  const rune = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: new THREE.Color("#9ff2b8"), emissiveIntensity: 2.5 }), []);
  useEffect(() => {
    if (!worldAvailable("knowledge")) return;
    interactables.set("waystone-h", {
      id: "waystone-h",
      label: "אבן הדרך: חזרה אל היכל הדפוסים",
      x: WAYSTONE.x - 1,
      y: 0,
      z: WAYSTONE.z,
      radius: 1.8,
      onContact: () => {
        setArrival("knowledge", LIVING_GATE_ARRIVAL);
        void goToWorld("knowledge", { style: "resonance" });
      },
    });
    return () => void interactables.delete("waystone-h");
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
    if (st.world.flags.includes(H.entered)) return;
    const before = st.world.journal.length;
    if (st.dispatch(onEnterGrove())) {
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
    if (telemetry.y > -6 || cooldown.current > 0) return;
    cooldown.current = 1.5;
    playerCommands.teleport(SPAWN.x, SPAWN.y + 0.3, SPAWN.z, SPAWN.yaw);
  });
  return null;
}

/** Undergrowth: low leaf cards (ferns, shrubs) across the basin floor, off the path and springs. */
function Undergrowth({ quality }: { quality: Quality }) {
  const leaf = usePBR("leaf", { tint: 0x7f9f60, normalScale: 0.5 });
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const n = quality === "low" ? 500 : quality === "medium" ? 900 : 1400;
  const mats = useMemo(() => {
    const r = rng(91);
    const o = new THREE.Object3D();
    const out: THREE.Matrix4[] = [];
    let guard = 0;
    while (out.length < n && guard++ < n * 6) {
      // clumps: pick a centre, scatter a few cards around it
      const a = r() * Math.PI * 2;
      const d = 5 + r() * (BOUND_R - 6);
      const cx = Math.cos(a) * d;
      const cz = Math.sin(a) * d;
      if (Math.abs(cx) < 2.6 && cz > HEART.z) continue;
      if (Object.values(SPRING_SPOTS).some((s) => Math.hypot(s.x - cx, s.z - cz) < s.r + 1.5)) continue;
      if (Math.hypot(cx - HEART.x, cz - HEART.z) < HEART.r * 2) continue;
      for (let k = 0; k < 6 && out.length < n; k++) {
        const s = 0.5 + r() * 0.9;
        o.position.set(cx + (r() - 0.5) * 1.6, s * 0.4, cz + (r() - 0.5) * 1.6);
        o.rotation.set(-0.3 - r() * 0.6, r() * Math.PI * 2, 0);
        o.scale.setScalar(s);
        o.updateMatrix();
        out.push(o.matrix.clone());
      }
    }
    return out;
  }, [n]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    mats.forEach((mx, i) => m.setMatrixAt(i, mx));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [mats]);
  return <instancedMesh ref={ref} args={[geo, leaf, mats.length]} receiveShadow userData={{ noBatch: true }} />;
}

/** Ordinary trees between the giants (the existing LOD trees). */
function Understory({ quality }: { quality: Quality }) {
  const trees = useMemo(() => {
    const r = rng(71);
    const out: { x: number; z: number; s: number }[] = [];
    while (out.length < 12) {
      const a = r() * Math.PI * 2;
      const d = 17 + r() * 14;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (Math.abs(x) < 4 && z > 0) continue;
      if (Object.values(SPRING_SPOTS).some((s) => Math.hypot(s.x - x, s.z - z) < 6)) continue;
      if (GIANTS.some((g) => Math.hypot(g.x - x, g.z - z) < 7)) continue;
      out.push({ x, z, s: 400 + out.length });
    }
    return out;
  }, []);
  return (
    <>
      {trees.map((t) => (
        <Tree key={t.s} x={t.x} z={t.z} seed={t.s} height={6 + (t.s % 4)} shadows={quality !== "low"} />
      ))}
    </>
  );
}

/** The Gate of Dreams: rises beside the path when the Heart Tree blooms — into the Kingdom of the Mind. */
function DreamsGate() {
  const bloomed = useAetheria((s) => s.world.flags.includes(H.bloomed));
  const stone = usePBR("ruinwall", { tint: 0xb8b0c8 });
  const kit = useSanctuaryKit();
  const seal = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOn: { value: 0 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform float uTime; uniform float uOn; varying vec2 vUv;
          void main(){ vec2 p = vUv - 0.5; float r = length(p * vec2(1.0, 0.7));
            float ripple = 0.5 + 0.5 * sin(r * 30.0 - uTime * 1.2) * sin(atan(p.y, p.x) * 3.0 + uTime * 0.3);
            float a = smoothstep(0.6, 0.15, r) * (0.3 + 0.55 * ripple) * uOn;
            gl_FragColor = vec4(mix(vec3(0.85, 0.6, 1.0), vec3(0.55, 0.95, 1.0), ripple) * a * 1.5, 1.0); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  const g = useRef<THREE.Group>(null);
  const rise = useRef(-1);
  useFrame(({ clock }, dt) => {
    if (rise.current < 0) rise.current = bloomed ? 1 : 0;
    rise.current += ((bloomed ? 1 : 0) - rise.current) * (1 - Math.exp(-0.6 * Math.min(dt, 0.1)));
    seal.uniforms.uTime.value = clock.elapsedTime;
    seal.uniforms.uOn.value = rise.current;
    if (g.current) {
      g.current.visible = rise.current > 0.01;
      g.current.position.y = -6 * (1 - smooth(0, 1, rise.current));
    }
  });
  useEffect(() => {
    if (!bloomed || !worldAvailable("mind")) return;
    interactables.set("dreams-gate", {
      id: "dreams-gate",
      label: "היכנסו להיכל ההשתקפויות",
      x: DREAMS_GATE.x + 2,
      y: 0,
      z: DREAMS_GATE.z,
      radius: 2.4,
      onContact: () => void goToWorld("mind", { style: "resonance" }),
    });
    return () => void interactables.delete("dreams-gate");
  }, [bloomed]);
  return (
    <group position={[DREAMS_GATE.x, 0, DREAMS_GATE.z]} userData={{ noBatch: true }}>
      {bloomed && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.65, 2.2, 2.6]} position={[0, 2.2, 0]} />
        </RigidBody>
      )}
      <group ref={g} rotation-y={Math.PI / 2} scale={0.6}>
        <mesh geometry={kit.arch_gate} material={stone} castShadow receiveShadow />
        <mesh material={seal} position={[0, 2.4, 0]}>
          <planeGeometry args={[3.6, 5.2]} />
        </mesh>
      </group>
    </group>
  );
}

export function HealthScene({ quality }: { quality: Quality }) {
  return (
    <group>
      <Basin />
      <Giants quality={quality} />
      <Understory quality={quality} />
      <Undergrowth quality={quality} />
      <HeartTree />
      {SPRINGS.map((s) => (
        <Spring key={s} id={s} />
      ))}
      <Flora />
      <EchoInGrove />
      <DreamsGate />
      <Waystone />
      <Story />
      <Arrival world="health" />
      <ResonanceFx />
      <PostFx quality={quality} />
      <SoundController />
      <DustMotes count={quality === "low" ? 120 : 260} />
    </group>
  );
}
