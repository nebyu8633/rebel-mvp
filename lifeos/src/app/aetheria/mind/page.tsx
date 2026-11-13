"use client";
import dynamic from "next/dynamic";

const Mind3DApp = dynamic(() => import("@/components/aetheria/Mind3DApp"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-slate-300">AETHERIA · טוען את היכל ההשתקפויות…</div>,
});

/** AETHERIA — the Kingdom of the Mind. Game-only state (local save); no LifeOS data is written. */
export default function MindPage() {
  return (
    <div className="relative h-[calc(100dvh-3.4rem-4.1rem)] w-full touch-none select-none overflow-hidden bg-[#120c1c] lg:h-dvh" data-testid="aetheria-mind">
      <Mind3DApp />
    </div>
  );
}
