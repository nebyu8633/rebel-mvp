"use client";

import { useEffect, useState } from "react";

export interface SceneCapability {
  /** Whether to mount the 3D scene at all. */
  enabled: boolean;
  /** Fewer floating elements, no shadows, lower pixel ratio (spec §51). */
  reduced: boolean;
  /** Resolved after mount; until then render the static fallback. */
  ready: boolean;
}

/** Below this width we treat the device as mobile and cut the scene down. */
const MOBILE_BREAKPOINT = 768;

/**
 * Probes for WebGL by actually acquiring a context, then discarding it.
 *
 * Checking `window.WebGLRenderingContext` only proves the API exists, not that
 * a context can be created — it still fails on blocklisted drivers, in some
 * VMs, and where hardware acceleration is off.
 */
function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    if (gl === null) return false;

    // Free the context immediately; browsers cap how many may exist at once.
    const lose = (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context");
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Decides whether and how to render the 3D scene.
 *
 * Runs after mount, never during render: touching `window` or
 * `matchMedia` while rendering would break SSR and cause a hydration
 * mismatch. The product stays fully usable when this returns `enabled: false`
 * (spec §51, §53).
 */
export function useSceneCapability(): SceneCapability {
  const [capability, setCapability] = useState<SceneCapability>({
    enabled: false,
    reduced: false,
    ready: false,
  });

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(pointer: coarse)");

    const evaluate = () => {
      const hasWebGL = detectWebGL();
      const isMobile =
        window.innerWidth < MOBILE_BREAKPOINT || coarsePointer.matches;

      setCapability({
        // A reduced-motion preference disables the scene outright rather than
        // slowing it: its whole purpose is movement.
        enabled: hasWebGL && !reducedMotion.matches,
        reduced: isMobile,
        ready: true,
      });
    };

    evaluate();

    reducedMotion.addEventListener("change", evaluate);
    coarsePointer.addEventListener("change", evaluate);
    window.addEventListener("resize", evaluate);

    return () => {
      reducedMotion.removeEventListener("change", evaluate);
      coarsePointer.removeEventListener("change", evaluate);
      window.removeEventListener("resize", evaluate);
    };
  }, []);

  return capability;
}
