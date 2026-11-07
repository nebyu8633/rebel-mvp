/**
 * Procedural item meshes for the starter catalog (rigid, attach to bones). A recipe returns the
 * object plus its placement in character space. GLB items will use the same placement contract.
 */
import * as THREE from "three";
import type { Placement } from "./attach";

export interface RecipeContext {
  /** identity accent (from the LifeOS profile) */
  accent: string;
  /** visual progression tier 0..3 */
  tier: number;
  /** mirrored instance (left side) */
  mirrored: boolean;
}
export interface Built {
  object: THREE.Object3D;
  placement: Placement;
}

const wood = () => new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 0.75 });
const bronze = () => new THREE.MeshStandardMaterial({ color: 0xa5814f, metalness: 1, roughness: 0.32 });
const gem = (accent: string, tier: number) => new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.6 + tier * 0.8, roughness: 0.15, metalness: 0.1, toneMapped: true });

function staff(c: RecipeContext): Built {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 1.75, 10), wood());
  shaft.position.y = 0.12; // grip ~40% up the shaft
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 20), bronze());
  collar.position.y = 0.95;
  collar.rotation.x = Math.PI / 2;
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), gem(c.accent, c.tier));
  crystal.position.y = 1.07;
  crystal.scale.y = 1.6;
  g.add(shaft, collar, crystal);
  for (const m of [shaft, collar, crystal]) m.castShadow = true;
  return { object: g, placement: { offset: [0, 0, 0.035], rotation: [0.08, 0, 0] } };
}

function pendant(c: RecipeContext): Built {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 24), bronze());
  const stone = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), gem(c.accent, c.tier));
  g.add(ring, stone);
  return { object: g, placement: { offset: [0, -0.02, 0.13] } };
}

function pauldron(c: RecipeContext): Built {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.2), bronze());
  shell.scale.set(0.95, 0.62, 1.05);
  shell.castShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.008, 6, 28), gem(c.accent, Math.max(0, c.tier - 1)));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.005;
  g.add(shell, rim);
  const side = c.mirrored ? 1 : -1; // right side of the character is -X
  return { object: g, placement: { offset: [side * 0.03, 0.045, -0.005], rotation: [0, 0, -side * 0.35] } };
}

function lantern(c: RecipeContext): Built {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 16, Math.PI), bronze());
  handle.position.y = -0.02;
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 6, 1, true), bronze());
  cage.position.y = -0.12;
  (cage.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  (cage.material as THREE.MeshStandardMaterial).wireframe = true;
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), gem(c.accent, c.tier + 1));
  flame.position.y = -0.12;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.015, 6), bronze());
  base.position.y = -0.185;
  g.add(handle, cage, flame, base);
  return { object: g, placement: { offset: [0, -0.03, 0.02] } };
}

export const RECIPES: Record<string, (c: RecipeContext) => Built> = { staff, pendant, pauldron, lantern };

export function disposeObject(o: THREE.Object3D) {
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      for (const mat of [m.material].flat()) mat.dispose();
    }
  });
}
