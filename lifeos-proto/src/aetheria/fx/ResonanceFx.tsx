/**
 * Resonance FX: short particle bursts, one look per force.
 *   FORM        gold motes converge from a wide sphere and settle (matter assembling)
 *   CHANGE      violet motes spiral up around the target (a transformation)
 *   CONNECTION  teal motes stream from the player's hands to the target (a thread being drawn)
 *   rejected    a dim puff that drops and fades quickly (the force dissipates)
 * Presentation only: driven by `casts`, never touches the world state.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { casts, FORCE_FX, type Cast } from "./casts";

const N = 110;
const MAX = 5;

interface Burst {
  cast: Cast;
  t: number;
  life: number;
  seeds: Float32Array;
  points: THREE.Points;
}

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export function ResonanceFx() {
  const group = useRef<THREE.Group>(null);
  const bursts = useRef<Burst[]>([]);
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.35, "rgba(255,255,255,.6)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }, []);

  useEffect(
    () =>
      casts.on((cast) => {
        const g = group.current;
        if (!g) return;
        while (bursts.current.length >= MAX) {
          const old = bursts.current.shift()!;
          g.remove(old.points);
          old.points.geometry.dispose();
          (old.points.material as THREE.Material).dispose();
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
        const color = new THREE.Color(FORCE_FX[cast.force].color);
        if (!cast.ok) color.multiplyScalar(0.45);
        const mat = new THREE.PointsMaterial({ color, map: tex, size: cast.ok ? 0.22 : 0.16, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
        const points = new THREE.Points(geo, mat);
        points.frustumCulled = false;
        g.add(points);
        const seeds = new Float32Array(N * 4);
        for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
        bursts.current.push({ cast, t: 0, life: cast.ok ? 2.0 : 0.9, seeds, points });
      }),
    [tex],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const g = group.current;
    if (!g) return;
    for (const b of [...bursts.current]) {
      b.t += dt;
      const { at, from, force } = b.cast;
      const pos = b.points.geometry.attributes.position as THREE.BufferAttribute;
      const t = b.t;
      for (let i = 0; i < N; i++) {
        const u = b.seeds[i * 4];
        const v = b.seeds[i * 4 + 1];
        const w = b.seeds[i * 4 + 2];
        const k = b.seeds[i * 4 + 3];
        let x = at.x;
        let y = at.y;
        let z = at.z;
        if (!b.cast.ok) {
          const a = u * Math.PI * 2;
          const r = 0.2 + t * (0.6 + v);
          x += Math.cos(a) * r;
          z += Math.sin(a) * r;
          y += (w - 0.3) * 0.8 - t * t * 1.6;
        } else if (force === "form") {
          // from a wide shell to a compact block
          const th = u * Math.PI * 2;
          const ph = Math.acos(2 * v - 1);
          const R = 2.6;
          const p = ease(t / (0.7 + k * 0.6));
          const sx = Math.sin(ph) * Math.cos(th) * R;
          const sy = Math.cos(ph) * R * 0.7 + 0.8;
          const sz = Math.sin(ph) * Math.sin(th) * R;
          const ex = (w - 0.5) * 0.9;
          const ey = (k - 0.5) * 0.5;
          const ez = (u - 0.5) * 0.9;
          x += sx + (ex - sx) * p;
          y += sy + (ey - sy) * p;
          z += sz + (ez - sz) * p;
        } else if (force === "change") {
          const a = u * Math.PI * 2 + t * (4 + v * 3);
          const r = 0.25 + (1 - ease(t / 1.6)) * (0.9 + w * 0.8);
          x += Math.cos(a) * r;
          z += Math.sin(a) * r;
          y += -0.6 + ((t * (1.2 + k) + v * 0.8) % 3.2);
        } else {
          const p = ease((t - u * 0.7) / 0.8);
          const wob = Math.sin(p * Math.PI) * 0.35;
          x = from.x + (at.x - from.x) * p + Math.cos(v * 6.28 + t * 5) * wob;
          y = from.y + (at.y - from.y) * p + Math.sin(p * Math.PI) * (0.6 + w * 0.6);
          z = from.z + (at.z - from.z) * p + Math.sin(v * 6.28 + t * 5) * wob;
        }
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
      const fade = b.cast.ok ? 1 - Math.max(0, (t - b.life + 0.6) / 0.6) : 1 - t / b.life;
      (b.points.material as THREE.PointsMaterial).opacity = Math.max(0, fade);
      if (t >= b.life) {
        g.remove(b.points);
        b.points.geometry.dispose();
        (b.points.material as THREE.Material).dispose();
        bursts.current.splice(bursts.current.indexOf(b), 1);
      }
    }
  });

  return <group ref={group} userData={{ noBatch: true }} />;
}
