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

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  // dusk gradient
  vec3 horizon = vec3(0.92, 0.58, 0.34);
  vec3 rose = vec3(0.50, 0.30, 0.42);
  vec3 violet = vec3(0.16, 0.11, 0.30);
  vec3 zenith = vec3(0.02, 0.018, 0.05);
  // the warm horizon glow is strongest toward the sun
  float toSun = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0);
  vec3 col = mix(mix(rose, horizon, 0.35 + 0.65 * toSun), rose, smoothstep(-0.02, 0.07 + 0.08 * toSun, h));
  col = mix(col, violet, smoothstep(0.04, 0.2, h));
  col = mix(col, zenith, smoothstep(0.2, 0.7, h));
  col = mix(col, vec3(0.42, 0.33, 0.45), smoothstep(0.0, -0.25, h)); // below the horizon: dusky cloud sea

  // sun + halo
  float s = max(dot(d, normalize(uSun)), 0.0);
  col += vec3(1.0, 0.62, 0.32) * (pow(s, 6.0) * 0.35 + pow(s, 64.0) * 0.6) + vec3(1.0, 0.9, 0.75) * smoothstep(0.9993, 0.9998, s) * 4.0;

  // nebula band (tilted), drifting slowly
  vec3 axis = normalize(vec3(0.25, 0.92, 0.30));
  float band = exp(-pow(dot(d, axis) / 0.32, 2.0));
  float neb = fbm(d * 3.2 + vec3(uTime * 0.004, 0.0, 0.0));
  float neb2 = fbm(d * 6.5 - 3.1);
  vec3 nebCol = mix(vec3(0.42, 0.25, 0.70), vec3(0.20, 0.62, 0.66), smoothstep(0.35, 0.75, neb2));
  col += nebCol * band * smoothstep(0.38, 0.85, neb) * 0.6 * smoothstep(0.03, 0.22, h);

  // stars
  vec3 sp = d * 260.0;
  vec3 ip = floor(sp);
  float r = hash(ip);
  float star = step(0.993, r) * smoothstep(0.42, 0.0, length(fract(sp) - 0.5));
  star *= 0.6 + 0.4 * sin(uTime * (1.5 + r * 4.0) + r * 40.0);
  col += vec3(1.0, 0.95, 0.88) * star * smoothstep(0.05, 0.3, h) * 1.4;

  // the First Fracture: cracks of light low across the sky (where the player looks)
  float az = atan(d.x, -d.z);
  float el = asin(clamp(h, -1.0, 1.0));
  vec3 gold = vec3(1.0, 0.68, 0.30);
  vec3 teal = vec3(0.25, 0.95, 0.85);
  col += crack(az, el, -0.75, 0.55, 0.30, 0.12, 0.0035, gold, 1.0);   // north, behind the observatory
  col += crack(az, el, -0.25, 0.30, 0.20, 0.36, 0.0022, teal, 2.0);   // north, crossing it
  col += crack(az, el, -1.95, -1.15, 0.10, 0.26, 0.0026, gold, 3.0);  // west, above the Sleeping Gate
  col += crack(az, el, 1.10, 1.90, 0.28, 0.14, 0.0020, teal, 4.0);    // east
  col += crack(az, el, 2.40, 3.10, 0.16, 0.30, 0.0024, gold, 5.0);    // south, over the approach

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function CelestialSky({ sunDir, detail = 5 }: { sunDir: THREE.Vector3; detail?: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: { uSun: { value: sunDir.clone() }, uTime: { value: 0 }, uOctaves: { value: detail } },
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [sunDir, detail],
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
