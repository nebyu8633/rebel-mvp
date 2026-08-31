"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

import { FloatingData } from "./FloatingData";
import { InvoiceDocument } from "./InvoiceDocument";

/**
 * How far the camera leans toward the pointer. Small by design: the spec
 * rules out aggressive motion, spinning, and anything that competes with the
 * call to action (§11).
 */
const PARALLAX_STRENGTH = 0.32;

/** Fraction of the remaining distance covered per frame — a smoothing factor. */
const PARALLAX_EASING = 0.045;

/**
 * Leans the whole scene toward the pointer.
 *
 * Rotating a group rather than moving the camera keeps the framing fixed, so
 * the invoice never drifts out of shot however the pointer moves. R3F
 * normalizes `state.pointer` to -1..1 and reports the centre until the pointer
 * enters the canvas, so there is no jump on first move.
 */
function ParallaxRig({ children }: { children: React.ReactNode }) {
  const group = useRef<Group>(null);
  const { pointer } = useThree();

  useFrame(() => {
    if (group.current === null) return;

    const targetY = pointer.x * PARALLAX_STRENGTH;
    const targetX = -pointer.y * PARALLAX_STRENGTH * 0.55;

    // Ease toward the target instead of snapping, so a fast flick across the
    // canvas glides rather than jerks.
    group.current.rotation.y += (targetY - group.current.rotation.y) * PARALLAX_EASING;
    group.current.rotation.x += (targetX - group.current.rotation.x) * PARALLAX_EASING;
  });

  return <group ref={group}>{children}</group>;
}

/**
 * The 3D product environment on the home screen.
 *
 * Purely decorative: it is marked `aria-hidden` and sits behind the content,
 * because the product must be fully understandable without it (spec §53).
 */
export function Scene({ reduced }: { reduced: boolean }) {
  return (
    <Canvas
      // Cap the pixel ratio: on a 3x phone screen an uncapped ratio renders
      // nine times the pixels for no visible gain.
      dpr={reduced ? [1, 1.5] : [1, 2]}
      camera={{ position: [0, 0, 7], fov: 42 }}
      gl={{ antialias: !reduced, powerPreference: "high-performance" }}
      // Only redraw while something is moving; between frames the GPU idles.
      frameloop="always"
      style={{ position: "absolute", inset: 0 }}
    >
      <ambientLight intensity={0.65} />
      <directionalLight position={[4, 6, 5]} intensity={1.15} castShadow={!reduced} />
      <directionalLight position={[-5, -2, -4]} intensity={0.35} color="#10b981" />

      <ParallaxRig>
        {/*
         * The document sits back and to the side rather than dead centre.
         * Centred and full size, a light sheet of paper lands directly behind
         * the headline and the subtitle stops being readable — the scene has
         * to support the copy, not compete with it (spec §8, §11).
         */}
        {/*
         * Desktop only. A 375px screen has one column, and the centred
         * headline, subtitle and two buttons occupy all of it — wherever the
         * sheet is placed it ends up crossing one of them, which reads as a
         * rendering fault rather than as depth. The ambient particles and the
         * scrim's glow carry the scene there instead, and the phone renders
         * one fewer object for it.
         */}
        {!reduced && (
          <group position={[1.9, -0.15, -2.2]} scale={0.72} rotation={[0, -0.28, 0.04]}>
            <InvoiceDocument reduced={reduced} />
          </group>
        )}
        <FloatingData reduced={reduced} />
      </ParallaxRig>
    </Canvas>
  );
}
