/**
 * A walkable path of light between two (or more) points: a glowing ribbon you see, and level slabs
 * you walk on (yaw + pitch only, no roll, a little wider than the ribbon — forgiving on a phone).
 * Keep paths straight in plan and under ~35° so they can be walked by holding forward.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";

export type P3 = [number, number, number];

export function pathSlabs(points: P3[], segments: number, width: number) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const out: { pos: P3; rot: P3; len: number; half: number }[] = [];
  for (let i = 0; i < segments; i++) {
    const a = curve.getPointAt(i / segments);
    const b = curve.getPointAt((i + 1) / segments);
    const dir = b.clone().sub(a);
    const len = dir.length();
    dir.normalize();
    const yaw = Math.atan2(-dir.z, dir.x);
    const pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pitch));
    const e = new THREE.Euler().setFromQuaternion(q);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const mid = a.clone().add(b).multiplyScalar(0.5).addScaledVector(up, -0.1);
    out.push({ pos: mid.toArray() as P3, rot: [e.x, e.y, e.z], len: len + 0.15, half: width / 2 });
  }
  return { curve, slabs: out };
}

export function LightPath({ points, width = 2.2, color = "#9fc2ff", segments = 16 }: { points: P3[]; width?: number; color?: string; segments?: number }) {
  const { slabs, ribbon } = useMemo(() => {
    const { curve, slabs } = pathSlabs(points, segments, width + 0.3);
    const N = segments * 4;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const c = curve.getPointAt(u);
      const side = new THREE.Vector3().crossVectors(curve.getTangentAt(u), up).normalize().multiplyScalar(width / 2);
      pos.push(c.x - side.x, c.y + 0.02, c.z - side.z, c.x + side.x, c.y + 0.02, c.z + side.z);
      uv.push(u, 0, u, 1);
      if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return { slabs, ribbon: g };
  }, [points, segments, width]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
          void main(){
            float edge = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
            float rim = smoothstep(0.08, 0.0, vUv.y) + smoothstep(0.92, 1.0, vUv.y);
            float flow = 0.6 + 0.4 * pow(0.5 + 0.5 * sin(vUv.x * 60.0 - uTime * 2.5), 3.0);
            vec3 col = uColor * (0.35 * edge * flow + rim * 1.2);
            gl_FragColor = vec4(col, 0.55 * edge + rim * 0.8);
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [color],
  );
  useFrame(({ clock }) => void (mat.uniforms.uTime.value = clock.elapsedTime));
  return (
    <group userData={{ noBatch: true }}>
      <RigidBody type="fixed" colliders={false}>
        {slabs.map((s, i) => (
          <CuboidCollider key={i} args={[s.len / 2, 0.1, s.half]} position={s.pos} rotation={s.rot} />
        ))}
      </RigidBody>
      <mesh geometry={ribbon} material={mat} frustumCulled={false} />
    </group>
  );
}
