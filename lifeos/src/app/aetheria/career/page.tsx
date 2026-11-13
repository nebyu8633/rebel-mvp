"use client";
import dynamic from "next/dynamic";

const Career3DApp = dynamic(() => import("@/components/aetheria/Career3DApp"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-slate-300">AETHERIA · טוען את בית המלאכה הגדול…</div>,
});

/** AETHERIA — the Kingdom of Career. Game-only state (local save); no LifeOS data is written. */
export default function CareerPage() {
  return (
    <div className="relative h-[calc(100dvh-3.4rem-4.1rem)] w-full touch-none select-none overflow-hidden bg-[#160c08] lg:h-dvh" data-testid="aetheria-career">
      <Career3DApp />
    </div>
  );
}
