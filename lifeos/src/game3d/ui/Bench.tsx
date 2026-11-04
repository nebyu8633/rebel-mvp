/**
 * Performance bench. Inside the Canvas: <BenchProbe/> samples frame times + renderer info.
 * Outside: <BenchPanel/> shows live numbers and a copyable JSON report.
 * The report states plainly that only runs on real devices count toward acceptance.
 */
import { useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import { compressedSupport } from "../lib/loaders";
import { autopilot, startAutopilot } from "../player/autopilot";
import { params, useProto } from "../store";

const MAX = 60 * 240;
export const bench = {
  frames: new Float32Array(MAX),
  n: 0,
  recording: false,
  startedAt: 0,
  info: { calls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0 },
  gpu: "",
  support: {} as Record<string, boolean>,
  dpr: 1,
  size: [0, 0] as [number, number],
  loadMs: 0,
  live: { fps: 0, ms: 0 },
};

function quantile(sorted: Float32Array, q: number) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

export function summarize() {
  const ft = bench.frames.slice(0, bench.n).sort();
  const avg = ft.reduce((s, v) => s + v, 0) / (ft.length || 1);
  const over = (ms: number) => ft.filter((v) => v > ms).length / (ft.length || 1);
  return {
    frames: ft.length,
    avgFps: +(1000 / avg).toFixed(1),
    p50ms: +quantile(ft, 0.5).toFixed(2),
    p95ms: +quantile(ft, 0.95).toFixed(2),
    p99ms: +quantile(ft, 0.99).toFixed(2),
    over16_7: +(over(16.7) * 100).toFixed(1),
    over33_3: +(over(33.3) * 100).toFixed(1),
    worstMs: +ft[ft.length - 1]?.toFixed(1) || 0,
  };
}

export function report() {
  const s = summarize();
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    kind: "lifeos-proto-bench",
    version: 1,
    at: new Date().toISOString(),
    note: "Acceptance requires runs on real iOS/Android devices (Capacitor build). Desktop/emulator numbers are indicative only.",
    route: autopilot.done ? "completed" : autopilot.active ? "in-progress" : "manual",
    durationS: +((performance.now() - bench.startedAt) / 1000).toFixed(1),
    quality: useProto.getState().quality,
    textures: params.get("tex") === "webp" ? "webp" : "ktx2",
    dpr: bench.dpr,
    canvas: bench.size,
    loadMs: Math.round(bench.loadMs),
    ...s,
    targets: { fps60: s.p95ms <= 17.5, fps30: s.p95ms <= 34 },
    renderer: bench.info,
    gpu: bench.gpu,
    compressedTextureSupport: bench.support,
    device: {
      ua: navigator.userAgent,
      platform: (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform,
      cores: navigator.hardwareConcurrency,
      memoryGB: nav.deviceMemory ?? null,
      screen: [screen.width, screen.height],
      devicePixelRatio: devicePixelRatio,
    },
  };
}

export function BenchProbe() {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  useEffect(() => {
    const ctx = gl.getContext();
    const dbg = ctx.getExtension("WEBGL_debug_renderer_info");
    bench.gpu = dbg ? String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(ctx.getParameter(ctx.RENDERER));
    bench.support = compressedSupport(gl as THREE.WebGLRenderer);
    bench.loadMs = performance.now();
  }, [gl]);
  let acc = 0;
  let cnt = 0;
  useFrame((_, dt) => {
    bench.dpr = gl.getPixelRatio();
    bench.size = [Math.round(size.width * bench.dpr), Math.round(size.height * bench.dpr)];
    const ms = dt * 1000;
    if (bench.recording && bench.n < MAX) bench.frames[bench.n++] = ms;
    acc += ms;
    cnt++;
    if (acc > 500) {
      bench.live = { fps: Math.round((1000 * cnt) / acc), ms: +(acc / cnt).toFixed(1) };
      const r = gl.info;
      bench.info = { calls: r.render.calls, triangles: r.render.triangles, geometries: r.memory.geometries, textures: r.memory.textures, programs: r.programs?.length ?? 0 };
      acc = cnt = 0;
    }
  });
  return null;
}

export function startBenchRun() {
  bench.n = 0;
  bench.recording = true;
  bench.startedAt = performance.now();
  startAutopilot(() => {
    bench.recording = false;
  });
}

export function BenchPanel({ auto }: { auto: boolean }) {
  const [, tick] = useState(0);
  const [copied, setCopied] = useState(false);
  const ready = useProto((s) => s.ready);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!auto || !ready) return;
    const t = setTimeout(startBenchRun, 2500); // let shaders compile / textures upload first
    return () => clearTimeout(t);
  }, [auto, ready]);
  const s = summarize();
  const copy = async () => {
    const text = JSON.stringify(report(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div data-testid="bench" style={{ position: "absolute", top: innerWidth < 700 ? 64 : 10, left: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(8,12,18,0.78)", font: "12px/1.45 ui-monospace, Menlo, monospace", direction: "ltr", minWidth: 210 }}>
      <div>
        <b>{bench.live.fps} fps</b> · {bench.live.ms} ms · dpr {bench.dpr.toFixed(2)}
      </div>
      <div>
        calls {bench.info.calls} · tris {(bench.info.triangles / 1000).toFixed(0)}k · tex {bench.info.textures}
      </div>
      <div style={{ opacity: 0.8 }}>{bench.gpu.slice(0, 48)}</div>
      {bench.n > 0 && (
        <div style={{ marginTop: 4 }}>
          {bench.recording ? "● rec " : "■ "}
          {s.frames} fr · avg {s.avgFps} · p95 {s.p95ms}ms · p99 {s.p99ms}ms
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button onClick={startBenchRun} disabled={bench.recording} style={{ fontSize: 12 }}>
          Run route
        </button>
        <button onClick={copy} style={{ fontSize: 12 }} data-testid="bench-copy">
          {copied ? "Copied ✓" : "Copy report"}
        </button>
      </div>
    </div>
  );
}
