import { readFileSync } from "node:fs";
import { THREE } from "./lib/node-three.mjs";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
for (const f of process.argv.slice(2)) {
  const buf = readFileSync(f);
  const g = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "");
  const c = g.animations[0];
  const pos = c.tracks.find((t) => t.name === "Bip01.position");
  const v = pos.values, n = v.length / 3;
  const q = c.tracks.find((t) => t.name === "Bip01.quaternion");
  const e0 = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(q.values, 0), "YXZ");
  const e1 = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(q.values, q.values.length - 4), "YXZ");
  console.log(f.split("/").pop(), "dur", c.duration.toFixed(2), "keys", n, "start", [v[0], v[1], v[2]].map((x) => x.toFixed(1)), "end", [v[3 * n - 3], v[3 * n - 2], v[3 * n - 1]].map((x) => x.toFixed(1)), "yaw0", (e0.y * 57.3).toFixed(0), "yaw1", (e1.y * 57.3).toFixed(0));
}
