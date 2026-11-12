/**
 * The Future Echo — rendering of the Shifting Presence. Behaviour comes from aetheria/echo/behavior
 * (pure, tested); this component only animates it:
 *  - takes the player's own form (clone of the current avatar, whatever model that is), as light;
 *  - idle animation, head turns toward the player, waves back / tilts its head / looks up;
 *  - Silent Observer: withdraws when approached (unless the story makes it wait);
 *    Fragmented Mind: violet-gold, breaks into flickering shards, stays and speaks;
 *    Future Companion: whole, golden, long calm veils.
 *  - the Shifting Presence (visual bible): a glass-like body lit at its edges with threads of light
 *    rising through it, veils of light trailing from head, shoulders, hands and hips (echo/veils),
 *    a featureless glow for a face, and glass shards circling it while it is fragmented.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { suspend } from "suspend-react";
import { resolveAvatar } from "../../../avatar/avatarSource";
import { gltfExtensions } from "../../../lib/loaders";
import { telemetry } from "../../../player/Player";
import { findBone } from "../../../avatar/attach";
import { gameEvents, type GameEvent } from "../../../engine/events";
import { APPEARANCE, decide, type EchoMode } from "../../echo/behavior";
import type { EchoStage } from "../../core/model";
import { createVeil, resetVeil, stepVeil, veilGeometry, veilMaterial, writeVeil, type VeilSim } from "../../echo/veils";
import type { CanonicalBone } from "../../../avatar/loadout";

/** Where veils grow from: bone + offset in the Echo's own frame (+Z forward, +X its left). Order = priority. */
const VEIL_ROOTS: { bone: CanonicalBone; off: [number, number, number] }[] = [
  { bone: "chest", off: [0, 0.05, -0.14] },
  { bone: "head", off: [0, 0.08, -0.08] },
  { bone: "leftHand", off: [0, 0, 0] },
  { bone: "rightHand", off: [0, 0, 0] },
  { bone: "leftUpperArm", off: [0.02, 0.05, -0.08] },
  { bone: "rightUpperArm", off: [-0.02, 0.05, -0.08] },
  { bone: "hips", off: [0.14, 0, -0.12] },
  { bone: "hips", off: [-0.14, 0, -0.12] },
];
const MAX_SHARDS = 24;

export interface Anchor {
  x: number;
  y: number;
  z: number;
}

const MAX_MOTES = 240;

function echoMaterial(u: Record<string, { value: unknown }>) {
  const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, roughness: 1 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = `uniform float uTime; uniform float uGlitch; uniform float uBandScale; uniform float uGlitchAmp; varying vec3 vObj;\n${sh.vertexShader}`.replace(
      "#include <skinning_vertex>",
      `#include <skinning_vertex>
      vObj = transformed * uBandScale / 30.0 * 1.8; // ~metres whatever the rig's units
      // Fragmented Mind: horizontal bands of the figure jump sideways for a moment (shards)
      float band = floor(position.y * uBandScale + floor(uTime * 9.0) * 3.0);
      float rnd = fract(sin(band * 91.7) * 43758.5453);
      float on = step(1.0 - 0.22 * uGlitch, rnd);
      transformed += vec3(objectNormal.x, 0.0, objectNormal.z) * on * uGlitchAmp * (0.6 + rnd);`,
    );
    sh.fragmentShader = `uniform float uTime; uniform float uFresnel; uniform float uFlicker; uniform vec3 uAccent; varying vec3 vObj;\n${sh.fragmentShader}`.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.0);
      float scan = 0.82 + 0.18 * sin(uTime * 2.6 + vViewPosition.y * 9.0);
      float flick = 1.0 - uFlicker * step(0.86, fract(sin(floor(uTime * 12.0) * 12.9898) * 43758.5));
      // glass-like: almost empty inside, bright at the edges, with iridescence sliding over the rim
      vec3 iris = 0.5 + 0.5 * cos(6.2831 * (fres * 1.3 + uTime * 0.05 + vec3(0.0, 0.33, 0.67)));
      vec3 base = mix(totalEmissiveRadiance, uAccent, fres * 0.45) + iris * fres * 0.35;
      // threads of time rising through the body
      float th = pow(abs(sin(vObj.x * 23.0 + vObj.z * 17.0 + sin(vObj.y * 3.0) * 0.6)), 60.0) * (0.45 + 0.55 * sin(vObj.y * 7.0 - uTime * 2.4));
      totalEmissiveRadiance = (base * (0.06 + uFresnel * fres) + uAccent * max(th, 0.0) * 0.9) * scan * flick;`,
    );
  };
  return m;
}

export interface FutureEchoProps {
  stage: EchoStage;
  /** vantage points for the Silent Observer */
  anchors: Anchor[];
  /** where it waits when the story asks it to (and where it speaks) */
  waitAnchor: Anchor;
  waiting: boolean;
  inDialogue: boolean;
  /** the Shifting Presence takes the colours of the kingdom it stands in */
  tint?: { color: string; accent: string; veils: [string, string] };
}

export function FutureEcho({ stage, anchors, waitAnchor, waiting, inDialogue, tint }: FutureEchoProps) {
  const gl = useThree((s) => s.gl);
  const avatar = suspend(() => resolveAvatar(), ["avatar"]);
  const gltf = useGLTF(avatar.url, false, true, gltfExtensions(gl));
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uGlitch: { value: 0 },
      uBandScale: { value: 16 },
      uGlitchAmp: { value: 0.05 },
      uFresnel: { value: 1.9 },
      uFlicker: { value: 0.1 },
      uAccent: { value: new THREE.Color("#dff6ff") },
    }),
    [],
  );
  const material = useMemo(() => echoMaterial(uniforms), [uniforms]);

  const rig = useMemo(() => {
    const scene = cloneSkinned(gltf.scene) as THREE.Object3D;
    let height = 1;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = material;
        m.castShadow = false;
        m.receiveShadow = false;
        m.frustumCulled = false;
        m.renderOrder = 10;
        m.geometry.computeBoundingBox();
        const bb = m.geometry.boundingBox!;
        height = Math.max(height, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
      }
    });
    // band size / glitch amplitude in the mesh's own units (cm for Rocketbox, m for Mixamo rigs)
    uniforms.uBandScale.value = 30 / height;
    uniforms.uGlitchAmp.value = height * 0.035;
    const mixer = new THREE.AnimationMixer(scene);
    const clip = (n: string) => gltf.animations.find((c) => c.name === n) ?? null;
    const roots = VEIL_ROOTS.map((r) => ({ ...r, node: findBone(scene, r.bone) }));
    return { scene, mixer, idle: clip("idle"), wave: clip("wave"), head: findBone(scene, "head"), chest: findBone(scene, "chest"), roots };
  }, [gltf, material, uniforms]);

  const actions = useRef<{ idle?: THREE.AnimationAction; wave?: THREE.AnimationAction }>({});
  useEffect(() => {
    const a: typeof actions.current = {};
    if (rig.idle) {
      a.idle = rig.mixer.clipAction(rig.idle);
      a.idle.play();
    }
    if (rig.wave) {
      a.wave = rig.mixer.clipAction(rig.wave);
      a.wave.setLoop(THREE.LoopOnce, 1);
      a.wave.clampWhenFinished = false;
    }
    actions.current = a;
    return () => void rig.mixer.stopAllAction();
  }, [rig]);

  const motes = useMemo(() => {
    const pos = new Float32Array(MAX_MOTES * 3);
    const seed = new Float32Array(MAX_MOTES);
    for (let i = 0; i < MAX_MOTES; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.25 + Math.random() * 0.6;
      pos.set([Math.cos(a) * r, Math.random() * 2, Math.sin(a) * r], i * 3);
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0xbfeeff, size: 0.045, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
    return { g, m, seed };
  }, []);

  const camera = useThree((s) => s.camera);
  const veils = useMemo(
    () =>
      VEIL_ROOTS.map((_, i) => ({ geo: veilGeometry(), mat: veilMaterial(i * 0.137 + 0.05), sim: null as VeilSim | null, on: 0 })),
    [],
  );
  const shards = useMemo(() => {
    const geo = new THREE.OctahedronGeometry(1, 0);
    geo.scale(0.6, 1.4, 0.6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const mesh = new THREE.InstancedMesh(geo, mat, MAX_SHARDS);
    mesh.frustumCulled = false;
    const orbit = Array.from({ length: MAX_SHARDS }, () => ({ r: 0.35 + Math.random() * 0.5, y: -0.6 + Math.random() * 1.3, speed: 0.4 + Math.random() * 0.9, phase: Math.random() * 6.28, size: 0.025 + Math.random() * 0.04, spin: Math.random() * 3 }));
    return { mesh, mat, orbit, shown: 0 };
  }, []);
  const glow = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g2 = c.getContext("2d")!;
    const grd = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.3, "rgba(255,255,255,.45)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g2.fillStyle = grd;
    g2.fillRect(0, 0, 64, 64);
    return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  }, []);
  const glowRef = useRef<THREE.Sprite>(null);

  // player / story events reach the Echo for one frame
  const pendingEvent = useRef<GameEvent | null>(null);
  useEffect(() => gameEvents.on((e) => void (pendingEvent.current = e)), []);

  const group = useRef<THREE.Group>(null);
  const st = useRef({ anchor: 0, fade: 0, relocating: false, wait: 0, mode: "hidden" as EchoMode, lookUp: 0, tilt: 0, glitch: 0 });
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), q2: new THREE.Quaternion(), v: new THREE.Vector3(), c: new THREE.Color() }), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = st.current;
    const g = group.current;
    if (!g) return;
    uniforms.uTime.value += dt;

    // ---- decide (pure behaviour)
    const here = s.mode === "wait" || s.mode === "converse" ? waitAnchor : anchors[s.anchor % anchors.length];
    const dx = telemetry.x - here.x;
    const dz = telemetry.z - here.z;
    const d = decide({ stage, dist: Math.hypot(dx, dz), sameLevel: Math.abs(telemetry.y - here.y) < 2.5, waiting, inDialogue, event: pendingEvent.current });
    pendingEvent.current = null;
    s.mode = d.mode;
    if (d.reaction === "wave" && actions.current.wave && !actions.current.wave.isRunning()) {
      actions.current.wave.reset().setEffectiveWeight(1).fadeIn(0.3).play();
      actions.current.idle?.fadeOut(0.3);
      setTimeout(() => {
        actions.current.wave?.fadeOut(0.5);
        actions.current.idle?.reset().fadeIn(0.5).play();
      }, (rig.wave?.duration ?? 2.5) * 1000 * 0.85);
    }
    if (d.reaction === "look_up") s.lookUp = 3;
    if (d.reaction === "tilt") s.tilt = 1.6;

    // ---- position / withdraw / relocate
    const anchor = d.mode === "wait" || d.mode === "converse" ? waitAnchor : anchors[s.anchor % anchors.length];
    g.position.set(anchor.x, anchor.y, anchor.z);
    if (d.mode === "withdraw" && !s.relocating && anchors.length > 1) s.relocating = true;
    const visible = d.mode !== "hidden" && !s.relocating;
    s.fade += ((visible ? 1 : 0) - s.fade) * (1 - Math.exp(-(visible ? 1.6 : 4) * dt));
    if (s.relocating && s.fade < 0.02) {
      s.wait += dt;
      if (s.wait > 1.5) {
        for (let k = 1; k <= anchors.length; k++) {
          const n = anchors[(s.anchor + k) % anchors.length];
          if (Math.hypot(telemetry.x - n.x, telemetry.z - n.z) > 6) {
            s.anchor = (s.anchor + k) % anchors.length;
            break;
          }
        }
        s.relocating = false;
        s.wait = 0;
      }
    }
    if (d.mode === "wait" || d.mode === "converse") s.relocating = false;

    // ---- body turns slowly toward the player
    const want = Math.atan2(telemetry.x - anchor.x, telemetry.z - anchor.z);
    let diff = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y));
    g.rotation.y += diff * (1 - Math.exp(-(d.mode === "converse" ? 3 : 1.2) * dt));

    // ---- animation, then procedural head attention (after the mixer wrote the pose)
    rig.mixer.update(dt * 0.85);
    if (rig.head) {
      diff = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y));
      const yaw = THREE.MathUtils.clamp(diff, -0.8, 0.8) * d.attention;
      s.lookUp = Math.max(0, s.lookUp - dt);
      s.tilt = Math.max(0, s.tilt - dt);
      const pitch = -0.5 * Math.min(1, s.lookUp); // negative about the side axis = look up
      const roll = 0.35 * Math.sin(Math.min(1, s.tilt) * Math.PI);
      const parent = rig.head.parent!;
      parent.getWorldQuaternion(tmp.q).invert();
      const up = tmp.v.set(0, 1, 0).applyQuaternion(tmp.q);
      rig.head.quaternion.premultiply(tmp.q2.setFromAxisAngle(up, yaw));
      const side = tmp.v.set(1, 0, 0).applyQuaternion(g.quaternion).applyQuaternion(tmp.q);
      rig.head.quaternion.premultiply(tmp.q2.setFromAxisAngle(side, pitch));
      const fwd = tmp.v.set(0, 0, 1).applyQuaternion(g.quaternion).applyQuaternion(tmp.q);
      rig.head.quaternion.premultiply(tmp.q2.setFromAxisAngle(fwd, roll));
    }

    // ---- the Shifting Presence: appearance per stage
    const baseLook = stage === "dormant" ? APPEARANCE.silent_observer : APPEARANCE[stage];
    const look = tint ? { ...baseLook, color: tint.color, accent: tint.accent, veils: { ...baseLook.veils, colors: tint.veils } } : baseLook;
    material.emissive.lerp(tmp.c.set(look.color), 1 - Math.exp(-2 * dt));
    (uniforms.uAccent.value as THREE.Color).set(look.accent);
    // a burst of shards right when it becomes the Fragmented Mind, then its normal flicker
    s.glitch += (look.glitch - s.glitch) * (1 - Math.exp(-1.5 * dt));
    uniforms.uGlitch.value = s.glitch;
    uniforms.uFresnel.value = look.fresnel;
    uniforms.uFlicker.value = look.flicker;
    material.opacity = look.opacity * s.fade;
    motes.m.color.set(look.accent);
    motes.m.opacity = 0.8 * s.fade;
    motes.g.setDrawRange(0, look.motes);
    g.visible = s.fade > 0.01;
    const p = motes.g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < look.motes; i++) {
      let y = p.getY(i) + dt * (look.moteSpeed * (0.6 + motes.seed[i]));
      if (y > 2.1) y = 0;
      p.setY(i, y);
      if (look.glitch > 0) {
        // fragmented: motes orbit the figure
        const a = dt * (0.8 + motes.seed[i]);
        const x = p.getX(i);
        const z = p.getZ(i);
        p.setX(i, x * Math.cos(a) - z * Math.sin(a));
        p.setZ(i, x * Math.sin(a) + z * Math.cos(a));
      }
    }
    p.needsUpdate = true;

    // ---- veils of light, glass shards, the face of light (world space)
    g.updateMatrixWorld(true);
    const back = tmp.v.set(0, 0, -1).applyQuaternion(g.quaternion).clone();
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(g.quaternion);
    const t = uniforms.uTime.value;
    const cA = tmp.c.set(look.veils.colors[0]).clone();
    const cB = new THREE.Color(look.veils.colors[1]);
    veils.forEach((v, i) => {
      const root = rig.roots[i];
      v.on += ((i < look.veils.count && root.node ? 1 : 0) - v.on) * (1 - Math.exp(-1.2 * dt));
      if (!root.node || v.on < 0.005) return;
      const rp = root.node.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...root.off).applyQuaternion(g.quaternion));
      if (!v.sim || Math.abs(v.sim.seg * 11 - look.veils.length) > 0.01) v.sim = createVeil(rp, look.veils.length, i * 0.137);
      if (s.fade < 0.05) resetVeil(v.sim, rp, back);
      stepVeil(v.sim, rp, back, side, t, dt);
      writeVeil(v.geo, v.sim, camera.position, look.veils.width * (i < 2 ? 1.25 : 1));
      v.mat.uniforms.uTime.value = t;
      v.mat.uniforms.uOpacity.value = v.on * s.fade * 0.85;
      v.mat.uniforms.uBroken.value = look.veils.broken;
      (v.mat.uniforms.uA.value as THREE.Color).lerp(cA, 1 - Math.exp(-2 * dt));
      (v.mat.uniforms.uB.value as THREE.Color).lerp(cB, 1 - Math.exp(-2 * dt));
    });
    // shards orbit the chest while it is fragmented; they settle away as it becomes whole
    shards.shown += (look.shards - shards.shown) * (1 - Math.exp(-1.0 * dt));
    shards.mat.color.set(look.accent);
    shards.mat.opacity = s.fade * 0.9;
    const centre = (rig.chest ?? rig.scene).getWorldPosition(new THREE.Vector3());
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < MAX_SHARDS; i++) {
      const o = shards.orbit[i];
      const vis = THREE.MathUtils.clamp(shards.shown - i, 0, 1);
      const a = o.phase + t * o.speed;
      const jitter = look.glitch > 0 && Math.random() < 0.02 ? 0.08 : 0;
      q.setFromEuler(new THREE.Euler(t * o.spin, t * o.spin * 0.7, 0));
      m4.compose(new THREE.Vector3(centre.x + Math.cos(a) * o.r + jitter, centre.y + o.y + Math.sin(t * 0.8 + o.phase) * 0.08, centre.z + Math.sin(a) * o.r), q, new THREE.Vector3().setScalar(o.size * vis + 1e-4));
      shards.mesh.setMatrixAt(i, m4);
    }
    shards.mesh.instanceMatrix.needsUpdate = true;
    // a face of light, no features
    if (glowRef.current && rig.head) {
      rig.head.getWorldPosition(glowRef.current.position).add(new THREE.Vector3(0, 0.06, 0.08).applyQuaternion(g.quaternion));
      glow.color.set(look.accent);
      glow.opacity = s.fade * (0.75 + 0.25 * Math.sin(t * 2.3));
      glowRef.current.scale.setScalar(0.32);
    }
  });

  return (
    <>
      <group ref={group} userData={{ noBatch: true }}>
        <primitive object={rig.scene} />
        <points geometry={motes.g} material={motes.m} />
      </group>
      {/* world-space parts of the presence */}
      <group userData={{ noBatch: true }}>
        {veils.map((v, i) => (
          <mesh key={i} geometry={v.geo} material={v.mat} frustumCulled={false} renderOrder={11} />
        ))}
        <primitive object={shards.mesh} />
        <sprite ref={glowRef} material={glow} renderOrder={12} />
      </group>
    </>
  );
}
