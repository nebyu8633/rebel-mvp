"use client";
import { useEffect, useRef } from "react";
import { Sparkles, Trophy, Castle, Crown, Swords, Flag } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useToday } from "@/hooks/useToday";
import { runGameSync, useCelebrations, type Celebration } from "@/lib/game/sync";
import { playSound } from "@/lib/game/sound";
import { profileOf } from "@/lib/game/engine";

/** Keeps the ledger / milestones in sync with real data (debounced, idempotent) and queues celebrations. */
export function GameSync() {
  const db = useStore((s) => s.db);
  const ready = useStore((s) => s.status === "ready");
  const today = useToday();
  const push = useCelebrations((s) => s.push);
  const first = useRef(true);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(
      () => {
        const initial = first.current;
        first.current = false;
        void runGameSync(today).then((c) => {
          // on the very first sync after loading, don't replay old history as celebrations
          if (c.length && !initial) push(c);
        });
      },
      first.current ? 50 : 400,
    );
    return () => clearTimeout(t);
  }, [db, ready, today, push]);
  return null;
}

const ICON: Record<Celebration["kind"], typeof Sparkles> = {
  xp: Sparkles,
  level: Crown,
  achievement: Trophy,
  milestone: Flag,
  building: Castle,
  challenge: Swords,
};
const HEAD: Record<Celebration["kind"], string> = {
  xp: "",
  level: "עלית רמה!",
  achievement: "הישג חדש",
  milestone: "אבן דרך הושלמה",
  building: "ציון דרך חדש נבנה",
  challenge: "אתגר הושלם",
};

/** Full-screen moment for big events; a small floating chip for plain XP. */
export function CelebrationLayer() {
  const list = useCelebrations((s) => s.celebrations);
  const shift = useCelebrations((s) => s.shift);
  const sound = useStore((s) => profileOf(s.db)?.notify.sound ?? "chime");
  const c = list[0];
  useEffect(() => {
    if (!c) return;
    if (c.kind !== "xp") playSound(sound === "none" ? "none" : "fanfare");
    const t = setTimeout(shift, c.kind === "xp" ? 1700 : 3800);
    return () => clearTimeout(t);
  }, [c, shift, sound]);
  if (!c) return null;
  if (c.kind === "xp")
    return (
      <div className="pointer-events-none fixed inset-x-0 top-24 z-[70] flex justify-center" aria-live="polite">
        <div key={c.id} className="animate-float-up gold-btn rounded-full px-4 py-1.5 text-base font-bold ltr-nums">
          +{c.xp} XP
        </div>
      </div>
    );
  const Icon = ICON[c.kind];
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#05080f]/70 backdrop-blur-sm" role="alertdialog" aria-label={HEAD[c.kind]} onClick={shift}>
      <div key={c.id} className="animate-pop relative flex flex-col items-center px-8 text-center text-white">
        <div className="animate-rays pointer-events-none absolute -top-24 h-72 w-72 rounded-full opacity-60" style={{ background: "conic-gradient(from 0deg, transparent, rgba(243,212,136,.35), transparent 20%, rgba(243,212,136,.3), transparent 45%, rgba(243,212,136,.35), transparent 70%)" }} />
        <div className="gold-btn relative flex h-24 w-24 items-center justify-center rounded-full">
          <Icon size={46} strokeWidth={1.6} />
        </div>
        <div className="relative mt-5 text-xs uppercase tracking-[0.25em] text-amber-200">{HEAD[c.kind]}</div>
        <div className="relative mt-1 text-2xl font-bold">{c.title}</div>
        {c.detail && <div className="relative mt-1 text-sm text-slate-300">{c.detail}</div>}
        {c.xp ? <div className="gold-text relative mt-2 text-lg font-bold ltr-nums">+{c.xp} XP</div> : null}
        <div className="relative mt-6 text-[11px] text-slate-400">הקשה להמשך</div>
      </div>
    </div>
  );
}
