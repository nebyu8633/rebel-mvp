"use client";
/**
 * Shared host for the app's 3D worlds (/city = reality layer, /aetheria = AETHERIA). Engine synced
 * from lifeos-proto into src/game3d. Each world is its own page here; the engine's world navigator
 * maps in-world passages (the crack of light, the waystone) to app routes.
 */
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { useProgress } from "@react-three/drei";
import * as THREE from "three";
import { Lighting, type LightPreset } from "@/game3d/world/Lighting";
import { Player } from "@/game3d/player/Player";
import { bindKeyboard } from "@/game3d/player/input";
import { useLookDrag } from "@/game3d/ui/Controls";
import { BenchPanel, BenchProbe, bench } from "@/game3d/ui/Bench";
import { setWorldNavigator } from "@/game3d/engine/worldStore";
import { ContextLossOverlay, ContextLossProbe } from "@/game3d/ui/ContextGuard";
import { flushSave } from "@/game3d/aetheria/store";
import { params, useProto, type Quality } from "@/game3d/store";

const DPR: Record<Quality, number> = { high: 2, medium: 1.5, low: 1 };

/** World id (engine) -> app route. */
export const WORLD_ROUTES: Record<string, string> = { city: "/city", sanctuary: "/aetheria", knowledge: "/aetheria/knowledge", health: "/aetheria/health", mind: "/aetheria/mind", career: "/aetheria/career", social: "/aetheria/social", wealth: "/aetheria/wealth" };

function RendererSetup({ quality }: { quality: Quality }) {
  const gl = useThree((s) => s.gl);
  const setDpr = useThree((s) => s.setDpr);
  useEffect(() => {
    gl.toneMapping = THREE.AgXToneMapping;
    gl.toneMappingExposure = 1.05;
  }, [gl]);
  useEffect(() => setDpr(Math.min(DPR[quality], window.devicePixelRatio || 1)), [quality, setDpr]);
  return null;
}

function Ready() {
  const set = useProto((s) => s.set);
  useEffect(() => set({ ready: true }), [set]);
  return null;
}

function Governor({ pinned }: { pinned: boolean }) {
  const quality = useProto((s) => s.quality);
  const set = useProto((s) => s.set);
  useEffect(() => {
    if (pinned) return;
    let low = 0;
    const t = setInterval(() => {
      if (bench.recording) return;
      low = bench.live.fps > 0 && bench.live.fps < 45 ? low + 1 : 0;
      if (low >= 5 && quality !== "low") {
        set({ quality: quality === "high" ? "medium" : "low" });
        low = 0;
      }
    }, 500);
    return () => clearInterval(t);
  }, [quality, set, pinned]);
  return null;
}

function Loader({ text }: { text: string }) {
  const { progress, active } = useProgress();
  const ready = useProto((s) => s.ready);
  if (ready && !active) return null;
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-[#0b1120] text-sm text-slate-200">
      <div className="text-center">
        <div className="mb-2">{text}</div>
        <div className="h-1 w-56 rounded bg-white/10">
          <div className="h-1 rounded bg-sky-400" style={{ width: `${Math.round(progress)}%` }} />
        </div>
      </div>
    </div>
  );
}

export interface World3DHostProps {
  scene: ReactNode;
  hud: (touch: boolean) => ReactNode;
  light: LightPreset;
  spawn: { x: number; y: number; z: number; yaw: number };
  wearLoadout: boolean;
  loadingText: string;
}

export function World3DHost({ scene, hud, light, spawn, wearLoadout, loadingText }: World3DHostProps) {
  const router = useRouter();
  const quality = useProto((s) => s.quality);
  const showColliders = useProto((s) => s.debug.showColliders);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [env] = useState(() => {
    const touch = matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && !matchMedia("(hover: hover)").matches);
    const pinned = params.get("q") as Quality | null;
    // registered before the first render, so scenes can show/hide passages correctly
    setWorldNavigator({ has: (id) => id in WORLD_ROUTES, go: (id) => router.push(WORLD_ROUTES[id]) });
    return { touch, pinned, initial: pinned ?? (touch ? "medium" : "high") };
  });
  useEffect(() => {
    useProto.getState().set({ quality: env.initial, ready: false, prompt: null, panel: null });
    // (re)register in the effect too: StrictMode runs cleanup + effect again after the first mount
    setWorldNavigator({ has: (id) => id in WORLD_ROUTES, go: (id) => router.push(WORLD_ROUTES[id]) });
    const unbind = bindKeyboard();
    return () => {
      unbind();
      setWorldNavigator(null);
    };
  }, [env, router]);
  useLookDrag(el);
  return (
    <div className="absolute inset-0">
      <div ref={setEl} className="absolute inset-0">
        <Canvas shadows="percentage" camera={{ fov: 55, near: 0.1, far: 900, position: [spawn.x, 3, spawn.z + 6] }} gl={{ antialias: quality !== "low", powerPreference: "high-performance" }} dpr={Math.min(DPR[env.initial], window.devicePixelRatio || 1)}>
          <RendererSetup quality={quality} />
          <BenchProbe />
          <ContextLossProbe beforeReload={flushSave} />
          <Suspense fallback={null}>
            <Lighting quality={quality} preset={light} />
            <Physics timeStep="vary" debug={showColliders}>
              {scene}
              <Player spawn={[spawn.x, spawn.y + 1, spawn.z]} spawnYaw={spawn.yaw} wearLoadout={wearLoadout} />
            </Physics>
            <Ready />
          </Suspense>
        </Canvas>
      </div>
      {hud(env.touch || params.has("touch"))}
      {(params.has("bench") || params.has("stats")) && <BenchPanel auto={params.has("bench")} />}
      <Governor pinned={!!env.pinned} />
      <Loader text={loadingText} />
      <ContextLossOverlay />
    </div>
  );
}
