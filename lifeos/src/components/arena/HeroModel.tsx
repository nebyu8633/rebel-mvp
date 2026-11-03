"use client";
/** Procedural stylized hero: silhouette by role, palette + weapon by hero. Animated by the parent via refs. */
import { forwardRef, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import type { HeroDef } from "@/lib/arena/types";

export interface HeroRig {
  root: THREE.Group | null;
  legL: THREE.Group | null;
  legR: THREE.Group | null;
  armL: THREE.Group | null;
  armR: THREE.Group | null;
  body: THREE.Group | null;
  mats: THREE.MeshStandardMaterial[];
}

const Mat = ({ c, e, rig, metal = 0.1, rough = 0.6 }: { c: string; e?: string; rig: React.MutableRefObject<THREE.MeshStandardMaterial[]>; metal?: number; rough?: number }) => (
  <meshStandardMaterial
    ref={(m) => {
      if (m && !rig.current.includes(m)) rig.current.push(m);
    }}
    color={c}
    emissive={e ?? "#000000"}
    emissiveIntensity={e ? 0.9 : 0}
    metalness={metal}
    roughness={rough}
  />
);

function Weapon({ def, mats }: { def: HeroDef; mats: React.MutableRefObject<THREE.MeshStandardMaterial[]> }) {
  const { trim, glow } = def.look;
  switch (def.look.weapon) {
    case "shield":
      return (
        <group position={[0, 0.05, 0.38]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.55, 0.55, 0.12, 6]} />
            <Mat c={trim} rig={mats} metal={0.6} rough={0.35} />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.05, 12]} />
            <Mat c={glow} e={glow} rig={mats} />
          </mesh>
        </group>
      );
    case "hammer":
      return (
        <group position={[0, -0.1, 0.25]} rotation-x={0.6}>
          <mesh castShadow position={[0, -0.35, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 1, 6]} />
            <Mat c="#5a3b22" rig={mats} />
          </mesh>
          <mesh castShadow position={[0, -0.85, 0]}>
            <boxGeometry args={[0.45, 0.28, 0.28]} />
            <Mat c={trim} rig={mats} metal={0.7} rough={0.3} />
          </mesh>
        </group>
      );
    case "blade":
      return (
        <mesh castShadow position={[0, -0.45, 0.35]} rotation-x={1.1}>
          <boxGeometry args={[0.08, 0.9, 0.04]} />
          <Mat c={glow} e={glow} rig={mats} metal={0.8} />
        </mesh>
      );
    case "bow":
      return (
        <mesh castShadow position={[0, -0.25, 0.3]} rotation-y={Math.PI / 2}>
          <torusGeometry args={[0.45, 0.03, 6, 16, Math.PI]} />
          <Mat c={trim} rig={mats} />
        </mesh>
      );
    case "staff":
    case "tome":
    case "orb":
    case "fan":
    default:
      return (
        <group position={[0, -0.2, 0.25]}>
          {def.look.weapon === "staff" && (
            <mesh castShadow position={[0, -0.2, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 1.3, 6]} />
              <Mat c="#6b4a2f" rig={mats} />
            </mesh>
          )}
          {def.look.weapon === "tome" && (
            <mesh castShadow position={[0, -0.3, 0.1]}>
              <boxGeometry args={[0.35, 0.08, 0.28]} />
              <Mat c={trim} rig={mats} />
            </mesh>
          )}
          {def.look.weapon === "fan" && (
            <mesh castShadow position={[0, -0.4, 0.12]} rotation-x={-0.4}>
              <circleGeometry args={[0.38, 10, 0, Math.PI]} />
              <Mat c={trim} rig={mats} />
            </mesh>
          )}
          <mesh position={[0, def.look.weapon === "staff" ? 0.5 : -0.5, 0.15]}>
            <icosahedronGeometry args={[0.16, 1]} />
            <Mat c={glow} e={glow} rig={mats} />
          </mesh>
        </group>
      );
  }
}

export const HeroModel = forwardRef<HeroRig, { def: HeroDef; teamColor: string }>(function HeroModel({ def, teamColor }, ref) {
  const root = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  useImperativeHandle(ref, () => ({ root: root.current, legL: legL.current, legR: legR.current, armL: armL.current, armR: armR.current, body: body.current, mats: mats.current }));
  const tank = def.role === "tank";
  const w = tank ? 1.25 : def.role === "support" ? 0.95 : 0.9;
  const { body: bc, trim, glow } = def.look;
  return (
    <group ref={root} scale={w}>
      {/* team ring on the ground */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.62, 0.78, 32]} />
        <meshBasicMaterial color={teamColor} transparent opacity={0.85} />
      </mesh>
      <group ref={body}>
        {/* legs */}
        {[
          [legL, -0.17],
          [legR, 0.17],
        ].map(([r, x]) => (
          <group key={String(x)} ref={r as React.RefObject<THREE.Group>} position={[x as number, 0.62, 0]}>
            <mesh castShadow position={[0, -0.3, 0]}>
              <capsuleGeometry args={[0.1, 0.42, 4, 8]} />
              <Mat c="#2a2633" rig={mats} />
            </mesh>
          </group>
        ))}
        {/* torso */}
        <mesh castShadow position={[0, 1.05, 0]}>
          <capsuleGeometry args={[tank ? 0.33 : 0.27, 0.42, 4, 10]} />
          <Mat c={bc} rig={mats} rough={0.5} />
        </mesh>
        {/* belt / chest trim */}
        <mesh position={[0, 0.92, 0]}>
          <torusGeometry args={[tank ? 0.33 : 0.27, 0.045, 6, 16]} />
          <Mat c={trim} rig={mats} metal={0.6} rough={0.3} />
        </mesh>
        {/* shoulders */}
        {tank &&
          [-0.36, 0.36].map((x) => (
            <mesh key={x} castShadow position={[x, 1.32, 0]}>
              <sphereGeometry args={[0.17, 10, 8]} />
              <Mat c={trim} rig={mats} metal={0.6} rough={0.3} />
            </mesh>
          ))}
        {/* head */}
        <mesh castShadow position={[0, 1.62, 0]}>
          <sphereGeometry args={[0.2, 14, 12]} />
          <Mat c="#e9c8a8" rig={mats} />
        </mesh>
        {/* hood / helm */}
        <mesh castShadow position={[0, 1.7, -0.02]}>
          <sphereGeometry args={[0.225, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.9]} />
          <Mat c={def.role === "support" ? glow : trim} rig={mats} metal={tank ? 0.6 : 0.1} rough={0.4} />
        </mesh>
        {/* cape for supports & damage */}
        {!tank && (
          <mesh position={[0, 1.0, -0.26]} rotation-x={0.12}>
            <planeGeometry args={[0.55, 0.85]} />
            <meshStandardMaterial color={trim} side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
        )}
        {/* arms */}
        <group ref={armL} position={[-0.36 * (tank ? 1.05 : 1), 1.32, 0]}>
          <mesh castShadow position={[0, -0.25, 0]}>
            <capsuleGeometry args={[0.07, 0.36, 4, 8]} />
            <Mat c={bc} rig={mats} />
          </mesh>
          {def.look.weapon === "shield" && <Weapon def={def} mats={mats} />}
        </group>
        <group ref={armR} position={[0.36 * (tank ? 1.05 : 1), 1.32, 0]}>
          <mesh castShadow position={[0, -0.25, 0]}>
            <capsuleGeometry args={[0.07, 0.36, 4, 8]} />
            <Mat c={bc} rig={mats} />
          </mesh>
          {def.look.weapon !== "shield" && <Weapon def={def} mats={mats} />}
          {def.look.weapon === "shield" && (
            <mesh position={[0, -0.5, 0.2]} rotation-x={1.2}>
              <boxGeometry args={[0.06, 0.6, 0.04]} />
              <Mat c="#c9ccd2" rig={mats} metal={0.8} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
});
