import { readFileSync } from "node:fs";
import { THREE } from "./lib/node-three.mjs";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
const buf = readFileSync(process.argv[2]);
const g = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "");
const pr = (o, d) => { if (d < 3) { console.log(" ".repeat(d * 2) + o.type + " " + o.name + " p=" + o.position.toArray().map((n) => n.toFixed(1)) + " r=" + o.rotation.toArray().slice(0, 3).map((n) => (n * 57.3).toFixed(0))); o.children.forEach((c) => pr(c, d + 1)); } };
pr(g, 0);
const m = g.getObjectByProperty("isMesh", true);
if (m) { const names = Object.keys(m.morphTargetDictionary); const groups = {}; for (const n of names) { const k = n.split(".")[1].slice(0, 2); (groups[k] ??= []).push(n.split(".")[1]); } for (const [k, v] of Object.entries(groups)) console.log(k, v.length, v.slice(-6).join(" ")); console.log(m.material.map((x) => x.type + ":" + x.name + " transparent=" + x.transparent)); }
