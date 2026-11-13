/**
 * Celestial sky (AETHERIA visual bible: "fractured sky"). One full-screen-cost sky dome shader:
 *   - dusk gradient: temporal gold at the horizon → rose → aether violet → deep obsidian zenith
 *   - a low sun with a warm halo
 *   - stars that twinkle, strongest toward the zenith
 *   - a nebula band (violet / teal), slowly drifting
 *   - the First Fracture: jagged cracks of light low across the sky (gold and teal) with a soft
 *     glow — the signature of a broken creation, placed where a third-person camera looks
 * The dome follows the camera (never reaches the far plane) and ignores fog.
 * Quality: `detail` lowers the noise octaves on weaker devices.
 */
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // at the far plane, behind everything
}`;

const frag = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uSun;
uniform float uTime;
uniform int uOctaves;
uniform vec3 uHorizon; uniform vec3 uRose; uniform vec3 uViolet; uniform vec3 uZenith; uniform vec3 uBelow;
uniform vec3 uSunCol; uniform vec3 uNebA; uniform vec3 uNebB; uniform float uStarCut; uniform vec3 uCrackA; uniform vec3 uCrackB; uniform float uContinents;

float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) { if (i >= uOctaves) break; s += a * noise(p); p *= 2.03; a *= 0.5; }
  return s;
}
// A crack of light across the sky, defined in (azimuth, elevation) so it sits in the band a
// third-person camera actually sees. Azimuth 0 = north (-Z), clockwise. Jagged via noise.
vec3 crack(float az, float el, float a0, float a1, float e0, float e1, float w, vec3 col, float seed) {
  float u = (az - a0) / (a1 - a0);
  if (u < -0.05 || u > 1.05) return vec3(0.0);
  // angular, glass-like breaks (few straight segments), not lightning
  float k = u * 5.0;
  float jag = (mix(hash(vec3(floor(k), seed, 0.0)), hash(vec3(floor(k) + 1.0, seed, 0.0)), fract(k)) - 0.5) * 0.06;
  float dist = abs(el - (mix(e0, e1, u) + jag));
  float ends = smoothstep(-0.05, 0.12, u) * smoothstep(1.05, 0.88, u);
  float core = smoothstep(w, 0.0, dist);
  float glow = exp(-dist * 60.0) * 0.55 + exp(-dist * 14.0) * 0.18;
  float flicker = 0.85 + 0.15 * sin(uTime * 0.6 + seed * 5.0 + u * 6.0);
  return col * (core * 1.3 + glow) * ends * flicker;
}

// A floating continent far away: a silhouette on the horizon with a tapering underside and a thin
// rim of light on its top edge. Returns (rgb = colour to mix in, a = coverage).
vec4 continent(float az, float el, float a0, float a1, float base, float height, float seed) {
  float u = (az - a0) / (a1 - a0);
  if (u < 0.0 || u > 1.0) return vec4(0.0);
  float hump = pow(sin(3.14159 * u), 0.55);
  float top = base + height * hump * (0.7 + 0.45 * noise(vec3(u * 7.0, seed, 2.0)));
  float bottom = base - height * 1.6 * pow(sin(3.14159 * u), 1.8) * (0.8 + 0.3 * noise(vec3(u * 11.0, seed, 5.0)));
  float inside = smoothstep(bottom - 0.002, bottom + 0.002, el) * smoothstep(top + 0.002, top - 0.002, el);
  float rim = exp(-abs(top - el) * 420.0) * step(el, top + 0.004);
  vec3 body = vec3(0.13, 0.10, 0.20);
  return vec4(body + vec3(1.0, 0.72, 0.42) * rim * 1.2, max(inside * 0.9, rim * 0.7));
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  // dusk gradient
  vec3 horizon = uHorizon;
  vec3 rose = uRose;
  vec3 violet = uViolet;
  vec3 zenith = uZenith;
  // the warm horizon glow is strongest toward the sun
  float toSun = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0);
  vec3 col = mix(mix(rose, horizon, 0.35 + 0.65 * toSun), rose, smoothstep(-0.02, 0.07 + 0.08 * toSun, h));
  col = mix(col, violet, smoothstep(0.04, 0.2, h));
  col = mix(col, zenith, smoothstep(0.2, 0.7, h));
  col = mix(col, uBelow, smoothstep(0.0, -0.25, h)); // below the horizon: dusky cloud sea

  // sun + halo
  float s = max(dot(d, normalize(uSun)), 0.0);
  col += uSunCol * (pow(s, 6.0) * 0.35 + pow(s, 64.0) * 0.6) + mix(uSunCol, vec3(1.0), 0.6) * smoothstep(0.9993, 0.9998, s) * 4.0;

  // nebula band (tilted), drifting slowly
  vec3 axis = normalize(vec3(0.25, 0.92, 0.30));
  float band = exp(-pow(dot(d, axis) / 0.32, 2.0));
  float neb = fbm(d * 3.2 + vec3(uTime * 0.004, 0.0, 0.0));
  float neb2 = fbm(d * 6.5 - 3.1);
  vec3 nebCol = mix(uNebA, uNebB, smoothstep(0.35, 0.75, neb2));
  col += nebCol * band * smoothstep(0.38, 0.85, neb) * 0.6 * smoothstep(0.03, 0.22, h);

  // stars
  vec3 sp = d * 260.0;
  vec3 ip = floor(sp);
  float r = hash(ip);
  float star = step(uStarCut, r) * smoothstep(0.42, 0.0, length(fract(sp) - 0.5));
  star *= 0.6 + 0.4 * sin(uTime * (1.5 + r * 4.0) + r * 40.0);
  col += vec3(1.0, 0.95, 0.88) * star * smoothstep(0.05, 0.3, h) * 1.4;

  float az = atan(d.x, -d.z);
  float el = asin(clamp(h, -1.0, 1.0));
  // floating continents on the horizon (kept clear of the west, where the Sleeping Gate looks out)
  vec4 c1 = continent(az, el, 0.45, 1.3, 0.035, 0.085, 1.0);
  vec4 c2 = continent(az, el, 1.8, 2.6, 0.02, 0.07, 2.0);
  vec4 c3 = continent(az, el, -2.85, -2.15, 0.06, 0.05, 3.0);
  vec4 c4 = continent(az, el, -1.05, -0.55, 0.1, 0.045, 4.0);
  col = mix(col, c1.rgb, c1.a * uContinents);
  col = mix(col, c2.rgb, c2.a * uContinents);
  col = mix(col, c3.rgb, c3.a * uContinents);
  col = mix(col, c4.rgb, c4.a * uContinents);

  // the First Fracture: cracks of light low across the sky (where the player looks)
  vec3 gold = uCrackA;
  vec3 teal = uCrackB;
  col += crack(az, el, -0.75, 0.55, 0.30, 0.12, 0.0035, gold, 1.0);   // north, behind the observatory
  col += crack(az, el, -0.25, 0.30, 0.20, 0.36, 0.0022, teal, 2.0);   // north, crossing it
  col += crack(az, el, -1.95, -1.15, 0.10, 0.26, 0.0026, gold, 3.0);  // west, above the Sleeping Gate
  col += crack(az, el, 1.10, 1.90, 0.28, 0.14, 0.0020, teal, 4.0);    // east
  col += crack(az, el, 2.40, 3.10, 0.16, 0.30, 0.0024, gold, 5.0);    // south, over the approach

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export type SkyPalette = "dusk" | "astral" | "verdant" | "dream" | "ember" | "hearth" | "gilded";
const V = (r: number, g: number, b: number) => new THREE.Vector3(r, g, b);
/** dusk = the First Sanctuary; astral = the Kingdom of Knowledge (deep night blue, a pale moon, dense stars) */
const PALETTES: Record<SkyPalette, Record<string, THREE.Vector3 | number>> = {
  dusk: { uHorizon: V(0.92, 0.58, 0.34), uRose: V(0.5, 0.3, 0.42), uViolet: V(0.16, 0.11, 0.3), uZenith: V(0.02, 0.018, 0.05), uBelow: V(0.42, 0.33, 0.45), uSunCol: V(1, 0.62, 0.32), uNebA: V(0.42, 0.25, 0.7), uNebB: V(0.2, 0.62, 0.66), uStarCut: 0.993, uCrackA: V(1, 0.68, 0.3), uCrackB: V(0.25, 0.95, 0.85), uContinents: 1 },
  // the Vault of Value: a clear gilded morning, cream and gold over a cool teal zenith
  gilded: { uHorizon: V(1.0, 0.82, 0.52), uRose: V(0.7, 0.66, 0.56), uViolet: V(0.22, 0.36, 0.48), uZenith: V(0.03, 0.08, 0.14), uBelow: V(0.5, 0.42, 0.3), uSunCol: V(1, 0.86, 0.56), uNebA: V(0.6, 0.5, 0.3), uNebB: V(0.4, 0.6, 0.7), uStarCut: 0.9985, uCrackA: V(1, 0.85, 0.45), uCrackB: V(0.7, 0.95, 1.0), uContinents: 0.6 },
  // the Village of the Hearth: a blue twilight over a warm horizon, the first evening stars
  hearth: { uHorizon: V(0.95, 0.58, 0.36), uRose: V(0.42, 0.34, 0.5), uViolet: V(0.1, 0.13, 0.32), uZenith: V(0.012, 0.022, 0.065), uBelow: V(0.3, 0.26, 0.38), uSunCol: V(1, 0.66, 0.38), uNebA: V(0.35, 0.3, 0.7), uNebB: V(0.3, 0.6, 0.75), uStarCut: 0.992, uCrackA: V(1, 0.75, 0.45), uCrackB: V(0.6, 0.85, 1.0), uContinents: 0.7 },
  // the Great Works: a sooty orange dusk over the forges, the fracture molten
  ember: { uHorizon: V(0.95, 0.42, 0.16), uRose: V(0.45, 0.17, 0.1), uViolet: V(0.12, 0.05, 0.06), uZenith: V(0.02, 0.012, 0.016), uBelow: V(0.35, 0.12, 0.05), uSunCol: V(1, 0.5, 0.2), uNebA: V(0.5, 0.2, 0.1), uNebB: V(0.7, 0.45, 0.2), uStarCut: 0.996, uCrackA: V(1, 0.55, 0.15), uCrackB: V(1, 0.85, 0.5), uContinents: 0.5 },
  // the Hall of Reflections: a pink-lavender horizon under a deep teal sky, the fracture rose and pale cyan
  dream: { uHorizon: V(0.62, 0.36, 0.55), uRose: V(0.36, 0.22, 0.48), uViolet: V(0.1, 0.1, 0.28), uZenith: V(0.012, 0.03, 0.06), uBelow: V(0.3, 0.2, 0.36), uSunCol: V(1, 0.7, 0.85), uNebA: V(0.6, 0.3, 0.75), uNebB: V(0.3, 0.75, 0.85), uStarCut: 0.991, uCrackA: V(1, 0.6, 0.85), uCrackB: V(0.55, 0.95, 1.0), uContinents: 0 },
  // the Living Grove: a green-gold morning, few stars, the fracture faint and warm
  verdant: { uHorizon: V(0.78, 0.74, 0.46), uRose: V(0.45, 0.58, 0.5), uViolet: V(0.14, 0.32, 0.4), uZenith: V(0.03, 0.09, 0.16), uBelow: V(0.22, 0.3, 0.24), uSunCol: V(1, 0.86, 0.55), uNebA: V(0.3, 0.55, 0.45), uNebB: V(0.6, 0.8, 0.45), uStarCut: 0.9985, uCrackA: V(0.85, 0.95, 0.5), uCrackB: V(0.5, 1.0, 0.8), uContinents: 0.35 },
  astral: { uHorizon: V(0.07, 0.11, 0.34), uRose: V(0.035, 0.055, 0.2), uViolet: V(0.012, 0.022, 0.085), uZenith: V(0.003, 0.005, 0.018), uBelow: V(0.02, 0.03, 0.09), uSunCol: V(0.62, 0.74, 1.0), uNebA: V(0.25, 0.35, 0.85), uNebB: V(0.4, 0.8, 1.0), uStarCut: 0.985, uCrackA: V(0.45, 0.7, 1.0), uCrackB: V(0.75, 0.9, 1.0), uContinents: 0.6 },
};

export function CelestialSky({ sunDir, detail = 5, palette = "dusk" }: { sunDir: THREE.Vector3; detail?: number; palette?: SkyPalette }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: { uSun: { value: sunDir.clone() }, uTime: { value: 0 }, uOctaves: { value: detail }, ...Object.fromEntries(Object.entries(PALETTES[palette]).map(([k, v]) => [k, { value: v }])) },
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [sunDir, detail, palette],
  );
  useFrame(({ camera, clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
    mesh.current?.position.copy(camera.position);
  });
  return (
    <mesh ref={mesh} material={mat} renderOrder={-1000} frustumCulled={false} userData={{ noBatch: true }}>
      <sphereGeometry args={[500, 48, 24]} />
    </mesh>
  );
}
