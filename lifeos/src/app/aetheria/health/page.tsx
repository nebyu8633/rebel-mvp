"use client";
import dynamic from "next/dynamic";

const Health3DApp = dynamic(() => import("@/components/aetheria/Health3DApp"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-slate-300">AETHERIA · טוען את חורשת החיים…</div>,
});

/** AETHERIA — the Kingdom of Health. Game-only state (local save); no LifeOS data is written. */
export default function HealthPage() {
  return (
    <div className="relative h-[calc(100dvh-3.4rem-4.1rem)] w-full touch-none select-none overflow-hidden bg-[#0b1410] lg:h-dvh" data-testid="aetheria-health">
      <Health3DApp />
    </div>
  );
}
