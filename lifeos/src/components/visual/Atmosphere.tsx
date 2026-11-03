"use client";
/**
 * Shared look for the 3D scenes (world + arena): image-based lighting generated in-scene
 * (no HDR downloads), filmic tone mapping and post-processing in three quality tiers.
 *
 *   high   — desktop GPUs: bloom + vignette + grading + SMAA, 2048 shadow maps
 *            (N8AO ambient occlusion was tried and removed: its render target is incompatible with three r187)
 *   medium — phones / mid GPUs: bloom + vignette + grading
 *   low    — no post-processing (renderer tone mapping only)
 *
 * The tier starts from the device class and steps down automatically if the measured
 * frame rate is too low, so weak devices never get stuck with expensive effects.
 */
import { Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useEffect, useRef } from "react";

export type Quality = "high" | "medium" | "low";

/** `?gfx=high|medium|low` pins the tier (testing on a real device, or a user who wants it fixed). */
export function pinnedQuality(): Quality | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(location.search).get("gfx");
  return q === "high" || q === "medium" || q === "low" ? q : null;
}

export function initialQuality(): Quality {
  if (typeof window === "undefined") return "medium";
  const pinned = pinnedQuality();
  if (pinned) return pinned;
  const n = navigator as Navigator & { deviceMemory?: number };
  const weak = (n.hardwareConcurrency ?? 8) <= 4 || (n.deviceMemory ?? 8) <= 4 || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (weak) return "low";
  const touch = window.matchMedia("(pointer: coarse)").matches;
  return touch ? "medium" : "high";
}

export const lower = (q: Quality): Quality => (q === "high" ? "medium" : "low");

/** Soft studio-style reflections built from emissive panels inside a small cube camera. */
export function SceneLighting({ warm = "#ffe7c4", cool = "#9fc4ff", intensity = 1 }: { warm?: string; cool?: string; intensity?: number }) {
  return (
    <Environment resolution={128} frames={1} environmentIntensity={0.35 * intensity}>
      <Lightformer form="rect" intensity={2.2} color={warm} position={[0, 6, -8]} scale={[12, 4, 1]} />
      <Lightformer form="rect" intensity={1.2} color={cool} position={[-8, 3, 4]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
      <Lightformer form="ring" intensity={1.6} color={warm} position={[6, 5, 6]} scale={3} />
      <Lightformer form="rect" intensity={0.6} color="#ffffff" position={[0, -4, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
    </Environment>
  );
}

export function PostFX({ quality, bloom = 0.9, warmth = 0.04 }: { quality: Quality; bloom?: number; warmth?: number }) {
  if (quality === "low") return null;
  return quality === "high" ? (
    <EffectComposer multisampling={0}>
      <Bloom intensity={bloom} luminanceThreshold={1.05} luminanceSmoothing={0.08} mipmapBlur />
      <HueSaturation saturation={0.12} hue={warmth * 0.1} />
      <BrightnessContrast brightness={0} contrast={0.1} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.32} darkness={0.55} />
      <SMAA />
    </EffectComposer>
  ) : (
    <EffectComposer multisampling={0}>
      <Bloom intensity={bloom * 0.8} luminanceThreshold={1.05} luminanceSmoothing={0.08} mipmapBlur />
      <HueSaturation saturation={0.06} />
      <BrightnessContrast contrast={0.06} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.35} darkness={0.45} />
    </EffectComposer>
  );
}

/**
 * Measures the frame rate for a couple of seconds after (re)configuration and steps the
 * quality down while it stays below `minFps`.
 */
export function QualityGovernor({ quality, onChange, minFps = 40 }: { quality: Quality; onChange: (q: Quality) => void; minFps?: number }) {
  const frames = useRef(0);
  const start = useRef(-1);
  const tier = useRef(quality);
  const pinned = useRef(pinnedQuality());
  useFrame(({ clock }) => {
    if (pinned.current) return;
    if (tier.current !== quality) {
      tier.current = quality;
      start.current = -1;
    }
    if (quality === "low") return;
    if (start.current < 0) {
      start.current = clock.elapsedTime;
      frames.current = 0;
      return;
    }
    frames.current++;
    const el = clock.elapsedTime - start.current;
    if (el >= 2.5) {
      const fps = frames.current / el;
      start.current = clock.elapsedTime;
      frames.current = 0;
      if (fps < minFps) onChange(lower(quality));
    }
  });
  return null;
}

/** With post-processing the composer does the tone mapping; without it the renderer does (no double mapping). */
export function RendererTone({ quality, exposure = 1 }: { quality: Quality; exposure?: number }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMapping = quality === "low" ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    gl.toneMappingExposure = exposure;
  }, [gl, quality, exposure]);
  return null;
}
