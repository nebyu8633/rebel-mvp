/**
 * Life in the First Sanctuary (V5): sound wired to the world, dust in the air, a moving sea of
 * clouds. Presentation only — reads state and events, never changes the world.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { telemetry } from "../../../player/Player";
import { gameEvents } from "../../../engine/events";
import { casts } from "../../fx/casts";
import { useAetheria } from "../../store";
import { useDialogue } from "../../ui/dialogueRunner";
import { setAmbience, sfx, silenceAmbience, unlock } from "../../audio/soundscape";
import { GALLERY, OBS } from "./layout";
import { smooth } from "./shared";

export function SoundController() {
  useEffect(() => {
    const go = () => unlock();
    window.addEventListener("pointerdown", go);
    window.addEventListener("keydown", go);
    window.addEventListener("touchend", go);
    const offCast = casts.on((c) => sfx.cast(c.force, c.ok));
    const offEvt = gameEvents.on((e) => e === "resonance" && sfx.resonance());
    // learning a force, and the Echo starting to speak
    let powers = useAetheria.getState().world.powers?.length ?? 0;
    const offStore = useAetheria.subscribe((s) => {
      const n = s.world.powers?.length ?? 0;
      if (n > powers) sfx.learn();
      powers = n;
    });
    let talking = !!useDialogue.getState().defId;
    const offDlg = useDialogue.subscribe((s) => {
      if (s.defId && !talking) sfx.echo();
      talking = !!s.defId;
    });
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
      window.removeEventListener("touchend", go);
      offCast();
      offEvt();
      offStore();
      offDlg();
      silenceAmbience();
    };
  }, []);
  const acc = useRef(0);
  useFrame(({ clock }, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const d = Math.hypot(telemetry.x - OBS.x, telemetry.z - OBS.z);
    const onGallery = telemetry.y > GALLERY.y - 0.6 && d < OBS.wallR;
    const indoor = Math.max(1 - smooth(OBS.floorR - 1.5, OBS.wallR + 2, d), onGallery ? 0.8 : 0);
    setAmbience(indoor, clock.elapsedTime);
  });
  return null;
}

/** Dust and pollen drifting in the air around the player, catching the dusk light. */
export function DustMotes({ count = 260 }: { count?: number }) {
  const R = 14;
  const { geo, mat, seeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos.set([(Math.random() - 0.5) * 2 * R, Math.random() * 6, (Math.random() - 0.5) * 2 * R], i * 3);
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    const mat = new THREE.PointsMaterial({ color: 0xffe0b0, map: new THREE.CanvasTexture(c), size: 0.07, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
    return { geo, mat, seeds };
  }, [count]);
  const ref = useRef<THREE.Points>(null);
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const t = clock.elapsedTime;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    // the field travels with the player; motes that fall out of range wrap around
    const cx = telemetry.x;
    const cz = telemetry.z;
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      let x = pos.getX(i) + Math.sin(t * 0.3 + s * 20) * 0.08 * dt + 0.12 * dt;
      let y = pos.getY(i) + (Math.sin(t * 0.5 + s * 9) * 0.05 + 0.02) * dt;
      let z = pos.getZ(i) + Math.cos(t * 0.27 + s * 13) * 0.08 * dt;
      if (x - cx > R) x -= 2 * R;
      if (x - cx < -R) x += 2 * R;
      if (z - cz > R) z -= 2 * R;
      if (z - cz < -R) z += 2 * R;
      if (y > telemetry.y + 6) y -= 6;
      if (y < telemetry.y) y += 6;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
    mat.opacity = 0.45 + 0.1 * Math.sin(t * 0.7);
  });
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} userData={{ noBatch: true }} />;
}

const cloudVert = /* glsl */ `
varying vec3 vWorld;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const cloudFrag = /* glsl */ `
uniform float uTime; uniform vec3 uFog; uniform vec3 uSun; uniform vec3 uCam;
varying vec3 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.07; a *= 0.5; } return s; }
void main() {
  vec2 p = vWorld.xz * 0.012;
  float n = fbm(p + vec2(uTime * 0.006, uTime * 0.003));
  float n2 = fbm(p * 2.3 - vec2(uTime * 0.01, 0.0));
  float billow = smoothstep(0.35, 0.8, n * 0.7 + n2 * 0.4);
  vec3 shade = mix(vec3(0.36, 0.28, 0.42), vec3(0.86, 0.72, 0.78), billow);
  // tops lit warm toward the low sun
  vec3 toSun = normalize(vec3(uSun.x, 0.0, uSun.z));
  vec3 toFrag = normalize(vec3(vWorld.x - uCam.x, 0.0, vWorld.z - uCam.z));
  shade += vec3(0.55, 0.32, 0.12) * billow * pow(max(dot(toSun, toFrag), 0.0), 3.0) * 0.6;
  float dist = length(vWorld.xz - uCam.xz);
  vec3 col = mix(shade, uFog, smoothstep(60.0, 420.0, dist));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** The sea of clouds below the island: slowly flowing billows lit by the low sun. */
export function CloudSea() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: cloudVert,
        fragmentShader: cloudFrag,
        uniforms: { uTime: { value: 0 }, uFog: { value: new THREE.Color(0x7e6a8c) }, uSun: { value: new THREE.Vector3(-0.84, 0.26, -0.2) }, uCam: { value: new THREE.Vector3() } },
      }),
    [],
  );
  useFrame(({ clock, camera, scene }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uCam.value.copy(camera.position);
    const fog = scene.fog as THREE.Fog | null;
    if (fog) (mat.uniforms.uFog.value as THREE.Color).copy(fog.color);
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -26, 0]} material={mat} userData={{ noBatch: true }}>
      <circleGeometry args={[600, 64]} />
    </mesh>
  );
}
