/** Runtime-generated textures (canvas): facade window grids, signage. Cached, small, shared. */
import * as THREE from "three";
import { rng } from "../world/geometry";

const cache = new Map<string, THREE.Texture>();

/**
 * Curtain-wall proportions: one texture tile = 36 m x 36 m = 10 floors (3.6 m) x 24 bays (1.5 m).
 * Each floor: vision glass + a darker spandrel band at the slab; thin mullions between bays.
 */
const FLOORS = 10;
const BAYS = 24;
export const FACADE_TILE_M = 36;

/** Emissive map: interior lights in a small share of the vision-glass cells (warm offices, cool lobbies). */
export function windowTexture(seed: number, litShare = 0.2, tint: "warm" | "cool" = "warm") {
  const key = `win:${seed}:${litShare}:${tint}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, S, S);
  const r = rng(seed);
  const fh = S / FLOORS;
  const bw = S / BAYS;
  for (let f = 0; f < FLOORS; f++) {
    // lit runs: offices light several adjacent bays
    let x = 0;
    while (x < BAYS) {
      const run = 1 + Math.floor(r() * 5);
      if (r() < litShare) {
        const warm = tint === "warm" ? r() > 0.2 : r() > 0.75;
        const v = 0.35 + r() * 0.5;
        g.fillStyle = warm ? `rgba(255,214,160,${v})` : `rgba(190,225,255,${v})`;
        g.fillRect(x * bw + 1, f * fh + fh * 0.22, Math.min(run, BAYS - x) * bw - 2, fh * 0.7);
      }
      x += run;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

/** Albedo for reflective glass: near-uniform panes (reflections do the work), spandrels, mullions. */
export function mullionTexture() {
  const key = "mullion";
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const r = rng(3);
  const fh = S / FLOORS;
  const bw = S / BAYS;
  for (let f = 0; f < FLOORS; f++)
    for (let x = 0; x < BAYS; x++) {
      const v = Math.round(118 + r() * 10);
      g.fillStyle = `rgb(${v - 14},${v},${v + 16})`;
      g.fillRect(x * bw, f * fh, bw, fh);
    }
  // spandrel (slab edge) bands
  g.fillStyle = "#3b4350";
  for (let f = 0; f < FLOORS; f++) g.fillRect(0, f * fh, S, fh * 0.16);
  // mullions
  g.fillStyle = "#9aa4b0";
  for (let x = 0; x < BAYS; x++) g.fillRect(x * bw, 0, 1.2, S);
  for (let f = 0; f < FLOORS; f++) g.fillRect(0, f * fh + fh * 0.16, S, 1.2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

/** Sign / hologram panel. Lines are drawn RTL-aware (canvas direction = rtl). */
export function signTexture(opts: { title: string; subtitle?: string; accent: string; progress?: number; footer?: string; width?: number; height?: number; locked?: boolean }) {
  const W = opts.width ?? 512;
  const H = opts.height ?? 256;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgba(10,16,30,0.92)");
  grad.addColorStop(1, "rgba(10,16,30,0.75)");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = opts.accent;
  g.lineWidth = 6;
  g.strokeRect(3, 3, W - 6, H - 6);
  g.direction = "rtl";
  g.textAlign = "center";
  g.fillStyle = "#fff";
  g.font = `700 ${Math.round(H * 0.2)}px system-ui, Arial`;
  g.fillText((opts.locked ? "🔒 " : "") + opts.title, W / 2, H * 0.3);
  if (opts.subtitle) {
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.font = `500 ${Math.round(H * 0.1)}px system-ui, Arial`;
    g.fillText(opts.subtitle, W / 2, H * 0.48);
  }
  if (opts.progress !== undefined) {
    const bw = W * 0.7;
    const bx = (W - bw) / 2;
    const by = H * 0.6;
    g.fillStyle = "rgba(255,255,255,0.15)";
    g.fillRect(bx, by, bw, H * 0.07);
    g.fillStyle = opts.accent;
    // RTL: fill from the right
    g.fillRect(bx + bw * (1 - opts.progress), by, bw * opts.progress, H * 0.07);
    g.fillStyle = "#fff";
    g.font = `600 ${Math.round(H * 0.09)}px system-ui, Arial`;
    g.fillText(`${Math.round(opts.progress * 100)}%`, W / 2, H * 0.8);
  }
  if (opts.footer) {
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.font = `500 ${Math.round(H * 0.075)}px system-ui, Arial`;
    g.fillText(opts.footer, W / 2, H * 0.93);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** The tower crown logo. */
export function logoTexture() {
  const key = "logo";
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 512;
  const H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, W, H);
  // hexagon emblem
  g.strokeStyle = "#7fd3ff";
  g.lineWidth = 18;
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = W / 2 + Math.cos(a) * 110;
    const y = 160 + Math.sin(a) * 110;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
  g.stroke();
  g.fillStyle = "#bfe9ff";
  g.beginPath();
  g.arc(W / 2, 160, 34, 0, Math.PI * 2);
  g.fill();
  g.textAlign = "center";
  g.fillStyle = "#e6f6ff";
  g.font = "700 110px system-ui, Arial";
  g.fillText("LifeOS", W / 2, 390);
  g.font = "500 46px system-ui, Arial";
  g.fillStyle = "#9fdcff";
  g.fillText("My Life. My World.", W / 2, 460);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}
