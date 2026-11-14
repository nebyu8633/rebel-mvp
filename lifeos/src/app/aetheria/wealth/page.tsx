"use client";
import dynamic from "next/dynamic";

const Wealth3DApp = dynamic(() => import("@/components/aetheria/Wealth3DApp"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-slate-300">AETHERIA · טוען את כספת הערך…</div>,
});

/** AETHERIA — the Kingdom of Wealth. Game-only state (local save); no LifeOS data is written. */
export default function WealthPage() {
  return (
    <div className="relative h-[calc(100dvh-3.4rem-4.1rem)] w-full touch-none select-none overflow-hidden bg-[#1c1810] lg:h-dvh" data-testid="aetheria-wealth">
      <Wealth3DApp />
    </div>
  );
}
