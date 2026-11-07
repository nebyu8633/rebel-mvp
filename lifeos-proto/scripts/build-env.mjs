// Optimizes the CC0 Lantern (Khronos) for mobile: 512px KTX2 textures, meshopt, unit scale report.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, quantize, meshopt, textureCompress, getBounds, weld, simplify } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { ktx2 } from "ktx2-encoder/gltf-transform";
import sharp from "sharp";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.readBinary(new Uint8Array(readFileSync(join(ROOT, "assets-src", "env", "Lantern.glb"))));
const b = getBounds(doc.getRoot().listScenes()[0]);
const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};
await doc.transform(
  dedup(),
  prune(),
  // 16 lamps on screen: ~6.2k tris each is too much for mobile; keep ~25% (silhouette preserved)
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.25, error: 0.004 }),
  textureCompress({ encoder: sharp, targetFormat: "png", resize: [512, 512] }),
  ktx2({ isUASTC: true, generateMipmap: true, imageDecoder, slots: /normalTexture/ }),
  ktx2({ isUASTC: false, qualityLevel: 160, generateMipmap: true, imageDecoder, slots: /^(?!normalTexture).*/ }),
  quantize(),
  meshopt({ encoder: MeshoptEncoder }),
);
mkdirSync(join(ROOT, "public", "assets", "env"), { recursive: true });
const out = await io.writeBinary(doc);
writeFileSync(join(ROOT, "public", "assets", "env", "lantern.glb"), out);
let tris = 0;
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? 0) / 3;
console.log("lantern bounds", b.min, b.max, "bytes", out.byteLength, "tris", tris);
