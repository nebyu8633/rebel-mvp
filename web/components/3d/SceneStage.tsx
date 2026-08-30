"use client";

import dynamic from "next/dynamic";

import { useSceneCapability } from "@/hooks/useSceneCapability";

/**
 * Three.js is ~600KB. Loading it lazily keeps it out of the initial bundle so
 * first paint does not wait on it (spec §52), and `ssr: false` because there
 * is no WebGL context on the server.
 */
const Scene = dynamic(() => import("./Scene").then((m) => ({ default: m.Scene })), {
  ssr: false,
  loading: () => <StaticBackdrop />,
});

/**
 * The no-3D backdrop.
 *
 * Shown before capability is known, when WebGL is unavailable, and when the
 * viewer prefers reduced motion. It carries the same visual weight as the
 * scene so the layout does not shift when the real one mounts.
 */
function StaticBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute start-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(16,185,129,0.28) 0%, rgba(16,185,129,0.06) 45%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #f4f5f7 1px, transparent 1px)," +
            "linear-gradient(to bottom, #f4f5f7 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
        }}
      />
    </div>
  );
}

/**
 * Chooses between the 3D scene and the static backdrop.
 *
 * Decorative in both cases: `aria-hidden` and `pointer-events-none` so it
 * never sits between a keyboard user and the call to action.
 */
export function SceneStage() {
  const { enabled, reduced, ready } = useSceneCapability();

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {ready && enabled ? <Scene reduced={reduced} /> : <StaticBackdrop />}

      {/*
       * Scrim. The scene sits behind live text, and text contrast cannot be
       * left to depend on where a floating object happens to drift. This keeps
       * the centre of the frame dark enough for the headline and subtitle to
       * stay readable at all times, while the edges show the scene through.
       */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 45%, " +
            "rgba(10,11,13,0.92) 0%, rgba(10,11,13,0.75) 45%, rgba(10,11,13,0.15) 100%)",
        }}
      />
    </div>
  );
}
