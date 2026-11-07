import { Suspense, useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import * as THREE from "three";
import { Lighting } from "./world/Lighting";
import { Player } from "./player/Player";
import { bindKeyboard } from "./player/input";
import { useLookDrag } from "./ui/Controls";
import { Loader } from "./ui/Hud";
import { BenchPanel, BenchProbe, bench } from "./ui/Bench";
import { params, useProto, type Quality } from "./store";
import { DEV } from "./config";
import { useWorlds } from "./engine/worldStore";
import { getWorld } from "./worlds/registry";
import { registerBuiltInWorlds } from "./worlds";
import { TransitionOverlay } from "./ui/WorldUi";
import { bindSaveOnHide, flushSave, useAetheria } from "./aetheria/store";
import { ContextLossOverlay, ContextLossProbe } from "./ui/ContextGuard";

const isTouch = typeof window !== "undefined" && (matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && !matchMedia("(hover: hover)").matches));
const pinned = params.get("q") as Quality | null;
const initialQuality: Quality = pinned ?? (isTouch ? "medium" : "high");
const DPR: Record<Quality, number> = { high: 2, medium: 1.5, low: 1 };

registerBuiltInWorlds();
/** `?world=<id>` picks the starting world (`?scene=test` kept for compatibility). */
const startWorld = params.get("world") ?? (params.get("scene") === "test" ? "test" : "city");
useWorlds.getState().setCurrent(getWorld(startWorld) ? startWorld : "city");

function Ready() {
  const set = useProto((s) => s.set);
  useEffect(() => set({ ready: true }), [set]);
  return null;
}

/** Steps quality down when the frame rate stays low (never when pinned via ?q= or during a bench run). */
function Governor() {
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
  }, [quality, set]);
  return null;
}

function RendererSetup({ quality }: { quality: Quality }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const setDpr = useThree((s) => s.setDpr);
  useEffect(() => {
    if (DEV) Object.assign(window, { __proto3d: { gl, scene }, __aetheria: useAetheria, __worlds: useWorlds, __proto: useProto });
  }, [gl, scene]);
  useEffect(() => {
    gl.toneMapping = THREE.AgXToneMapping;
    gl.toneMappingExposure = 1.05;
  }, [gl]);
  useEffect(() => setDpr(Math.min(DPR[quality], window.devicePixelRatio || 1)), [quality, setDpr]);
  return null;
}

export default function App() {
  const quality = useProto((s) => s.quality);
  const worldId = useWorlds((s) => s.current);
  const world = getWorld(worldId)!;
  const showColliders = useProto((s) => s.debug.showColliders);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const benchOn = params.has("bench");
  useEffect(() => {
    useProto.getState().set({ quality: initialQuality });
    void useAetheria.getState().hydrate();
    const unbindSave = bindSaveOnHide();
    // persist AETHERIA state whenever the player leaves a world
    const unsubWorld = useWorlds.subscribe((st, prev) => {
      if (st.phase === "out" && prev.phase !== "out") void flushSave();
    });
    const unbind = bindKeyboard();
    return () => {
      unbind();
      unsubWorld();
      unbindSave();
    };
  }, []);
  useLookDrag(el);
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <div ref={setEl} style={{ position: "absolute", inset: 0 }}>
        <Canvas shadows="percentage" camera={{ fov: 55, near: 0.1, far: 900, position: [0, 3, 22] }} gl={{ antialias: quality !== "low", powerPreference: "high-performance" }} dpr={Math.min(DPR[initialQuality], window.devicePixelRatio || 1)}>
          <RendererSetup quality={quality} />
          <BenchProbe />
          <ContextLossProbe beforeReload={flushSave} />
          <Suspense fallback={null}>
            <Lighting quality={quality} preset={world.light} />
            {/* keyed by world: physics, colliders, interactables and the player are rebuilt on every switch */}
            <Physics key={world.id} timeStep="vary" debug={showColliders}>
              <world.Scene quality={quality} />
              <Player spawn={[world.spawn.x, world.spawn.y + 1, world.spawn.z]} spawnYaw={world.spawn.yaw} wearLoadout={world.wearsLoadout} />
            </Physics>
            <Ready />
          </Suspense>
        </Canvas>
      </div>
      <world.Hud key={world.id} touch={isTouch || params.has("touch")} />
      {(benchOn || params.has("stats")) && <BenchPanel auto={benchOn} />}
      <Governor />
      <Loader />
      <TransitionOverlay />
      <ContextLossOverlay />
    </div>
  );
}
