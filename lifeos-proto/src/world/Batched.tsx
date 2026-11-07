/**
 * Static batching: after mount, merges every static mesh below this group into ONE mesh per
 * material (world transforms baked) and hides the originals. Cuts draw calls (main + shadow pass)
 * from ~1 per prop to ~1 per material — the biggest single win for mobile GPUs.
 * Subtrees flagged `userData.noBatch` (doors, dynamic bodies, windows that change material) and
 * instanced / skinned meshes are left alone.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const batchStats = { sourceMeshes: 0, mergedMeshes: 0 };

export function Batched({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const [merged, setMerged] = useState<THREE.Mesh[]>([]);
  useLayoutEffect(() => {
    const root = ref.current!;
    root.updateWorldMatrix(true, true);
    const inv = root.matrixWorld.clone().invert();
    const groups = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean }>();
    const hidden: THREE.Mesh[] = [];
    const walk = (o: THREE.Object3D) => {
      if (o.userData.noBatch) return;
      const m = o as THREE.Mesh;
      if (m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh && !Array.isArray(m.material) && m.visible) {
        const g = m.geometry.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld));
        for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
        if (g.attributes.uv && g.attributes.normal) {
          const e = groups.get(m.material) ?? { geos: [], cast: false, receive: false };
          e.geos.push(g);
          e.cast ||= m.castShadow;
          e.receive ||= m.receiveShadow;
          groups.set(m.material, e);
          hidden.push(m);
        }
      }
      for (const c of o.children) walk(c);
    };
    walk(root);
    const out: THREE.Mesh[] = [];
    for (const [mat, e] of groups) {
      const allIndexed = e.geos.every((g) => g.index);
      const geo = mergeGeometries(allIndexed ? e.geos : e.geos.map((g) => (g.index ? g.toNonIndexed() : g)), false);
      if (!geo) continue;
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = e.cast;
      mesh.receiveShadow = e.receive;
      mesh.name = `batch:${mat.name || mat.type}`;
      out.push(mesh);
    }
    for (const m of hidden) m.visible = false;
    batchStats.sourceMeshes += hidden.length;
    batchStats.mergedMeshes += out.length;
    setMerged(out);
    return () => {
      for (const m of hidden) m.visible = true;
      for (const m of out) m.geometry.dispose();
      batchStats.sourceMeshes -= hidden.length;
      batchStats.mergedMeshes -= out.length;
    };
  }, []);
  return (
    <>
      <group ref={ref}>{children}</group>
      {merged.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </>
  );
}
