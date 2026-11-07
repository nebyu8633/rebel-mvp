/**
 * Way-finding to the Sleeping Gate (presentation only, reads the world state):
 *   - a column of light above the gate, visible from anywhere on the plateau (and over the
 *     observatory walls) from the moment the quest begins until the gate wakes; dimmer once found
 *   - a trail of glowing stones from the observatory door around the west wall to the gate, with
 *     a pulse running toward the gate so the direction reads at a glance; it fades once found
 * Normal blending on purpose: additive light disappears against the bright sky.
 */
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useAetheria } from "../../store";
import { E } from "../../content/echoAwakening";
import { G } from "../../content/sleepingGate";
import { FLOOR_Y, GATE, around } from "./layout";

const BEAM_H = 70;
const SPACING = 1.25;

export function GateGuide() {
  const active = useAetheria((s) => s.world.flags.includes(E.bondChosen) && !s.world.flags.includes(G.awake));
  const found = useAetheria((s) => s.world.flags.includes(G.found));

  const beamTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const g = c.getContext("2d")!;
    const grd = g.createLinearGradient(0, 256, 0, 0);
    grd.addColorStop(0, "rgba(255,226,150,.95)");
    grd.addColorStop(0.25, "rgba(255,214,130,.55)");
    grd.addColorStop(1, "rgba(255,214,130,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const beamMat = useMemo(() => new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }), [beamTex]);
  const coreMat = useMemo(() => new THREE.MeshBasicMaterial({ map: beamTex, color: 0xfff4d6, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }), [beamTex]);

  // trail: from just outside the observatory door, around the west wall, to the foot of the dais
  const stones = useMemo(() => {
    const door = around(180, 9.2);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(door.x, 0, door.z),
      new THREE.Vector3(-4.5, 0, 5.8),
      new THREE.Vector3(-10.5, 0, 4.2),
      new THREE.Vector3(-14.8, 0, -1.5),
      new THREE.Vector3(-16.8, 0, -6.4),
      new THREE.Vector3(GATE.x + GATE.half + GATE.steps * GATE.stepRun + 1.4, 0, GATE.z),
    ]);
    const n = Math.floor(curve.getLength() / SPACING);
    // a few stones inside the observatory, from the astrolabe to the door, start the way
    const inside = [3.8, 5.0, 6.2, 7.4].map((r) => {
      const p = around(180, r);
      return new THREE.Vector3(p.x, FLOOR_Y, p.z);
    });
    return [...inside, ...Array.from({ length: n + 1 }, (_, i) => curve.getPointAt(i / n))];
  }, []);
  const trailRef = useRef<THREE.InstancedMesh>(null);
  const trailGeo = useMemo(() => new THREE.CylinderGeometry(0.16, 0.2, 0.08, 8), []);
  const trailMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: false }), []);
  const base = useMemo(() => new THREE.Color(0x7a6a48), []);
  const lit = useMemo(() => new THREE.Color(0xffe2a0), []);

  const vis = useRef({ beam: 0, trail: 0, ready: false });
  const beamRef = useRef<THREE.Group>(null);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), c: new THREE.Color() }), []);
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const v = vis.current;
    const beamTarget = active ? (found ? 0.45 : 1) : 0;
    const trailTarget = active && !found ? 1 : 0;
    v.beam += Math.sign(beamTarget - v.beam) * Math.min(Math.abs(beamTarget - v.beam), dt / 1.5);
    v.trail += Math.sign(trailTarget - v.trail) * Math.min(Math.abs(trailTarget - v.trail), dt / 1.5);
    const t = clock.elapsedTime;
    const pulse = 0.85 + Math.sin(t * 1.6) * 0.15;
    beamMat.opacity = v.beam * 0.55 * pulse;
    coreMat.opacity = v.beam * 0.8 * pulse;
    if (beamRef.current) {
      beamRef.current.visible = v.beam > 0.005;
      beamRef.current.rotation.y = t * 0.2;
    }
    const tm = trailRef.current;
    if (!tm) return;
    tm.visible = v.trail > 0.005;
    trailMat.opacity = v.trail;
    if (!tm.visible) return;
    if (!v.ready) {
      stones.forEach((p, i) => {
        tmp.m.makeTranslation(p.x, p.y + 0.05, p.z);
        tm.setMatrixAt(i, tmp.m);
      });
      tm.instanceMatrix.needsUpdate = true;
      v.ready = true;
    }
    // a bright wave travels along the trail toward the gate (direction at a glance)
    for (let i = 0; i < stones.length; i++) {
      const w = Math.pow(Math.max(0, Math.sin(i * 0.45 - t * 3.2)), 6);
      tm.setColorAt(i, tmp.c.copy(base).lerp(lit, 0.35 + 0.65 * w));
    }
    if (tm.instanceColor) tm.instanceColor.needsUpdate = true;
  });

  return (
    <group userData={{ noBatch: true }}>
      <group ref={beamRef} position={[GATE.x, GATE.h, GATE.z]} visible={false}>
        <mesh material={beamMat} position={[0, BEAM_H / 2, 0]} frustumCulled={false}>
          <cylinderGeometry args={[1.3, 0.9, BEAM_H, 16, 1, true]} />
        </mesh>
        <mesh material={coreMat} position={[0, BEAM_H / 2, 0]} frustumCulled={false}>
          <cylinderGeometry args={[0.35, 0.3, BEAM_H, 10, 1, true]} />
        </mesh>
      </group>
      <instancedMesh ref={trailRef} args={[trailGeo, trailMat, stones.length]} visible={false} frustumCulled={false} />
    </group>
  );
}
