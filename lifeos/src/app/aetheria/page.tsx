"use client";
import dynamic from "next/dynamic";

const Aetheria3DApp = dynamic(() => import("@/components/aetheria/Aetheria3DApp"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-slate-300">AETHERIA · טוען…</div>,
});

/** AETHERIA — The First Resonance. Game-only state (local save); no LifeOS data is written. */
export default function AetheriaPage() {
  return (
    <div className="relative h-[calc(100dvh-3.4rem-4.1rem)] w-full touch-none select-none overflow-hidden bg-[#0b1120] lg:h-dvh" data-testid="aetheria">
      <Aetheria3DApp />
    </div>
  );
}
