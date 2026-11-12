/**
 * Veils of light for the Future Echo (visual bible: "resonance threads", the ribbon figure of the
 * reference). Each veil is a chain of points pinned to a bone that trails behind with verlet
 * inertia, drifts upward (it is light, not cloth) and sways in a slow wind. It is drawn as a
 * camera-facing strip with an iridescent, flowing, additive shader; "broken" veils (the Fragmented
 * Mind) flicker in segments.
 * Pure three.js: no React. The simulation is deterministic given dt, so it is unit-tested.
 */
import * as THREE from "three";

export const VEIL_POINTS = 12;

export interface VeilSim {
  p: THREE.Vector3[];
  prev: THREE.Vector3[];
  seg: number;
  seed: number;
}

export function createVeil(root: THREE.Vector3, length: number, seed: number): VeilSim {
  const seg = length / (VEIL_POINTS - 1);
  const p = Array.from({ length: VEIL_POINTS }, (_, i) => root.clone().add(new THREE.Vector3(0, -i * seg * 0.3, -i * seg * 0.9)));
  return { p, prev: p.map((v) => v.clone()), seg, seed };
}

/** Snap the whole chain to the root (after the Echo relocates, so it doesn't streak across the room). */
export function resetVeil(v: VeilSim, root: THREE.Vector3, back: THREE.Vector3) {
  for (let i = 0; i < VEIL_POINTS; i++) {
    v.p[i].copy(root).addScaledVector(back, i * v.seg * 0.9);
    v.prev[i].copy(v.p[i]);
  }
}

const tmp = new THREE.Vector3();
const acc = new THREE.Vector3();

/**
 * One step. `back` is the direction the veil streams toward (behind the figure), `side` its sway axis.
 */
export function stepVeil(v: VeilSim, root: THREE.Vector3, back: THREE.Vector3, side: THREE.Vector3, t: number, dt: number) {
  const h = Math.min(dt, 1 / 30);
  v.p[0].copy(root);
  v.prev[0].copy(root);
  for (let i = 1; i < VEIL_POINTS; i++) {
    const k = i / (VEIL_POINTS - 1);
    const sway = Math.sin(t * 1.3 + i * 0.55 + v.seed * 6.28) * 0.9 + Math.sin(t * 0.7 + v.seed * 3.1) * 0.5;
    // light rises and spreads (the reference figure), only slightly streaming back: the Echo faces
    // the player, so veils that stream straight back would hide behind its own body
    acc.set(0, 1.25, 0).addScaledVector(back, 0.4).addScaledVector(side, sway * (0.7 + k * 1.2));
    const p = v.p[i];
    tmp.copy(p);
    p.addScaledVector(tmp.clone().sub(v.prev[i]), 0.9).addScaledVector(acc, h * h);
    v.prev[i].copy(tmp);
  }
  // keep segment lengths (two relaxation passes, root pinned)
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < VEIL_POINTS; i++) {
      const a = v.p[i - 1];
      const b = v.p[i];
      tmp.subVectors(b, a);
      const d = tmp.length() || 1e-6;
      const diff = (d - v.seg) / d;
      if (i === 1) b.addScaledVector(tmp, -diff);
      else {
        a.addScaledVector(tmp, diff * 0.5);
        b.addScaledVector(tmp, -diff * 0.5);
      }
    }
  }
}

/** Triangle strip for one veil (positions rewritten every frame). uv.x = along (0 root .. 1 tip). */
export function veilGeometry() {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(VEIL_POINTS * 2 * 3);
  const uv = new Float32Array(VEIL_POINTS * 2 * 2);
  const idx: number[] = [];
  for (let i = 0; i < VEIL_POINTS; i++) {
    const t = i / (VEIL_POINTS - 1);
    uv.set([t, 0, t, 1], i * 4);
    if (i < VEIL_POINTS - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const dir = new THREE.Vector3();
const view = new THREE.Vector3();
const w = new THREE.Vector3();
/** Write the strip: each point gets two vertices across the veil, facing the camera, tapering. */
export function writeVeil(g: THREE.BufferGeometry, v: VeilSim, camera: THREE.Vector3, width: number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < VEIL_POINTS; i++) {
    const a = v.p[Math.max(0, i - 1)];
    const b = v.p[Math.min(VEIL_POINTS - 1, i + 1)];
    dir.subVectors(b, a).normalize();
    view.subVectors(camera, v.p[i]).normalize();
    w.crossVectors(dir, view).normalize();
    const k = i / (VEIL_POINTS - 1);
    const half = width * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, k * 1.15 + 0.08))) * 0.5;
    pos.setXYZ(i * 2, v.p[i].x - w.x * half, v.p[i].y - w.y * half, v.p[i].z - w.z * half);
    pos.setXYZ(i * 2 + 1, v.p[i].x + w.x * half, v.p[i].y + w.y * half, v.p[i].z + w.z * half);
  }
  pos.needsUpdate = true;
  g.computeBoundingSphere();
}

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const frag = /* glsl */ `
uniform vec3 uA; uniform vec3 uB; uniform float uTime; uniform float uOpacity; uniform float uBroken; uniform float uSeed;
varying vec2 vUv;
void main() {
  float t = vUv.x;
  float edge = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
  float fade = pow(1.0 - t, 1.25) * smoothstep(0.0, 0.06, t);
  float flow = 0.55 + 0.45 * sin(t * 15.0 - uTime * 3.2 + uSeed * 6.0);
  // broken veils: segments switch off and on, like a corrupted memory
  float cell = floor(t * 8.0) + floor(uTime * 5.0 + uSeed * 3.0) * 7.0;
  float gap = step(uBroken * 0.75, fract(sin(cell * 12.9898 + uSeed * 78.2) * 43758.5453));
  // iridescence: the colour slides along the veil and across it
  vec3 col = mix(uA, uB, 0.5 + 0.5 * sin(t * 5.0 + uTime * 0.8 + uSeed * 3.0));
  col += vec3(0.25, -0.05, 0.3) * sin(vUv.y * 6.0 + uTime * 1.3 + t * 4.0) * 0.35;
  float a = edge * fade * flow * gap * uOpacity;
  gl_FragColor = vec4(col * a * 1.7, 1.0);
}`;

export function veilMaterial(seed: number) {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: { uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uTime: { value: 0 }, uOpacity: { value: 0 }, uBroken: { value: 0 }, uSeed: { value: seed } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}
