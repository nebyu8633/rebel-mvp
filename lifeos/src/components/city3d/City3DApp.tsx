"use client";
/**
 * The LifeOS 3D city (engine synced from lifeos-proto into src/game3d). Client-only.
 * Data: read-only snapshot of the existing store (see snapshot.ts). Nothing here writes tasks,
 * goals or XP.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { useProgress } from "@react-three/drei";
import * as THREE from "three";
import { useStore } from "@/lib/store/store";
import { useToday } from "@/hooks/useToday";
import { CityScene } from "@/game3d/city/CityScene";
import { SPAWN } from "@/game3d/city/layout";
import { Lighting } from "@/game3d/world/Lighting";
import { Player } from "@/game3d/player/Player";
import { bindKeyboard } from "@/game3d/player/input";
import { useLookDrag } from "@/game3d/ui/Controls";
import { GameHud } from "@/game3d/ui/GameHud";
import { BenchPanel, BenchProbe, bench } from "@/game3d/ui/Bench";
import { params, useProto, type Quality } from "@/game3d/store";
import type { LifeOSSnapshot } from "@/game3d/data/lifeos";
import { buildSnapshot } from "./snapshot";
import { mockSnapshot } from "@/game3d/data/mock";
import { LIVE_DATA } from "@/game3d/config";

const DPR: Record<Quality, number> = { high: 2, medium: 1.5, low: 1 };

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

function Loader() {
  const { progress, active } = useProgress();
  const ready = useProto((s) => s.ready);
  if (ready && !active) return null;
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-[#0b1120] text-sm text-slate-200">
      <div className="text-center">
        <div className="mb-2">טוען את העיר…</div>
        <div className="h-1 w-56 rounded bg-white/10">
          <div className="h-1 rounded bg-sky-400" style={{ width: `${Math.round(progress)}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function City3DApp() {
  // Demo data by default. Live (read-only) LifeOS data only when explicitly enabled at build time;
  // in demo mode the store is not read at all.
  const db = useStore((s) => (LIVE_DATA ? s.db : null));
  const today = useToday();
  const snapshot: LifeOSSnapshot = useMemo(() => (LIVE_DATA && db ? buildSnapshot(db, today) : mockSnapshot()), [db, today]);
  const quality = useProto((s) => s.quality);
  const showColliders = useProto((s) => s.debug.showColliders);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [env] = useState(() => {
    const touch = matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && !matchMedia("(hover: hover)").matches);
    const pinned = params.get("q") as Quality | null;
    return { touch, pinned, initial: pinned ?? (touch ? "medium" : "high") };
  });
  useEffect(() => {
    useProto.getState().set({ quality: env.initial, ready: false });
    return bindKeyboard();
  }, [env]);
  useEffect(() => useProto.getState().set({ snapshot }), [snapshot]);
  useLookDrag(el);
  return (
    <div className="absolute inset-0">
      <div ref={setEl} className="absolute inset-0">
        <Canvas shadows="percentage" camera={{ fov: 55, near: 0.1, far: 900, position: [0, 3, 22] }} gl={{ antialias: quality !== "low", powerPreference: "high-performance" }} dpr={Math.min(DPR[env.initial], window.devicePixelRatio || 1)}>
          <RendererSetup quality={quality} />
          <BenchProbe />
          <Suspense fallback={null}>
            <Lighting quality={quality} preset="dusk" />
            <Physics timeStep="vary" debug={showColliders}>
              <CityScene quality={quality} snapshot={snapshot} />
              <Player spawn={[SPAWN.x, 1, SPAWN.z]} spawnYaw={SPAWN.yaw} />
            </Physics>
            <Ready />
          </Suspense>
        </Canvas>
      </div>
      <GameHud touch={env.touch || params.has("touch")} />
      {(params.has("bench") || params.has("stats")) && <BenchPanel auto={params.has("bench")} />}
      <Governor pinned={!!env.pinned} />
      <Loader />
    </div>
  );
}
