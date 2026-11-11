/**
 * The Origin Fragment (visual bible §3.4): an asymmetric obsidian crystal, not a glowing gem.
 *   - faceted, asymmetric body of dark glass (environment reflections, no transmission cost)
 *   - three internal streams of light: gold = FORM, violet = CHANGE, teal = CONNECTION; they
 *     wander apart while dormant and braid together as the stage rises
 *   - a ring of the six kingdom symbols that wakes with the kingdoms
 *   - resonance ripples on the floor and vertical threads of time
 * The stage is derived from the world (content/originFragment.ts); every visual parameter eases
 * toward the stage's target, so evolving is a visible moment, and a restored world is just there.
 */
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { rng } from "../../../world/geometry";
import { KINGDOM_IDS } from "../../core/model";
import { SIGILS } from "../../content/firstResonance";
import type { FragmentStage } from "../../content/originFragment";
import { kingdomGlyph } from "./glyphs";
import { resonance, smooth } from "./shared";

interface Look {
  streams: number; // brightness of the three inner streams
  spread: number; // how far apart the streams wander (1 = apart, 0.3 = braided)
  speed: number;
  symbols: number;
  ripples: number;
  threads: number;
  rim: number;
  rimColor: THREE.Color;
  spin: number;
}
const C = (h: string) => new THREE.Color(h);
const LOOK: Record<FragmentStage, Look> = {
  dormant: { streams: 0.12, spread: 1, speed: 0.15, symbols: 0, ripples: 0, threads: 0, rim: 0.25, rimColor: C("#6d7a8c"), spin: 0.08 },
  awakening: { streams: 0.7, spread: 0.95, speed: 0.4, symbols: 0.12, ripples: 0.35, threads: 0.2, rim: 0.9, rimColor: C("#7ff5e1"), spin: 0.25 },
  attunement: { streams: 1.1, spread: 0.85, speed: 0.6, symbols: 0.75, ripples: 0.6, threads: 0.45, rim: 1.0, rimColor: C("#9fb8ff"), spin: 0.3 },
  convergence: { streams: 1.5, spread: 0.55, speed: 0.85, symbols: 1.0, ripples: 0.8, threads: 0.7, rim: 1.2, rimColor: C("#ffd98a"), spin: 0.35 },
  transcendence: { streams: 2.0, spread: 0.3, speed: 1.1, symbols: 1.2, ripples: 1.0, threads: 1.0, rim: 1.5, rimColor: C("#fff1cf"), spin: 0.4 },
};

const STREAM_COLORS = [C("#ffc65c"), C("#b48cff"), C("#5ff2dc")];
const H = 1.5; // crystal height (m)

/** Asymmetric faceted crystal: a convex hull of seeded points on a leaning, uneven spindle. */
function crystalGeometry() {
  const r = rng(77);
  const pts: THREE.Vector3[] = [new THREE.Vector3(0.07, H * 0.56, -0.03), new THREE.Vector3(-0.05, -H * 0.44, 0.04)];
  const rings = [
    { y: H * 0.28, r: 0.2, n: 5 },
    { y: H * 0.05, r: 0.34, n: 7 },
    { y: -H * 0.18, r: 0.28, n: 6 },
  ];
  for (const ring of rings) {
    const off = r() * Math.PI;
    for (let i = 0; i < ring.n; i++) {
      const a = off + (i / ring.n) * Math.PI * 2 + (r() - 0.5) * 0.5;
      const rad = ring.r * (0.7 + r() * 0.55);
      pts.push(new THREE.Vector3(Math.cos(a) * rad + ring.y * 0.08, ring.y + (r() - 0.5) * 0.12, Math.sin(a) * rad * 0.85));
    }
  }
  const g = new ConvexGeometry(pts);
  g.computeVertexNormals();
  return g;
}

/**
 * A stream of light: a thin tube along a twisting path inside the crystal. Two versions of the same
 * path (apart / braided) share topology; the shader blends them, so the tube keeps its thickness.
 */
function streamPath(phase: number, radius: number, turns: number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const taper = Math.sin(Math.PI * t);
    const a = phase + t * Math.PI * 2 * turns;
    pts.push(new THREE.Vector3(Math.cos(a) * taper * radius, (t - 0.5) * H * 0.82, Math.sin(a) * taper * radius * 0.85));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, 0.016, 5, false);
}
function streamGeometry(phase: number) {
  const apart = streamPath(phase, 0.24, 1.0);
  const braided = streamPath(phase, 0.06, 2.2);
  apart.setAttribute("aBraid", braided.getAttribute("position").clone());
  braided.dispose();
  return apart;
}

const streamVert = /* glsl */ `
attribute vec3 aBraid;
uniform float uBraid;
varying float vU;
void main() { vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(mix(position, aBraid, uBraid), 1.0); }`;
const streamFrag = /* glsl */ `
uniform vec3 uColor; uniform float uI; uniform float uTime; uniform float uSpeed; uniform float uPhase;
varying float vU;
void main() {
  float pulse = pow(0.5 + 0.5 * sin((vU * 5.0 - uTime * uSpeed * 2.0 + uPhase) * 6.2831), 5.0);
  float ends = smoothstep(0.0, 0.1, vU) * smoothstep(1.0, 0.9, vU);
  float a = uI * (0.3 + pulse * 1.4) * ends;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

const rimVert = /* glsl */ `
varying vec3 vN; varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const rimFrag = /* glsl */ `
uniform vec3 uColor; uniform float uI;
varying vec3 vN; varying vec3 vV;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0);
  gl_FragColor = vec4(uColor * f * uI, 1.0);
}`;

const rippleVert = /* glsl */ `
varying vec2 vP;
void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const rippleFrag = /* glsl */ `
uniform float uI; uniform float uTime;
varying vec2 vP;
void main() {
  float r = length(vP);
  // thin, travelling rings that fade outward: a resonance in the stone, not a UI target
  float rings = pow(0.5 + 0.5 * sin(r * 7.0 - uTime * 1.3), 40.0);
  float fade = pow(smoothstep(3.6, 0.9, r), 1.6) * smoothstep(0.75, 1.0, r);
  vec3 col = mix(vec3(1.0, 0.70, 0.36), vec3(0.32, 0.92, 0.84), 0.5 + 0.5 * sin(r * 1.3 - uTime * 0.4));
  gl_FragColor = vec4(col * rings * fade * uI * 0.45, 1.0);
}`;

const threadFrag = /* glsl */ `
uniform float uI; uniform float uTime; uniform float uSeed;
varying vec2 vUv;
void main() {
  float flow = pow(0.5 + 0.5 * sin((vUv.y * 3.0 + uTime * 0.35 + uSeed) * 6.2831), 6.0);
  float core = smoothstep(0.5, 0.0, abs(vUv.x - 0.5));
  float ends = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
  gl_FragColor = vec4(vec3(1.0, 0.9, 0.72) * core * ends * (0.25 + flow) * uI, 1.0);
}`;
const threadVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const additive = (fragmentShader: string, vertexShader: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });

export function OriginFragment({ stage, floorOffset, glowBoost = 1 }: { stage: FragmentStage; floorOffset: number; glowBoost?: number }) {
  const body = useMemo(crystalGeometry, []);
  const bodyMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: 0x0d0b14,
        roughness: 0.07,
        metalness: 0.25,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.8,
        transparent: true,
        opacity: 0.84,
        depthWrite: false,
        flatShading: true,
      }),
    [],
  );
  const streams = useMemo(() => [0, 1, 2].map((i) => streamGeometry((i / 3) * Math.PI * 2)), []);
  const streamMats = useMemo(
    () => STREAM_COLORS.map((c, i) => additive(streamFrag, streamVert, { uColor: { value: c.clone() }, uI: { value: 0 }, uTime: { value: 0 }, uSpeed: { value: 0.3 }, uPhase: { value: i * 0.33 }, uBraid: { value: 0 } })),
    [],
  );
  const rimMat = useMemo(() => additive(rimFrag, rimVert, { uColor: { value: new THREE.Color() }, uI: { value: 0 } }), []);
  const rippleMat = useMemo(() => additive(rippleFrag, rippleVert, { uI: { value: 0 }, uTime: { value: 0 } }), []);
  const threadMats = useMemo(() => [0, 1, 2, 3].map((i) => additive(threadFrag, threadVert, { uI: { value: 0 }, uTime: { value: 0 }, uSeed: { value: i * 0.37 } })), []);
  const symbolMats = useMemo(
    () => KINGDOM_IDS.map((k) => new THREE.MeshBasicMaterial({ map: kingdomGlyph(k), color: new THREE.Color(SIGILS.find((s) => s.kingdom === k)!.color).multiplyScalar(2.4), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })),
    [],
  );

  // current look, eased toward the stage's target
  const cur = useRef<Look | null>(null);
  const inner = useRef<THREE.Group>(null);
  const symbolRing = useRef<THREE.Group>(null);
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const t = clock.elapsedTime;
    const target = LOOK[stage];
    if (!cur.current) cur.current = { ...target, rimColor: target.rimColor.clone() };
    const c = cur.current;
    const k = 1 - Math.exp(-dt / 1.2); // ~1.2 s to settle
    for (const key of ["streams", "spread", "speed", "symbols", "ripples", "threads", "rim", "spin"] as const) c[key] += (target[key] - c[key]) * k;
    c.rimColor.lerp(target.rimColor, k);
    // the Resonance event floods everything for a moment
    const p = resonance.p;
    const surge = smooth(0, 0.3, p) * (1 - smooth(0.7, 1, p));
    if (inner.current) {
      inner.current.rotation.y += dt * (c.spin + surge * 3);
      inner.current.position.y = Math.sin(t * 1.3) * 0.08;
    }
    streamMats.forEach((m) => {
      m.uniforms.uI.value = (c.streams + surge * 2) * glowBoost;
      m.uniforms.uTime.value = t;
      m.uniforms.uSpeed.value = c.speed;
      m.uniforms.uBraid.value = (1 - c.spread) / 0.7;
    });
    rimMat.uniforms.uI.value = (c.rim + surge) * (0.85 + Math.sin(t * 2.1) * 0.15);
    (rimMat.uniforms.uColor.value as THREE.Color).copy(c.rimColor);
    rippleMat.uniforms.uI.value = c.ripples + surge;
    rippleMat.uniforms.uTime.value = t;
    threadMats.forEach((m) => {
      m.uniforms.uI.value = c.threads + surge * 1.5;
      m.uniforms.uTime.value = t;
    });
    if (symbolRing.current) {
      symbolRing.current.rotation.y -= dt * 0.12;
      symbolRing.current.visible = c.symbols > 0.01;
    }
    symbolMats.forEach((m, i) => (m.opacity = Math.min(1, c.symbols * (0.75 + 0.25 * Math.sin(t * 1.4 + i)))));
  });

  return (
    <group userData={{ noBatch: true }}>
      <group ref={inner}>
        <mesh geometry={body} material={bodyMat} renderOrder={1} />
        <group>
          {streams.map((g, i) => (
            <mesh key={i} geometry={g} material={streamMats[i]} renderOrder={2} frustumCulled={false} />
          ))}
        </group>
        <mesh geometry={body} material={rimMat} renderOrder={3} scale={1.015} />
      </group>
      {/* the six kingdoms around it */}
      <group ref={symbolRing}>
        {KINGDOM_IDS.map((k, i) => {
          const a = (i / KINGDOM_IDS.length) * Math.PI * 2;
          return (
            <mesh key={k} material={symbolMats[i]} position={[Math.cos(a) * 1.15, Math.sin(i * 1.7) * 0.12, Math.sin(a) * 1.15]} rotation-y={-a + Math.PI / 2} renderOrder={4}>
              <planeGeometry args={[0.4, 0.4]} />
            </mesh>
          );
        })}
      </group>
      {/* vertical threads of time */}
      {threadMats.map((m, i) => {
        const a = i * 1.9 + 0.4;
        const r = 0.45 + (i % 2) * 0.25;
        return (
          <mesh key={i} material={m} position={[Math.cos(a) * r, 0.6, Math.sin(a) * r]} renderOrder={2}>
            <planeGeometry args={[0.03, 6.5]} />
          </mesh>
        );
      })}
      {/* resonance ripples on the floor */}
      <mesh material={rippleMat} position={[0, floorOffset + 0.015, 0]} rotation-x={-Math.PI / 2} renderOrder={2}>
        <circleGeometry args={[3.6, 64]} />
      </mesh>
    </group>
  );
}
