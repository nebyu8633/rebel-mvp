/**
 * Asset build: Rocketbox FBX (MIT) -> optimized GLB for the prototype.
 *   node scripts/fetch-assets.mjs   (downloads sources into assets-src/)
 *   node scripts/build-assets.mjs   (writes public/assets/character/*.glb + report)
 *
 * Steps: FBX parse (three FBXLoader, Node shims) -> morph subset (ARKit names) -> PBR materials ->
 * clips filtered to the avatar skeleton, root motion extracted (XZ + yaw) into metadata ->
 * GLTFExporter -> gltf-transform (TGA->webp textures, specular->roughness, sparse morphs,
 * resample, quantize, meshopt).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { THREE } from "./lib/node-three.mjs";
import { decodeTGA } from "./lib/tga.mjs";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, resample, quantize, meshopt, sparse, weld } from "@gltf-transform/functions";
import { ktx2 } from "ktx2-encoder/gltf-transform";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "assets-src");
const OUT = join(ROOT, "public", "assets", "character");
const TEX_SIZE = Number(process.env.TEX_SIZE ?? 1024);

/** Facial morph subset kept for the runtime (Rocketbox name -> ARKit-style name). */
const MORPHS = {
  AK_09_EyeBlinkLeft: "eyeBlinkLeft",
  AK_10_EyeBlinkRight: "eyeBlinkRight",
  AK_44_MouthSmileLeft: "mouthSmileLeft",
  AK_45_MouthSmileRight: "mouthSmileRight",
  AK_25_JawOpen: "jawOpen",
  AK_03_BrowInnerUp: "browInnerUp",
  AK_01_BrowDownLeft: "browDownLeft",
  AK_02_BrowDownRight: "browDownRight",
  AK_21_EyeWideLeft: "eyeWideLeft",
  AK_22_EyeWideRight: "eyeWideRight",
  AK_32_MouthFunnel: "mouthFunnel",
  AK_38_MouthPucker: "mouthPucker",
  AK_30_MouthFrownLeft: "mouthFrownLeft",
  AK_31_MouthFrownRight: "mouthFrownRight",
  AA_VI_10_aa: "viseme_aa",
  AA_VI_13_O: "viseme_O",
  AA_VI_01_PP: "viseme_PP",
  AA_VI_02_FF: "viseme_FF",
};

/** Clips: role, source, kind. loop = in-place cycle (linear root progression removed, speed kept);
 *  oneshot = root XZ removed and stored as a curve the movement system may consume; yaw is extracted only
 *  for turn clips (`yaw: true`) — elsewhere the Bip01 yaw is body sway and stays in the pose. */
const CLIPS = [
  { name: "idle", file: "idle", kind: "loop" },
  { name: "walk", file: "walk", kind: "loop" },
  { name: "run", file: "run", kind: "loop" },
  { name: "walk_start", file: "walk_start", kind: "oneshot" },
  { name: "walk_stop", file: "walk_stop", kind: "oneshot" },
  { name: "run_start", file: "run_start", kind: "oneshot" },
  { name: "run_stop", file: "run_stop", kind: "oneshot" },
  { name: "turn_left_90", file: "turn_left_90", kind: "oneshot", yaw: true },
  { name: "turn_right_90", file: "turn_right_90", kind: "oneshot", yaw: true },
  { name: "interact", file: "interact", kind: "oneshot" },
  { name: "wave", file: "wave", kind: "oneshot" },
];

const CM = 0.01;
const loadFBX = (p) => {
  const b = readFileSync(p);
  return new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), "");
};
const r4 = (n) => Math.round(n * 1e4) / 1e4;

// ---------------------------------------------------------------- avatar
const avatar = loadFBX(join(SRC, "avatar", "Male_Adult_01_facial.fbx"));
avatar.animations = [];
avatar.name = "Character";
const boneNames = new Set();
let mesh;
avatar.traverse((o) => {
  if (o.isBone) boneNames.add(o.name);
  if (o.isSkinnedMesh) mesh = o;
});
mesh.name = "Body";
{
  const dict = mesh.morphTargetDictionary;
  const keep = [];
  for (const [full, idx] of Object.entries(dict)) {
    const short = full.split(".").pop();
    if (MORPHS[short]) keep.push({ idx, name: MORPHS[short] });
  }
  if (keep.length !== Object.keys(MORPHS).length) throw new Error(`morph subset incomplete: ${keep.length}/${Object.keys(MORPHS).length}`);
  const g = mesh.geometry;
  for (const attr of ["position", "normal"]) if (g.morphAttributes[attr]) g.morphAttributes[attr] = keep.map((k) => g.morphAttributes[attr][k.idx]);
  mesh.morphTargetDictionary = Object.fromEntries(keep.map((k, i) => [k.name, i]));
  mesh.morphTargetInfluences = keep.map(() => 0);
  g.userData.targetNames = keep.map((k) => k.name);
  mesh.userData.targetNames = keep.map((k) => k.name);
}
// FBX UVs assume flipY=true textures; glTF samples with flipY=false -> flip V once here.
{
  const uv = mesh.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  uv.needsUpdate = true;
}
mesh.material = [].concat(mesh.material).map((m) => {
  const s = new THREE.MeshStandardMaterial({ name: m.name, roughness: 0.6, metalness: 0 });
  if (m.name.includes("opacity")) {
    s.transparent = true;
    s.alphaTest = 0.4;
    s.side = THREE.DoubleSide;
  }
  return s;
});

// ---------------------------------------------------------------- clips + root motion
const meta = { units: "m", clips: {} };
const clips = [];
for (const c of CLIPS) {
  const path = join(SRC, "anim", `${c.file}.fbx`);
  const clip = loadFBX(path).animations[0];
  clip.name = c.name;
  // keep only bones the avatar has; drop scale tracks and non-root position tracks (constant offsets)
  clip.tracks = clip.tracks.filter((t) => {
    const [node, prop] = t.name.split(".");
    if (!boneNames.has(node)) return false;
    if (prop === "scale") return false;
    if (prop === "position" && node !== "Bip01") return false;
    return true;
  });
  const pos = clip.tracks.find((t) => t.name === "Bip01.position");
  const rot = clip.tracks.find((t) => t.name === "Bip01.quaternion");
  const dur = clip.duration;
  const info = { kind: c.kind, duration: r4(dur) };
  if (c.kind === "loop") {
    const v = pos.values;
    const n = v.length / 3;
    const dz = v[3 * n - 1] - v[2];
    const dx = v[3 * n - 3] - v[0];
    for (let i = 0; i < n; i++) {
      const f = pos.times[i] / dur;
      v[3 * i] -= dx * f;
      v[3 * i + 2] -= dz * f;
    }
    info.speed = r4((Math.hypot(dx, dz) * CM) / dur); // m/s ground speed of the cycle
  } else {
    // sample root XZ + yaw relative to frame 0, strip them from the clip
    const q0inv = new THREE.Quaternion().fromArray(rot.values, 0).invert();
    const fwd = new THREE.Vector3();
    const rt = rot.times;
    const yawAt = [];
    for (let i = 0; i < rt.length; i++) {
      const q = new THREE.Quaternion().fromArray(rot.values, i * 4);
      const rel = q.clone().multiply(q0inv);
      fwd.set(0, 0, 1).applyQuaternion(rel);
      const yaw = Math.atan2(fwd.x, fwd.z);
      yawAt.push(yaw);
      if (c.yaw) {
        const strip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
        strip.multiply(q).toArray(rot.values, i * 4);
      }
    }
    // unwrap yaw
    for (let i = 1; i < yawAt.length; i++) {
      while (yawAt[i] - yawAt[i - 1] > Math.PI) yawAt[i] -= 2 * Math.PI;
      while (yawAt[i] - yawAt[i - 1] < -Math.PI) yawAt[i] += 2 * Math.PI;
    }
    const v = pos.values;
    const x0 = v[0];
    const z0 = v[2];
    const curve = [];
    for (let i = 0; i < pos.times.length; i++) {
      curve.push([r4(pos.times[i]), r4((v[3 * i] - x0) * CM), r4((v[3 * i + 2] - z0) * CM), c.yaw ? r4(yawAt[Math.min(i, yawAt.length - 1)]) : 0]);
      v[3 * i] = x0;
      v[3 * i + 2] = z0;
    }
    info.root = curve; // [t, dx, dz, yaw] in the clip's start frame (character faces +Z)
    info.yawExtracted = !!c.yaw;
    const last = curve[curve.length - 1];
    info.rootTotal = { dx: last[1], dz: last[2], yaw: last[3] };
  }
  meta.clips[c.name] = info;
  clips.push(clip);
}

// Jump: no jump clip exists in the Rocketbox library. A held "airborne" pose is synthesized from a
// single run frame (legs tucked). Clearly a placeholder; a real clip can be dropped into the pipeline.
{
  const run = clips.find((c) => c.name === "run");
  const t = run.duration * 0.3;
  const tracks = run.tracks.map((tr) => {
    const interp = tr.createInterpolant();
    const val = Array.from(interp.evaluate(t));
    const T = tr.constructor;
    return new T(tr.name, [0, 1], [...val, ...val]);
  });
  clips.push(new THREE.AnimationClip("jump_air", 1, tracks));
  meta.clips.jump_air = { kind: "pose", duration: 1, placeholder: true, note: "synthesized from run frame; no jump clip in Rocketbox" };
}

avatar.animations = clips;
avatar.scale.setScalar(CM);
avatar.userData.lifeosProto = meta;

// ---------------------------------------------------------------- export
const exported = await new Promise((res, rej) =>
  new GLTFExporter().parse(avatar, res, rej, { binary: true, animations: clips, onlyVisible: false, trs: true }),
);
const rawBytes = new Uint8Array(exported);

// ---------------------------------------------------------------- optimize + textures
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.readBinary(rawBytes);
const tgaRGBA = (name) => decodeTGA(readFileSync(join(SRC, "avatar", `${name}.tga`)));
const toWebp = async (img, { quality = 82, lossless = false, alpha = false } = {}) =>
  sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } })
    .resize(TEX_SIZE, TEX_SIZE)
    .webp({ quality, lossless, alphaQuality: alpha ? 90 : 100, effort: 5 })
    .toBuffer();
/** Specular (gray) -> glTF ORM: R=ao(1) G=roughness B=metallic(0). */
const specToORM = (img) => {
  const d = Buffer.from(img.data);
  for (let i = 0; i < d.length; i += 4) {
    const s = d[i] / 255;
    d[i] = 255;
    d[i + 1] = Math.round(255 * Math.min(1, Math.max(0.3, 0.92 - 0.75 * s)));
    d[i + 2] = 0;
    d[i + 3] = 255;
  }
  return { ...img, data: d };
};
const root = doc.getRoot();
const tex = async (name, buf) => doc.createTexture(name).setImage(buf).setMimeType("image/webp").setURI(`${name}.webp`);
for (const mat of root.listMaterials()) {
  const n = mat.getName();
  const part = n.includes("head") ? "head" : n.includes("body") ? "body" : "opacity";
  mat.setMetallicFactor(1).setRoughnessFactor(1);
  if (part === "opacity") {
    const img = tgaRGBA("m002_opacity_color");
    mat.setBaseColorTexture(await tex("opacity_color", await toWebp(img, { quality: 85, alpha: true })));
    mat.setAlphaMode("MASK").setAlphaCutoff(0.4).setDoubleSided(true).setMetallicFactor(0).setRoughnessFactor(0.7);
    continue;
  }
  mat.setBaseColorTexture(await tex(`${part}_color`, await toWebp(tgaRGBA(`m002_${part}_color`), { quality: 85 })));
  mat.setNormalTexture(await tex(`${part}_normal`, await toWebp(tgaRGBA(`m002_${part}_normal`), { quality: 92 })));
  mat.setMetallicRoughnessTexture(await tex(`${part}_orm`, await toWebp(specToORM(tgaRGBA(`m002_${part}_specular`)), { quality: 85 })));
  mat.setAlphaMode("OPAQUE").setDoubleSided(false);
}
await doc.transform(
  dedup(),
  prune({ keepAttributes: false }),
  weld(),
  resample({ tolerance: 1e-4 }),
  sparse({ ratio: 0.3 }),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }),
  meshopt({ encoder: MeshoptEncoder, level: "medium" }),
);
mkdirSync(OUT, { recursive: true });
const glb = await io.writeBinary(doc);
writeFileSync(join(OUT, "character.glb"), glb);
// GPU-compressed variant (KTX2 / Basis): ETC1S for color + ORM, UASTC for normals. Much less VRAM on mobile.
const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};
// the Node shim defines `window`; ktx2-encoder picks its browser build when it exists
delete globalThis.window;
await doc.transform(
  ktx2({ isUASTC: true, generateMipmap: true, imageDecoder, slots: /normalTexture/ }),
  ktx2({ isUASTC: false, qualityLevel: 160, compressionLevel: 2, generateMipmap: true, imageDecoder, slots: /^(?!normalTexture).*/ }),
);
const glbKtx = await io.writeBinary(doc);
writeFileSync(join(OUT, "character.ktx2.glb"), glbKtx);
copyFileSync(join(SRC, "LICENSE.md"), join(OUT, "LICENSE-Rocketbox.md"));
writeFileSync(join(OUT, "character.meta.json"), JSON.stringify(meta));

// ---------------------------------------------------------------- report
const prim = root.listMeshes()[0].listPrimitives();
const tris = prim.reduce((s, p) => s + (p.getIndices()?.getCount() ?? 0) / 3, 0);
const report = {
  source: "Microsoft Rocketbox Male_Adult_01 (MIT)",
  rawExportBytes: rawBytes.byteLength,
  glbBytes: glb.byteLength,
  glbKtx2Bytes: glbKtx.byteLength,
  triangles: tris,
  bones: boneNames.size,
  morphTargets: Object.values(MORPHS),
  textureSize: TEX_SIZE,
  textures: root.listTextures().map((t) => ({ name: t.getName(), mime: t.getMimeType(), ktx2Bytes: t.getImage().byteLength })),
  clips: Object.fromEntries(Object.entries(meta.clips).map(([k, v]) => [k, { kind: v.kind, duration: v.duration, speed: v.speed, rootTotal: v.rootTotal, placeholder: v.placeholder }])),
};
writeFileSync(join(OUT, "character.report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!existsSync(join(OUT, "character.glb"))) process.exit(1);
