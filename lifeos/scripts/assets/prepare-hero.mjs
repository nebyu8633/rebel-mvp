#!/usr/bin/env node
/**
 * Hero asset pipeline: merges per-clip GLBs (one animation each, same skeleton — the way AI
 * rigging services deliver them) into ONE optimized GLB for the game, and reports its budget.
 *
 *   node scripts/assets/prepare-hero.mjs --hero aegis \
 *     --clip idle=in/idle.glb --clip run=in/run.glb --clip attack=in/attack.glb \
 *     [--max-tris 10000] [--texture-size 1024] [--out public/models/heroes]
 *
 * Steps: copy every clip onto the first file's skeleton (matched by bone NAME) → dedup/prune/weld
 * → simplify above the triangle budget → resample keyframes → resize/convert textures (WebP, if
 * `sharp` is installed) → quantize → meshopt compression. Writes <hero>.glb + <hero>.report.json.
 * Fails loudly when a clip's bones don't match (a mismatched clip would animate nothing).
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld, resample, simplify, quantize, meshopt, textureCompress } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const hero = opt("hero");
const outDir = opt("out", "public/models/heroes");
const maxTris = Number(opt("max-tris", 10000));
const texSize = Number(opt("texture-size", 1024));
const clips = args.flatMap((a, i) => (a === "--clip" ? [args[i + 1]] : [])).map((s) => {
  const [name, file] = s.split("=");
  return { name, file };
});
if (!hero || !clips.length) {
  console.error("usage: --hero <id> --clip name=file.glb [--clip ...]");
  process.exit(2);
}

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

const base = await io.read(clips[0].file);
const root = base.getRoot();
const byName = new Map(root.listNodes().map((n) => [n.getName(), n]));
// the first file's own clip(s): keep one, named after --clip
const own = root.listAnimations();
own.slice(1).forEach((a) => a.dispose());
if (own[0]) own[0].setName(clips[0].name);
else console.warn(`warning: ${clips[0].file} has no animation`);

for (const c of clips.slice(1)) {
  const doc = await io.read(c.file);
  const anims = doc.getRoot().listAnimations();
  if (!anims.length) throw new Error(`${c.file} has no animation`);
  const src = anims[0];
  const dst = base.createAnimation(c.name);
  const buf = root.listBuffers()[0];
  let mapped = 0;
  let missing = [];
  for (const ch of src.listChannels()) {
    const target = byName.get(ch.getTargetNode()?.getName() ?? "");
    if (!target) {
      missing.push(ch.getTargetNode()?.getName());
      continue;
    }
    const s = ch.getSampler();
    const input = base.createAccessor().setType(s.getInput().getType()).setArray(s.getInput().getArray().slice()).setBuffer(buf);
    const output = base.createAccessor().setType(s.getOutput().getType()).setArray(s.getOutput().getArray().slice()).setBuffer(buf).setNormalized(s.getOutput().getNormalized());
    const ns = base.createAnimationSampler().setInput(input).setOutput(output).setInterpolation(s.getInterpolation());
    dst.addSampler(ns).addChannel(base.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(ns));
    mapped++;
  }
  if (!mapped) throw new Error(`${c.file}: no channel matched the base skeleton — bone names differ`);
  if (missing.length) console.warn(`warning: ${c.file}: ${missing.length} channels target bones missing in the base (${[...new Set(missing)].slice(0, 5).join(", ")})`);
}

const tris = (d) => d.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((x, p) => x + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute("POSITION").getCount()) / 3, 0), 0);
const before = tris(base);
const steps = [dedup(), prune({ keepAttributes: false }), weld()];
if (before > maxTris) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: Math.max(0.05, maxTris / before), error: 0.002 }));
steps.push(resample());
let textures = "none";
if (root.listTextures().length) {
  try {
    const sharp = (await import("sharp")).default;
    steps.push(textureCompress({ encoder: sharp, targetFormat: "webp", resize: [texSize, texSize] }));
    textures = `webp ≤${texSize}px`;
  } catch {
    textures = "kept as-is (install `sharp` to resize/convert)";
  }
}
steps.push(quantize(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
await base.transform(...steps);

mkdirSync(outDir, { recursive: true });
const file = join(outDir, `${hero}.glb`);
await io.write(file, base);
const report = {
  hero,
  file,
  bytes: statSync(file).size,
  triangles: { before: Math.round(before), after: Math.round(tris(base)), budget: maxTris },
  bones: base.getRoot().listSkins().reduce((s, k) => s + k.listJoints().length, 0),
  clips: base.getRoot().listAnimations().map((a) => ({ name: a.getName(), seconds: Math.max(...a.listSamplers().map((s) => s.getInput().getMax([0])[0])) })),
  textures,
};
writeFileSync(join(outDir, `${hero}.report.json`), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
