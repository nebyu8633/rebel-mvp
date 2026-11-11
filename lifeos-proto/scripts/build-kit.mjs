// Optimizes the Blender-built First Sanctuary kit for mobile: weld, quantize, meshopt.
// Usage: node scripts/build-kit.mjs <in.glb>   (build the GLB first: scripts/blender/build_sanctuary_kit.py)
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, quantize, meshopt, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { statSync } from "node:fs";

await MeshoptEncoder.ready;
const src = process.argv[2];
const out = new URL("../public/assets/env/sanctuary_kit.glb", import.meta.url).pathname;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(src);
// meshopt() quantizes positions and moves a dequantization transform onto each node; the game bakes
// that node transform back into float geometry on load (useSanctuaryKit)
await doc.transform(dedup(), prune(), weld(), quantize(), meshopt({ encoder: MeshoptEncoder }));
await io.write(out, doc);
for (const m of doc.getRoot().listMeshes()) {
  const p = m.listPrimitives()[0];
  console.log(m.getName(), "tris", (p.getIndices()?.getCount() ?? 0) / 3);
}
console.log("wrote", out, (statSync(out).size / 1024).toFixed(0), "KB");
