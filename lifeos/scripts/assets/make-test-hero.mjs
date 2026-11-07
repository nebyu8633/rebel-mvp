#!/usr/bin/env node
/**
 * Builds a small rigged TEST character (no paid services) and writes one GLB per animation clip,
 * the same shape of output an AI rigging service gives (one file per clip, same skeleton).
 * Used to validate the asset pipeline (merge → optimize → load in Three.js) end to end.
 *
 *   node scripts/assets/make-test-hero.mjs <outDir>
 */
import { Document, NodeIO } from "@gltf-transform/core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] ?? "scripts/assets/.test-hero";
/** Optional bone-name prefix (to produce a deliberately mismatched skeleton in tests). */
const prefix = process.argv[3] ?? "";
mkdirSync(out, { recursive: true });

// skeleton (bind pose, metres, Y up, facing +Z)
const BONES = [
  { name: "Hips", parent: null, t: [0, 0.95, 0] },
  { name: "Spine", parent: "Hips", t: [0, 0.25, 0] },
  { name: "Head", parent: "Spine", t: [0, 0.45, 0] },
  { name: "LeftArm", parent: "Spine", t: [0.28, 0.35, 0] },
  { name: "RightArm", parent: "Spine", t: [-0.28, 0.35, 0] },
  { name: "LeftUpLeg", parent: "Hips", t: [0.12, -0.05, 0] },
  { name: "RightUpLeg", parent: "Hips", t: [-0.12, -0.05, 0] },
];
// a box per bone: [bone, centre offset from bone, size, colour]
const PARTS = [
  ["Hips", [0, 0.05, 0], [0.36, 0.2, 0.22], [0.25, 0.22, 0.3]],
  ["Spine", [0, 0.2, 0], [0.42, 0.42, 0.26], [0.42, 0.35, 0.18]],
  ["Head", [0, 0.14, 0], [0.24, 0.26, 0.24], [0.91, 0.78, 0.66]],
  ["LeftArm", [0.06, -0.24, 0], [0.12, 0.5, 0.12], [0.42, 0.35, 0.18]],
  ["RightArm", [-0.06, -0.24, 0], [0.12, 0.5, 0.12], [0.42, 0.35, 0.18]],
  ["LeftUpLeg", [0, -0.42, 0], [0.15, 0.85, 0.15], [0.16, 0.15, 0.2]],
  ["RightUpLeg", [0, -0.42, 0], [0.15, 0.85, 0.15], [0.16, 0.15, 0.2]],
];

const world = (name) => {
  const b = BONES.find((x) => x.name === name);
  if (!b.parent) return b.t;
  const p = world(b.parent);
  return [p[0] + b.t[0], p[1] + b.t[1], p[2] + b.t[2]];
};

function geometry() {
  const pos = [];
  const nrm = [];
  const col = [];
  const joints = [];
  const weights = [];
  const idx = [];
  const faces = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
    [[0, -1, 0], [0, 0, -1], [1, 0, 0]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ];
  PARTS.forEach(([bone, off, size, c]) => {
    const j = BONES.findIndex((b) => b.name === bone);
    const w = world(bone);
    const centre = [w[0] + off[0], w[1] + off[1], w[2] + off[2]];
    for (const [n, u, v] of faces) {
      const base = pos.length / 3;
      for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        for (let k = 0; k < 3; k++) pos.push(centre[k] + (n[k] * size[k]) / 2 + (u[k] * su * size[k]) / 2 + (v[k] * sv * size[k]) / 2);
        nrm.push(...n);
        col.push(...c, 1);
        joints.push(j, 0, 0, 0);
        weights.push(1, 0, 0, 0);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  });
  return { pos, nrm, col, joints, weights, idx };
}

const quat = (axis, a) => {
  const s = Math.sin(a / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(a / 2)];
};

const CLIPS = {
  Idle: { dur: 2, tracks: { Spine: (t) => quat([1, 0, 0], Math.sin(t * Math.PI) * 0.04), LeftArm: (t) => quat([0, 0, 1], 0.08 + Math.sin(t * Math.PI) * 0.03), RightArm: (t) => quat([0, 0, 1], -0.08 - Math.sin(t * Math.PI) * 0.03) } },
  Run: {
    dur: 0.7,
    tracks: {
      LeftUpLeg: (t) => quat([1, 0, 0], Math.sin((t / 0.7) * 2 * Math.PI) * 0.8),
      RightUpLeg: (t) => quat([1, 0, 0], -Math.sin((t / 0.7) * 2 * Math.PI) * 0.8),
      LeftArm: (t) => quat([1, 0, 0], -Math.sin((t / 0.7) * 2 * Math.PI) * 0.7),
      RightArm: (t) => quat([1, 0, 0], Math.sin((t / 0.7) * 2 * Math.PI) * 0.7),
      Spine: () => quat([1, 0, 0], 0.18),
    },
  },
  Attack: { dur: 0.6, tracks: { RightArm: (t) => quat([1, 0, 0], -Math.sin((t / 0.6) * Math.PI) * 2.2), Spine: (t) => quat([0, 1, 0], Math.sin((t / 0.6) * Math.PI) * 0.4) } },
};

async function write(clipName) {
  const doc = new Document();
  const buf = doc.createBuffer();
  const scene = doc.createScene("Scene");
  const nodes = {};
  for (const b of BONES) nodes[b.name] = doc.createNode(prefix + b.name).setTranslation(b.t);
  for (const b of BONES) if (b.parent) nodes[b.parent].addChild(nodes[b.name]);
  const armature = doc.createNode("Armature").addChild(nodes.Hips);
  const g = geometry();
  const acc = (type, arr, ctor, comp) => doc.createAccessor().setType(type).setArray(new ctor(arr)).setBuffer(buf).setNormalized(!!comp);
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", acc("VEC3", g.pos, Float32Array))
    .setAttribute("NORMAL", acc("VEC3", g.nrm, Float32Array))
    .setAttribute("COLOR_0", acc("VEC4", g.col, Float32Array))
    .setAttribute("JOINTS_0", acc("VEC4", g.joints, Uint16Array))
    .setAttribute("WEIGHTS_0", acc("VEC4", g.weights, Float32Array))
    .setIndices(acc("SCALAR", g.idx, Uint16Array))
    .setMaterial(doc.createMaterial("Body").setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.7));
  const ibm = [];
  for (const b of BONES) {
    const w = world(b.name);
    ibm.push(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -w[0], -w[1], -w[2], 1);
  }
  const skin = doc.createSkin("Skin").setSkeleton(nodes.Hips).setInverseBindMatrices(acc("MAT4", ibm, Float32Array));
  for (const b of BONES) skin.addJoint(nodes[b.name]);
  const meshNode = doc.createNode("Character").setMesh(doc.createMesh("Character").addPrimitive(prim)).setSkin(skin);
  scene.addChild(armature).addChild(meshNode);
  const clip = CLIPS[clipName];
  const anim = doc.createAnimation(clipName);
  for (const [bone, fn] of Object.entries(clip.tracks)) {
    const times = [];
    const vals = [];
    for (let i = 0; i <= 24; i++) {
      const t = (i / 24) * clip.dur;
      times.push(t);
      vals.push(...fn(t));
    }
    const sampler = doc.createAnimationSampler().setInput(acc("SCALAR", times, Float32Array)).setOutput(acc("VEC4", vals, Float32Array)).setInterpolation("LINEAR");
    anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(nodes[bone]).setTargetPath("rotation").setSampler(sampler));
  }
  const file = join(out, `test-${clipName.toLowerCase()}.glb`);
  await new NodeIO().write(file, doc);
  console.log("wrote", file);
}

for (const c of Object.keys(CLIPS)) await write(c);
