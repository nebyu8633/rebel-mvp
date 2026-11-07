/**
 * Personal avatar pipeline (local only — output is gitignored, never uploaded).
 *
 *   node scripts/build-avatar.mjs <avatar.glb> [--out public/avatar-private] [--tex 1024]
 *
 * Input: a humanoid GLB with a Mixamo-style skeleton (Avaturn export, Mixamo, …), ideally in T-pose.
 * Steps:
 *  1. validate the skeleton against the Mixamo->Rocketbox bone map (fails loudly if coverage is low)
 *  2. retarget every Rocketbox clip of public/assets/character/character.glb onto the avatar:
 *     world-space rotation deltas relative to each rig's rest pose, hips translation scaled by
 *     leg length; root-motion metadata scaled the same way
 *  3. write the clips into the ORIGINAL avatar document (materials, textures, morph targets kept)
 *  4. optimise: textures -> <=1024px KTX2, prune, weld, quantize, meshopt
 *  5. report + clip metadata in the GLB extras (read by the runtime like the placeholder)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { THREE } from "./lib/node-three.mjs";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, quantize, meshopt, textureCompress, weld, resample } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { ktx2 } from "ktx2-encoder/gltf-transform";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith("--"));
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
if (!input) {
  console.error("usage: node scripts/build-avatar.mjs <avatar.glb> [--out dir] [--tex 1024]");
  process.exit(2);
}
const OUT = resolve(ROOT, opt("--out", "public/avatar-private"));
const TEX = Number(opt("--tex", 1024));
const FPS = 30;
const MAP = JSON.parse(readFileSync(join(ROOT, "src/character/boneMap.mixamo-rocketbox.json"), "utf8"));
const norm = (n) => n.replace(/^mixamorig[:_]?/i, "");

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const loadThree = (buf) =>
  new Promise((res, rej) => {
    const l = new GLTFLoader();
    l.setMeshoptDecoder(MeshoptDecoder);
    l.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", res, rej);
  });

// ---------------------------------------------------------------- load rigs
const src = await loadThree(readFileSync(join(ROOT, "public/assets/character/character.glb")));
let srcMeta;
src.scene.traverse((o) => o.userData?.lifeosProto && (srcMeta = o.userData.lifeosProto));
const tgtBuf = readFileSync(resolve(input));
const tgt = await loadThree(tgtBuf);

const bonesOf = (scene) => {
  const m = new Map();
  scene.traverse((o) => {
    if (o.isBone || o.type === "Bone") m.set(o.name, o);
  });
  return m;
};
const sBones = bonesOf(src.scene);
const tBonesRaw = bonesOf(tgt.scene);
if (tBonesRaw.size === 0) {
  // some exporters don't mark joints as bones until a SkinnedMesh binds them; collect skin joints
  tgt.scene.traverse((o) => o.isSkinnedMesh && o.skeleton.bones.forEach((b) => tBonesRaw.set(b.name, b)));
}
const tBones = new Map([...tBonesRaw].map(([n, b]) => [norm(n), b]));
const mapped = Object.keys(MAP).filter((k) => tBones.has(k) && sBones.has(MAP[k]));
const core = ["Hips", "Spine", "Neck", "Head", "LeftArm", "LeftForeArm", "RightArm", "RightForeArm", "LeftUpLeg", "LeftLeg", "LeftFoot", "RightUpLeg", "RightLeg", "RightFoot"];
const missingCore = core.filter((k) => !mapped.includes(k));
console.log(`skeleton: ${tBones.size} bones, ${mapped.length}/${Object.keys(MAP).length} mapped`);
if (missingCore.length) {
  console.error("missing core bones:", missingCore.join(", "), "\nfound:", [...tBones.keys()].join(" "));
  process.exit(1);
}

// ---------------------------------------------------------------- rest poses (world)
src.scene.updateMatrixWorld(true);
tgt.scene.updateMatrixWorld(true);
const wq = (o) => o.getWorldQuaternion(new THREE.Quaternion());
const wp = (o) => o.getWorldPosition(new THREE.Vector3());
const sRestW = new Map(mapped.map((k) => [k, wq(sBones.get(MAP[k]))]));
const tRestW = new Map(mapped.map((k) => [k, wq(tBones.get(k))]));
const tRestLocal = new Map([...tBones].map(([k, b]) => [k, b.quaternion.clone()]));
const sHips = sBones.get(MAP.Hips);
const tHips = tBones.get("Hips");
const sHipRest = wp(sHips);
const tHipRest = wp(tHips);
// leg length via hips height above the feet
const footY = (bones, l, r) => Math.min(wp(bones.get(l)).y, wp(bones.get(r)).y);
const sLeg = sHipRest.y - footY(sBones, MAP.LeftFoot, MAP.RightFoot);
const tLeg = tHipRest.y - footY(tBones, "LeftFoot", "RightFoot");
const scale = tLeg / sLeg;
console.log(`leg ratio ${scale.toFixed(3)} (src ${sLeg.toFixed(3)} m, tgt ${tLeg.toFixed(3)})`);

// Rest poses differ (Rocketbox rests in a relaxed A-pose, Mixamo/Avaturn in T-pose). Per bone, a
// swing correction C rotates the target's rest direction (bone -> mapped child) onto the source's,
// so Qt(t) = Qs(t) · Rs⁻¹ · C · Rt. Twist is left untouched; Hips/Head/leaf bones inherit their parent's C.
const PREFERRED_CHILD = { Hips: null, Spine2: "Neck", Neck: "Head", LeftHand: "LeftHandMiddle1", RightHand: "RightHandMiddle1" };
const C = new Map();
const childOf = (k) => {
  if (k in PREFERRED_CHILD) return PREFERRED_CHILD[k] && mapped.includes(PREFERRED_CHILD[k]) ? PREFERRED_CHILD[k] : null;
  const tb = tBones.get(k);
  return mapped.find((c) => tBones.get(c).parent === tb) ?? null;
};
const walkMapped = [];
tgt.scene.traverse((o) => {
  const k = [...tBones].find(([, b]) => b === o)?.[0];
  if (k && mapped.includes(k)) walkMapped.push(k);
});
for (const k of walkMapped) {
  const child = childOf(k);
  if (!child) {
    // inherit from the nearest mapped ancestor (keeps fingertips/head consistent with their parent)
    let p = tBones.get(k).parent;
    let inherited = new THREE.Quaternion();
    while (p) {
      const pk = [...tBones].find(([, b]) => b === p)?.[0];
      if (pk && C.has(pk) && k !== "Hips" && k !== "Head") {
        inherited = C.get(pk).clone();
        break;
      }
      p = p.parent;
    }
    C.set(k, inherited);
    continue;
  }
  const tdir = wp(tBones.get(child)).sub(wp(tBones.get(k))).normalize();
  const sdir = wp(sBones.get(MAP[child])).sub(wp(sBones.get(MAP[k]))).normalize();
  C.set(k, new THREE.Quaternion().setFromUnitVectors(tdir, sdir));
}
for (const k of mapped) tRestW.set(k, C.get(k).clone().multiply(tRestW.get(k)));

// target bones in hierarchy order (parents first)
const order = [];
tgt.scene.traverse((o) => {
  const k = [...tBones].find(([, b]) => b === o)?.[0];
  if (k) order.push(k);
});

// ---------------------------------------------------------------- retarget clips
const mixer = new THREE.AnimationMixer(src.scene);
const out = []; // { name, times, rot: Map<k, Float32Array>, hips: Float32Array }
const qTmp = new THREE.Quaternion();
for (const clip of src.animations) {
  mixer.stopAllAction();
  const action = mixer.clipAction(clip);
  action.play();
  const n = Math.max(2, Math.round(clip.duration * FPS) + 1);
  const times = new Float32Array(n);
  const rot = new Map(order.map((k) => [k, new Float32Array(n * 4)]));
  const hips = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = Math.min(clip.duration, i / FPS);
    times[i] = t;
    action.time = t;
    mixer.update(0);
    src.scene.updateMatrixWorld(true);
    const worldNow = new Map();
    for (const k of order) {
      const b = tBones.get(k);
      const parentK = order.find((pk) => tBones.get(pk) === b.parent);
      const parentW = parentK ? worldNow.get(parentK) : b.parent ? wq(b.parent) : new THREE.Quaternion();
      let w;
      if (sRestW.has(k)) {
        // Qt = Qs(t) * inv(Rs) * Rt
        w = wq(sBones.get(MAP[k])).multiply(qTmp.copy(sRestW.get(k)).invert()).multiply(tRestW.get(k));
      } else w = parentW.clone().multiply(tRestLocal.get(k));
      worldNow.set(k, w);
      const local = parentW.clone().invert().multiply(w);
      local.toArray(rot.get(k), i * 4);
    }
    // hips translation: source displacement from rest, scaled, into the target hips' parent space
    const d = wp(sHips).sub(sHipRest).multiplyScalar(scale);
    const worldPos = tHipRest.clone().add(d);
    const local = tHips.parent ? tHips.parent.worldToLocal(worldPos.clone()) : worldPos;
    local.toArray(hips, i * 3);
  }
  out.push({ name: clip.name, times, rot, hips });
}

// ---------------------------------------------------------------- write into the avatar document
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.readBinary(new Uint8Array(tgtBuf));
const root = doc.getRoot();
for (const a of root.listAnimations()) a.dispose(); // replace any shipped clips (e.g. T-pose, dances)
const buffer = root.listBuffers()[0] ?? doc.createBuffer();
const nodeByName = new Map(root.listNodes().map((n) => [norm(n.getName()), n]));
for (const c of out) {
  const anim = doc.createAnimation(c.name);
  const input = doc.createAccessor().setType("SCALAR").setArray(c.times).setBuffer(buffer);
  for (const [k, arr] of c.rot) {
    if (!sRestW.has(k)) continue; // unmapped bones stay in rest pose
    const node = nodeByName.get(k);
    if (!node) continue;
    const s = doc.createAnimationSampler().setInput(input).setOutput(doc.createAccessor().setType("VEC4").setArray(arr).setBuffer(buffer)).setInterpolation("LINEAR");
    anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath("rotation").setSampler(s));
  }
  const hs = doc.createAnimationSampler().setInput(input).setOutput(doc.createAccessor().setType("VEC3").setArray(c.hips).setBuffer(buffer)).setInterpolation("LINEAR");
  anim.addSampler(hs).addChannel(doc.createAnimationChannel().setTargetNode(nodeByName.get("Hips")).setTargetPath("translation").setSampler(hs));
}
// clip metadata scaled to the avatar's stride
const metric = scale; // both rigs measured in scene world units (metres)
const meta = JSON.parse(JSON.stringify(srcMeta));
for (const info of Object.values(meta.clips)) {
  if (info.speed) info.speed = +(info.speed * metric).toFixed(4);
  if (info.root) info.root = info.root.map(([t, dx, dz, y]) => [t, +(dx * metric).toFixed(4), +(dz * metric).toFixed(4), y]);
  if (info.rootTotal) info.rootTotal = { dx: info.rootTotal.dx * metric, dz: info.rootTotal.dz * metric, yaw: info.rootTotal.yaw };
}
meta.retarget = { from: "rocketbox", legRatio: +scale.toFixed(4), mappedBones: mapped.length };
const scene = root.listScenes()[0];
const holder = scene.listChildren()[0];
holder.setExtras({ ...holder.getExtras(), lifeosProto: meta });

const imageDecoder = async (b) => {
  const { data, info } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};
await doc.transform(
  dedup(),
  prune(),
  resample({ tolerance: 1e-4 }),
  textureCompress({ encoder: sharp, targetFormat: "png", resize: [TEX, TEX] }),
);
delete globalThis.window;
await doc.transform(
  ktx2({ isUASTC: true, generateMipmap: true, imageDecoder, slots: /normalTexture/ }),
  ktx2({ isUASTC: false, qualityLevel: 170, generateMipmap: true, imageDecoder, slots: /^(?!normalTexture).*/ }),
  weld(),
  quantize({ quantizeWeight: 8 }),
  meshopt({ encoder: MeshoptEncoder }),
);
mkdirSync(OUT, { recursive: true });
const glb = await io.writeBinary(doc);
writeFileSync(join(OUT, "avatar.glb"), glb);
let tris = 0;
let morphs = 0;
for (const m of root.listMeshes())
  for (const p of m.listPrimitives()) {
    tris += (p.getIndices()?.getCount() ?? 0) / 3;
    morphs = Math.max(morphs, p.listTargets().length);
  }
const report = { input: resolve(input), bytes: glb.byteLength, triangles: tris, morphTargets: morphs, bones: tBones.size, mappedBones: mapped.length, legRatio: scale, clips: out.map((c) => c.name), textureMax: TEX };
writeFileSync(join(OUT, "avatar.report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
