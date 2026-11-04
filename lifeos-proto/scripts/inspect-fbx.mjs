import { readFileSync } from "node:fs";
import { THREE } from "./lib/node-three.mjs";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
for (const f of process.argv.slice(2)) {
  const buf = readFileSync(f);
  const g = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "");
  const meshes = [], bones = [];
  g.traverse((o) => { if (o.isMesh) meshes.push(`${o.name} skinned=${!!o.isSkinnedMesh} v=${o.geometry.attributes.position.count} mats=${[].concat(o.material).map((m) => m.name).join(",")} morphs=${Object.keys(o.morphTargetDictionary ?? {}).length}`); if (o.isBone) bones.push(o.name); });
  const box = new THREE.Box3().setFromObject(g);
  console.log(f, "\n meshes:", meshes, "\n bones:", bones.length, bones.slice(0, 8).join(","), "\n bbox:", box.min.toArray().map((n) => n.toFixed(1)), box.max.toArray().map((n) => n.toFixed(1)), "scale", g.scale.toArray());
  for (const c of g.animations) console.log(" clip", c.name, c.duration.toFixed(2), "tracks", c.tracks.length, c.tracks.slice(0, 3).map((t) => t.name));
  const m = g.getObjectByProperty("isMesh", true); if (m?.morphTargetDictionary) console.log(" morph names:", Object.keys(m.morphTargetDictionary).slice(0, 60).join(" "));
}
