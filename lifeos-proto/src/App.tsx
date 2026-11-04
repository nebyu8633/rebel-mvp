import { Suspense, useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import * as THREE from "three";
import { World } from "./world/World";
import { Lighting } from "./world/Lighting";
import { Player } from "./player/Player";
import { bindKeyboard } from "./player/input";
import { ActionButtons, Stick, useLookDrag } from "./ui/Controls";
import { Hud, Loader } from "./ui/Hud";
import { BenchPanel, BenchProbe, bench } from "./ui/Bench";
import { params, useProto, type Quality } from "./store";

const isTouch = typeof window !== "undefined" && (matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && !matchMedia("(hover: hover)").matches));
const pinned = params.get("q") as Quality | null;
const initialQuality: Quality = pinned ?? (isTouch ? "medium" : "high");
const DPR: Record<Quality, number> = { high: 2, medium: 1.5, low: 1 };

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
    if (import.meta.env.DEV) Object.assign(window, { __proto3d: { gl, scene } });
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
  const showColliders = useProto((s) => s.debug.showColliders);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const benchOn = params.has("bench");
  useEffect(() => {
    useProto.getState().set({ quality: initialQuality });
    return bindKeyboard();
  }, []);
  useLookDrag(el);
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <div ref={setEl} style={{ position: "absolute", inset: 0 }}>
        <Canvas shadows="percentage" camera={{ fov: 55, near: 0.1, far: 400, position: [0, 3, 18] }} gl={{ antialias: quality !== "low", powerPreference: "high-performance" }} dpr={Math.min(DPR[initialQuality], window.devicePixelRatio || 1)}>
          <RendererSetup quality={quality} />
          <BenchProbe />
          <Suspense fallback={null}>
            <Lighting quality={quality} />
            <Physics timeStep="vary" debug={showColliders}>
              <World quality={quality} />
              <Player />
            </Physics>
            <Ready />
          </Suspense>
        </Canvas>
      </div>
      <Hud touch={isTouch} />
      {(isTouch || params.has("touch")) && (
        <>
          <Stick />
          <ActionButtons />
        </>
      )}
      {(benchOn || params.has("stats")) && <BenchPanel auto={benchOn} />}
      <Governor />
      <Loader />
    </div>
  );
}
