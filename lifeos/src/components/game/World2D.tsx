"use client";
/** Lightweight 2D map — used when WebGL is unavailable or the player prefers it. Same data, same interactions. */
import type { RegionId } from "@/lib/types";
import { REGIONS } from "@/lib/game/regions";
import type { RegionState } from "@/lib/game/engine";

export function World2D({ regions, selected, onSelect, level }: { regions: Record<RegionId, RegionState>; selected: RegionId | null; onSelect: (id: RegionId | null) => void; level: number }) {
  return (
    <svg viewBox="-200 -200 400 400" className="h-full w-full" role="img" aria-label="מפת העולם" onClick={() => onSelect(null)}>
      <defs>
        <radialGradient id="sea" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#2f6f93" />
          <stop offset="100%" stopColor="#0b1f33" />
        </radialGradient>
      </defs>
      <rect x="-200" y="-200" width="400" height="400" fill="url(#sea)" />
      <circle r="120" fill="none" stroke="#5fb0c9" strokeOpacity="0.25" strokeWidth="40" />
      {/* hub */}
      <circle r="34" fill="#d6c39a" />
      <circle r="30" fill="#7a9a6a" />
      <text y="5" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">רמה {level}</text>
      {REGIONS.map((r) => {
        const s = regions[r.id];
        const x = Math.sin(r.angle) * 120;
        const y = -Math.cos(r.angle) * 120;
        const sel = selected === r.id;
        return (
          <g
            key={r.id}
            transform={`translate(${x} ${y})`}
            role="button"
            tabIndex={0}
            aria-label={`${r.name}, שלב ${s.stage} מתוך 5`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(r.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelect(r.id);
            }}
            className="cursor-pointer outline-none"
          >
            <circle r={sel ? 46 : 42} fill="#d9c79d" />
            <circle r={sel ? 41 : 37} fill={s.stage ? r.color.ground : "#8d9187"} stroke={sel ? r.color.glow : "none"} strokeWidth="3" />
            {Array.from({ length: s.stage }).map((_, i) => (
              <rect key={i} x={-22 + i * 9} y={-8 - i * 2} width="7" height={10 + i * 4} fill={r.color.roof} rx="1" />
            ))}
            <text y="26" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" stroke="#0b1120" strokeWidth="3" paintOrder="stroke">
              {r.name}
            </text>
            {[0, 1, 2, 3, 4].map((i) => (
              <circle key={i} cx={-12 + i * 6} cy="-28" r="2.2" fill={i < s.stage ? "#f3d488" : "#ffffff55"} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
