"use client";
import dynamic from "next/dynamic";

const Social3DApp = dynamic(() => import("@/components/aetheria/Social3DApp"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-slate-300">AETHERIA · טוען את כפר האח…</div>,
});

/** AETHERIA — the Kingdom of Social. Game-only state (local save); no LifeOS data is written. */
export default function SocialPage() {
  return (
    <div className="relative h-[calc(100dvh-3.4rem-4.1rem)] w-full touch-none select-none overflow-hidden bg-[#10101c] lg:h-dvh" data-testid="aetheria-social">
      <Social3DApp />
    </div>
  );
}
