"use client";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import type { GameProfile, RegionId } from "@/lib/types";
import { REGION_BY_ID } from "@/lib/game/regions";
import type { QuestState } from "@/lib/game/engine";

export const SKINS = ["#f6d7bf", "#eac09a", "#d39e74", "#b07850", "#8a5a3a", "#5e3b26"];
export const OUTFITS = ["#2f4f9e", "#6b2f3a", "#2f6b4f", "#4a3f6b", "#3a3f48", "#7a5a22"];
export const ACCENTS = ["#d4a73c", "#c0c6cf", "#c96f4a", "#53b3c9", "#9b7fd1", "#e86f8b"];
export const EMBLEMS = ["⚔️", "🛡️", "🧭", "📜", "🌙", "🔥"];
export const EMBLEM_NAMES = ["חרב", "מגן", "מצפן", "מגילה", "ירח", "להבה"];

export function Avatar({ avatar, size = 44, level }: { avatar: GameProfile["avatar"] | undefined; size?: number; level?: number }) {
  const a = avatar ?? { skin: 2, outfit: 0, accent: 0, emblem: 0 };
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
        <circle cx="32" cy="32" r="31" fill="#121a2e" stroke={ACCENTS[a.accent]} strokeWidth="2" />
        <path d="M10 60c2-13 11-19 22-19s20 6 22 19" fill={OUTFITS[a.outfit]} />
        <path d="M24 44l8 8 8-8" fill="none" stroke={ACCENTS[a.accent]} strokeWidth="2.5" />
        <circle cx="32" cy="27" r="11" fill={SKINS[a.skin]} />
        <path d="M21 25c1-8 6-11 11-11s10 3 11 11c-3-3-7-5-11-5s-8 2-11 5z" fill="#2a1d14" />
      </svg>
      <span className="absolute -bottom-1 -start-1 text-[13px] leading-none" style={{ fontSize: size * 0.3 }}>
        {EMBLEMS[a.emblem]}
      </span>
      {level != null && (
        <span className="gold-btn absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ltr-nums">{level}</span>
      )}
    </div>
  );
}

export function XpBar({ fraction, className, thin }: { fraction: number; className?: string; thin?: boolean }) {
  return (
    <div className={cx("overflow-hidden rounded-full bg-white/10", thin ? "h-1.5" : "h-2", className)} role="progressbar" aria-valuenow={Math.round(fraction * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="xp-bar h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }} />
    </div>
  );
}

export function RegionChip({ id, className }: { id: RegionId | null; className?: string }) {
  if (!id) return null;
  const r = REGION_BY_ID[id];
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", className)} style={{ background: r.color.accent + "26", color: r.color.glow }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color.accent }} />
      {r.name}
    </span>
  );
}

export const STATE_LABEL: Record<QuestState, string> = {
  locked: "נעול",
  available: "זמין",
  active: "פעיל",
  pending: "ממתין לאימות",
  completed: "הושלם",
};
const STATE_CLS: Record<QuestState, string> = {
  locked: "bg-white/5 text-slate-400",
  available: "bg-sky-400/15 text-sky-200",
  active: "bg-amber-400/15 text-amber-200",
  pending: "bg-violet-400/15 text-violet-200",
  completed: "bg-emerald-400/15 text-emerald-200",
};
export function StateChip({ state, className }: { state: QuestState; className?: string }) {
  return <span className={cx("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", STATE_CLS[state], className)}>{STATE_LABEL[state]}</span>;
}

export function GamePage({ title, subtitle, actions, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <header className="animate-in flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}

export function Panel({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("glass-soft rounded-2xl p-4", className)} {...p}>
      {children}
    </div>
  );
}

export function GoldButton({ className, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cx("gold-btn inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold tracking-wide active:scale-[0.98]", className)} {...p}>
      {children}
    </button>
  );
}

export function GhostButton({ className, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cx("inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 hover:bg-white/10 disabled:opacity-50", className)} {...p}>
      {children}
    </button>
  );
}
