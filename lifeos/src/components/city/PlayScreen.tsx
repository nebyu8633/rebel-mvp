"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Eye, Gauge, Copy, X, Building2 } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { splitProgress } from "@/game-core/progression/split";
import { hallState, HALL } from "@/game-core/world/city";
import { cx } from "@/components/ui";
import type { AvatarInfo, BenchStats, Controls } from "./City3D";

const City3D = dynamic(() => import("./City3D"), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-slate-300">טוען את העיר…</div> });

function detectWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function PlayScreen() {
  const db = useStore((s) => s.db);
  const mode = useStore((s) => s.mode);
  const split = useMemo(() => splitProgress(Object.values(db.xpEvents ?? {})), [db.xpEvents]);
  const hall = hallState(split.lifeByDomain.knowledge);
  const controls = useRef<Controls>({ move: { x: 0, z: 0 }, yawDelta: 0 });
  const [info, setInfo] = useState<AvatarInfo>({ x: 0, z: 0, nearHall: false });
  const [preview, setPreview] = useState<number | null>(null);
  const [touch, setTouch] = useState(false);
  const [gl, setGl] = useState<boolean | null>(null);
  const [bench, setBench] = useState(false);
  const [stats, setStats] = useState<BenchStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [explain, setExplain] = useState(false);

  useEffect(() => {
    setGl(detectWebGL());
    setTouch(window.matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && !window.matchMedia("(hover: hover)").matches));
    setBench(new URLSearchParams(location.search).get("bench") === "1");
  }, []);

  // keyboard: WASD / arrows move, Q/E turn the camera (physical keys → works with a Hebrew layout)
  useEffect(() => {
    const keys = new Set<string>();
    const apply = () => {
      const has = (...k: string[]) => k.some((x) => keys.has(x));
      controls.current.move = { x: (has("KeyD", "ArrowRight") ? 1 : 0) - (has("KeyA", "ArrowLeft") ? 1 : 0), z: (has("KeyW", "ArrowUp") ? 1 : 0) - (has("KeyS", "ArrowDown") ? 1 : 0) };
    };
    let raf = 0;
    const turn = () => {
      if (keys.has("KeyQ")) controls.current.yawDelta += 0.035;
      if (keys.has("KeyE")) controls.current.yawDelta -= 0.035;
      raf = requestAnimationFrame(turn);
    };
    raf = requestAnimationFrame(turn);
    const down = (e: KeyboardEvent) => {
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
      keys.add(e.code);
      apply();
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.code);
      apply();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // drag to turn the camera (mouse anywhere; on touch the right half of the screen)
  const drag = useRef<{ id: number; x: number } | null>(null);

  const copyReport = async () => {
    if (!stats) return;
    const report = { ...stats, ua: navigator.userAgent, screen: `${screen.width}x${screen.height}`, at: new Date().toISOString(), scene: "city-phase1" };
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the numbers are on screen */
    }
  };

  return (
    <div
      className="relative h-[calc(100dvh-3.4rem-4.1rem)] w-full touch-none select-none overflow-hidden bg-[#0b1120] lg:h-dvh"
      data-testid="play"
      data-pos={`${info.x.toFixed(2)},${info.z.toFixed(2)}`}
      data-near-hall={info.nearHall ? "1" : "0"}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" || e.clientX > window.innerWidth / 2) drag.current = { id: e.pointerId, x: e.clientX };
      }}
      onPointerMove={(e) => {
        if (drag.current?.id !== e.pointerId) return;
        controls.current.yawDelta -= (e.clientX - drag.current.x) * 0.006;
        drag.current.x = e.clientX;
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      {gl === false ? (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">המכשיר הזה לא תומך בתלת־ממד (WebGL), ולכן העיר לא זמינה כאן.</div>
      ) : gl ? (
        <City3D hallTier={hall.tier} previewTier={preview} controls={controls} onInfo={setInfo} onStats={bench ? setStats : undefined} />
      ) : null}

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <Link href="/" className="glass pointer-events-auto flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm" onPointerDown={(e) => e.stopPropagation()}>
          <ArrowRight size={15} /> לעולם הקיים
        </Link>
        <div className="glass pointer-events-auto w-48 rounded-2xl p-2.5 text-white lg:w-60 lg:p-3" data-testid="progress-panel" onPointerDown={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between text-[11px] text-amber-200/80">
            <span>העיר החדשה · ניסוי</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">תצוגה בלבד</span>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-white/5 py-1.5">
              <dd className="text-lg font-bold ltr-nums" data-testid="life-xp">
                {split.lifeXp}
              </dd>
              <dt className="text-[10px] text-slate-400">Life XP</dt>
            </div>
            <div className="rounded-xl bg-white/5 py-1.5">
              <dd className="text-lg font-bold ltr-nums" data-testid="world-progress">
                {split.worldProgress}
              </dd>
              <dt className="text-[10px] text-slate-400">World Progress</dt>
            </div>
          </dl>
          <button onClick={() => setExplain((x) => !x)} className="mt-1.5 text-[10px] text-slate-400 underline-offset-2 hover:underline lg:hidden" aria-expanded={explain}>
            {explain ? "פחות" : "מה ההבדל?"}
          </button>
          <div className={cx(explain ? "block" : "hidden", "lg:block")}>
            <p className="mt-2 text-[10px] leading-snug text-slate-400">Life XP — רק ממשימות, הרגלים, אבני דרך ומטרות שאישרת ב-LifeOS. World Progress — הישגים, אתגרים ותיבות במשחק. אין מעבר ביניהם.</p>
            {mode !== "supabase" && <p className="mt-1 text-[10px] text-amber-300/80">מצב מקומי: צפייה בלבד. התקדמות קבועה בעיר תדרוש חשבון ענן.</p>}
          </div>
        </div>
      </div>

      {/* the building: under the top bar on phones (the joystick owns the bottom-left), bottom-left on desktop */}
      <div className="pointer-events-none absolute inset-x-3 top-[8.5rem] flex justify-center lg:inset-x-auto lg:bottom-16 lg:start-3 lg:top-auto">
        {info.nearHall && (
          <div className="glass animate-in pointer-events-auto w-full max-w-sm rounded-2xl p-3 text-white" data-testid="hall-panel" onPointerDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Building2 size={16} className="gold-text" />
              <span className="font-semibold">{HALL.name}</span>
              <span className="text-xs text-slate-400">· {hall.current.title}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="xp-bar h-full" style={{ width: `${hall.fraction * 100}%` }} />
            </div>
            <p className="mt-1.5 text-[12px] text-slate-300">
              {hall.next ? (
                <>
                  השלב הבא — <b>{hall.next.title}</b> — ב-<span className="ltr-nums">{hall.next.needXp}</span> Life XP בתחום הידע (כרגע <span className="ltr-nums">{hall.xp}</span>).
                </>
              ) : (
                "האולם בנוי במלואו."
              )}
            </p>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col items-center gap-2 lg:items-start">
        <div className="glass pointer-events-auto flex items-center gap-1 rounded-2xl p-1 text-xs text-white" data-testid="preview-bar" onPointerDown={(e) => e.stopPropagation()}>
          <Eye size={14} className="mx-1.5 text-slate-400" />
          <span className="me-1 text-slate-400">הדמיה:</span>
          {HALL.tiers.map((t) => (
            <button
              key={t.tier}
              onClick={() => setPreview(t.tier === hall.tier ? null : t.tier)}
              className={cx("rounded-xl px-2 py-1", (preview ?? hall.tier) === t.tier ? "bg-white/15 font-semibold" : "text-slate-300 hover:bg-white/10")}
              aria-pressed={(preview ?? hall.tier) === t.tier}
            >
              {t.tier === hall.tier ? "עכשיו" : t.title}
            </button>
          ))}
        </div>
        {preview != null && preview !== hall.tier && <div className="glass rounded-xl px-3 py-1.5 text-[11px] text-amber-200">הדמיה אפשרית בלבד — לא הבטחה. המבנה המוצג {preview > hall.tier ? "עוד לא נבנה" : "הוא שלב קודם"}.</div>}
      </div>

      {/* mobile joystick */}
      {touch && <Joystick controls={controls} />}
      {!touch && <div className="pointer-events-none absolute bottom-3 end-3 hidden text-[10px] text-slate-400 lg:block">WASD לתנועה · גרירה או Q/E לסיבוב המצלמה</div>}

      {/* performance overlay: ?bench=1 */}
      {bench && (
        <div className="glass absolute bottom-24 right-3 w-52 rounded-xl p-2.5 text-[11px] text-slate-200 ltr-nums lg:bottom-auto lg:top-[9.5rem] lg:w-56" dir="ltr" data-testid="bench" onPointerDown={(e) => e.stopPropagation()}>
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1 font-semibold">
              <Gauge size={13} /> Performance
            </span>
            <button onClick={() => setBench(false)} aria-label="close">
              <X size={13} />
            </button>
          </div>
          {stats ? (
            <>
              <div>
                FPS {stats.fps} · p95 {stats.p95ms}ms
              </div>
              <div>
                calls {stats.calls} · tris {stats.triangles.toLocaleString()}
              </div>
              <div>
                geo {stats.geometries} · tex {stats.textures} · heap {stats.heapMB ?? "n/a"}MB
              </div>
              <div>
                quality {stats.quality} · dpr {stats.dpr}
              </div>
              <div className="truncate text-slate-400" title={stats.renderer}>
                {stats.renderer}
              </div>
              <button onClick={() => void copyReport()} className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg bg-white/10 py-1 hover:bg-white/15">
                <Copy size={12} /> {copied ? "Copied" : "Copy report"}
              </button>
            </>
          ) : (
            <div className="text-slate-400">measuring…</div>
          )}
        </div>
      )}
    </div>
  );
}

function Joystick({ controls }: { controls: React.MutableRefObject<Controls> }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const id = useRef<number | null>(null);
  const move = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2;
    const l = Math.hypot(dx, dy);
    if (l > max) {
      dx = (dx / l) * max;
      dy = (dy / l) * max;
    }
    setKnob({ x: dx, y: dy });
    controls.current.move = { x: dx / max, z: -dy / max };
  };
  const end = () => {
    id.current = null;
    setKnob({ x: 0, y: 0 });
    controls.current.move = { x: 0, z: 0 };
  };
  return (
    <div
      ref={base}
      className="absolute bottom-20 left-5 h-32 w-32 rounded-full border border-white/20 bg-white/5"
      data-testid="joystick"
      onPointerDown={(e) => {
        e.stopPropagation();
        id.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={(e) => id.current === e.pointerId && move(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full bg-white/25 shadow-lg" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
    </div>
  );
}
