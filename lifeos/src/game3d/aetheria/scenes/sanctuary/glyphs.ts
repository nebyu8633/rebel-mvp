/** Kingdom sigils + force glyphs drawn on canvas (emissive maps). Cached. */
import * as THREE from "three";
import type { Force, KingdomId } from "../../core/model";

const cache = new Map<string, THREE.Texture>();

function canvas(draw: (g: CanvasRenderingContext2D, S: number) => void, key: string) {
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, S, S);
  g.strokeStyle = "#fff";
  g.fillStyle = "#fff";
  g.lineWidth = 10;
  g.lineCap = "round";
  g.lineJoin = "round";
  draw(g, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

const ring = (g: CanvasRenderingContext2D, S: number, r: number) => {
  g.beginPath();
  g.arc(S / 2, S / 2, r, 0, Math.PI * 2);
  g.stroke();
};

const KINGDOM_DRAW: Record<KingdomId, (g: CanvasRenderingContext2D, S: number) => void> = {
  wealth: (g, S) => {
    ring(g, S, 110);
    for (const r of [70, 40]) {
      g.beginPath();
      g.moveTo(S / 2, S / 2 - r);
      g.lineTo(S / 2 + r, S / 2);
      g.lineTo(S / 2, S / 2 + r);
      g.lineTo(S / 2 - r, S / 2);
      g.closePath();
      g.stroke();
    }
  },
  health: (g, S) => {
    ring(g, S, 110);
    g.beginPath();
    g.ellipse(S / 2, S / 2, 38, 78, 0, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(S / 2, S / 2 - 78);
    g.lineTo(S / 2, S / 2 + 90);
    g.stroke();
  },
  knowledge: (g, S) => {
    ring(g, S, 110);
    g.beginPath();
    g.moveTo(S / 2 - 80, S / 2);
    g.quadraticCurveTo(S / 2, S / 2 - 70, S / 2 + 80, S / 2);
    g.quadraticCurveTo(S / 2, S / 2 + 70, S / 2 - 80, S / 2);
    g.stroke();
    g.beginPath();
    g.arc(S / 2, S / 2, 20, 0, Math.PI * 2);
    g.fill();
  },
  career: (g, S) => {
    ring(g, S, 110);
    g.beginPath();
    g.moveTo(S / 2, S / 2 - 80);
    g.lineTo(S / 2 + 60, S / 2 + 60);
    g.lineTo(S / 2 - 60, S / 2 + 60);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(S / 2 - 35, S / 2 + 15);
    g.lineTo(S / 2 + 35, S / 2 + 15);
    g.stroke();
  },
  social: (g, S) => {
    ring(g, S, 110);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      g.beginPath();
      g.arc(S / 2 + Math.cos(a) * 34, S / 2 + Math.sin(a) * 34, 40, 0, Math.PI * 2);
      g.stroke();
    }
  },
  mind: (g, S) => {
    ring(g, S, 110);
    g.beginPath();
    g.arc(S / 2, S / 2, 70, Math.PI * 0.25, Math.PI * 1.75);
    g.arc(S / 2 + 30, S / 2, 52, Math.PI * 1.6, Math.PI * 0.4, true);
    g.stroke();
    g.beginPath();
    g.arc(S / 2 + 10, S / 2, 14, 0, Math.PI * 2);
    g.fill();
  },
};

const FORCE_DRAW: Record<Force, (g: CanvasRenderingContext2D, S: number) => void> = {
  form: (g, S) => {
    g.strokeRect(S / 2 - 70, S / 2 - 70, 140, 140);
    ring(g, S, 30);
  },
  change: (g, S) => {
    g.beginPath();
    for (let t = 0; t < 7.5 * Math.PI; t += 0.1) {
      const r = 6 + t * 4.2;
      const x = S / 2 + Math.cos(t) * r;
      const y = S / 2 + Math.sin(t) * r;
      if (t === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  },
  connection: (g, S) => {
    g.beginPath();
    g.arc(S / 2 - 34, S / 2, 52, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(S / 2 + 34, S / 2, 52, 0, Math.PI * 2);
    g.stroke();
  },
};

export const kingdomGlyph = (k: KingdomId) => canvas(KINGDOM_DRAW[k], `k:${k}`);
export const forceGlyph = (f: Force) => canvas(FORCE_DRAW[f], `f:${f}`);
