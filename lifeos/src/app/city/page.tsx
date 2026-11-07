"use client";
import dynamic from "next/dynamic";

const City3DApp = dynamic(() => import("@/components/city3d/City3DApp"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-slate-300">טוען את העיר…</div>,
});

/** LifeOS 3D city (vertical slice). Read-only view of LifeOS data; nothing is written from here. */
export default function CityPage() {
  return (
    <div className="relative h-[calc(100dvh-3.4rem-4.1rem)] w-full touch-none select-none overflow-hidden bg-[#0b1120] lg:h-dvh" data-testid="city3d">
      <City3DApp />
    </div>
  );
}
