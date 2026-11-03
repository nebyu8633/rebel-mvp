"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Play, ScrollText, X, Lock, Check, Map as MapIcon, Box, Swords, ChevronLeft } from "lucide-react";
import type { RegionId } from "@/lib/types";
import { useGame } from "@/lib/game/useGame";
import { useGameUI } from "@/lib/game/ui";
import { REGION_BY_ID, UNDEVELOPED } from "@/lib/game/regions";
import { taskRegion, taskXp } from "@/lib/game/engine";
import { formatHebDate } from "@/lib/dates";
import { useStore } from "@/lib/store/store";
import { cx } from "@/components/ui";
import { Avatar, GoldButton, RegionChip, StateChip, XpBar } from "./bits";
import { World2D } from "./World2D";

const World3D = dynamic(() => import("./World3D"), {
  ssr: false,
  loading: () => <WorldLoading />,
});

function WorldLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center text-sm text-slate-300">
        <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-amber-300/30 border-t-amber-300" />
        טוען את העולם…
      </div>
    </div>
  );
}

function detectWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function lowPowerDevice(): boolean {
  const n = navigator as Navigator & { deviceMemory?: number };
  return (n.hardwareConcurrency ?? 8) <= 4 || (n.deviceMemory ?? 8) <= 4 || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

class WorldBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.warn("3D world failed, using 2D map", e);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const MODE_KEY = "lifeos:world:mode";

export function WorldScreen() {
  const g = useGame();
  const loaded = useStore((s) => s.status === "ready");
  const [selected, setSelected] = useState<RegionId | null>(null);
  const [building, setBuilding] = useState<number | null>(null);
  const [gl, setGl] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [lowPower, setLowPower] = useState(false);
  const openFocus = useGameUI((s) => s.openFocus);
  const setGmOpen = useGameUI((s) => s.setGmOpen);

  useEffect(() => {
    setGl(detectWebGL());
    setLowPower(lowPowerDevice());
    try {
      if (localStorage.getItem(MODE_KEY) === "2d") setMode("2d");
    } catch {
      /* ignore */
    }
  }, []);
  const switchMode = (m: "3d" | "2d") => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  const select = (id: RegionId | null) => {
    setSelected(id);
    setBuilding(null);
  };
  const daily = g.challenges.find((c) => c.period === "daily" && !c.done) ?? g.challenges.find((c) => c.period === "daily");
  const main = g.mainQuest;
  const use3d = gl === true && mode === "3d";
  const totalStages = Object.values(g.regions).reduce((s, r) => s + r.stage, 0);

  const map2d = <World2D regions={g.regions} selected={selected} onSelect={select} level={g.level.level} />;

  return (
    <div className="relative h-[calc(100dvh-3.4rem-4.1rem)] w-full overflow-hidden bg-[#0b1120] lg:h-dvh" data-testid="world">
      {/* the world */}
      <div className="absolute inset-0" data-world-mode={use3d ? "3d" : gl === null ? "checking" : "2d"}>
        {gl === null ? (
          <WorldLoading />
        ) : use3d ? (
          <WorldBoundary fallback={map2d}>
            <World3D
              regions={g.regions}
              level={g.level.level}
              decorations={g.decorations}
              selected={selected}
              onSelect={select}
              onBuilding={(id, stage) => {
                setSelected(id);
                setBuilding(stage);
              }}
              lowPower={lowPower}
            />
          </WorldBoundary>
        ) : (
          map2d
        )}
      </div>

      {/* HUD: player */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <Link href="/character" className="glass pointer-events-auto flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2 shadow-xl" aria-label="הדמות שלי">
          <Avatar avatar={g.profile?.avatar} size={40} />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold">רמה <span className="ltr-nums">{g.level.level}</span></span>
              <span className="text-[11px] text-slate-400 ltr-nums">
                {g.level.into}/{g.level.need} XP
              </span>
            </div>
            <XpBar fraction={g.level.fraction} className="mt-1 w-32 sm:w-40" thin />
          </div>
        </Link>
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <button onClick={() => setGmOpen(true)} className="glass flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium shadow-xl" aria-label="מנהל המשחק">
            <ScrollText size={17} className="gold-text" />
            <span className="hidden sm:inline">מנהל המשחק</span>
          </button>
          <div className="glass hidden rounded-xl px-3 py-1.5 text-[11px] text-slate-300 sm:block">
            עונה {g.season.index} · {g.season.theme} · יום {g.season.day}/90
          </div>
        </div>
      </div>

      {/* view toggle */}
      {gl && (
        <div className="glass absolute end-3 top-[4.6rem] flex rounded-xl p-0.5 text-[11px] sm:top-[6.2rem]">
          <button onClick={() => switchMode("3d")} className={cx("flex items-center gap-1 rounded-lg px-2 py-1", mode === "3d" ? "bg-white/15 text-white" : "text-slate-400")} aria-pressed={mode === "3d"}>
            <Box size={12} /> תלת־ממד
          </button>
          <button onClick={() => switchMode("2d")} className={cx("flex items-center gap-1 rounded-lg px-2 py-1", mode === "2d" ? "bg-white/15 text-white" : "text-slate-400")} aria-pressed={mode === "2d"}>
            <MapIcon size={12} /> מפה
          </button>
        </div>
      )}
      {gl === false && <div className="glass absolute end-3 top-[4.6rem] rounded-xl px-2 py-1 text-[11px] text-slate-300">תצוגת מפה (אין תמיכה בתלת־ממד)</div>}

      {/* Bottom: mission or region */}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col items-stretch gap-2 lg:items-start">
        {selected ? (
          <RegionPanel id={selected} building={building} onClose={() => select(null)} g={g} />
        ) : (
          loaded && (
            <div className="glass animate-in pointer-events-auto w-full rounded-2xl p-3 shadow-2xl lg:max-w-md" data-testid="mission">
              <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wider text-amber-200/80">
                <span>המשימה הראשית</span>
                <span className="normal-case tracking-normal text-slate-400">
                  {totalStages}/30 ציוני דרך בעולם
                </span>
              </div>
              {main ? (
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold">{main.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                      <RegionChip id={taskRegion(g.db, main.task)} />
                      <span className="gold-text font-semibold ltr-nums">+{taskXp(g.db, main.task)} XP</span>
                      {main.task.evidence !== "none" && <span>· דורש הוכחה</span>}
                      {main.date && main.date < g.today && <span>· מיום קודם</span>}
                    </div>
                  </div>
                  <GoldButton onClick={() => openFocus(main.key)} className="pointer-events-auto shrink-0" data-testid="start-quest">
                    <Play size={16} fill="currentColor" /> START QUEST
                  </GoldButton>
                </div>
              ) : (
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-300">אין משימה פתוחה להיום.</span>
                  <Link href="/quests" className="pointer-events-auto flex items-center gap-1 text-sm font-semibold text-amber-200">
                    למפת המסעות <ChevronLeft size={15} />
                  </Link>
                </div>
              )}
              {daily && (
                <Link href="/challenges" className="mt-2.5 flex items-center gap-2 border-t border-white/10 pt-2 text-[12px] text-slate-300">
                  <Swords size={14} className="gold-text shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{daily.title}</span>
                  <span className={cx("ltr-nums", daily.done ? "text-emerald-300" : "text-slate-400")}>
                    {daily.progress}/{daily.target}
                  </span>
                </Link>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function RegionPanel({ id, building, onClose, g }: { id: RegionId; building: number | null; onClose: () => void; g: ReturnType<typeof useGame> }) {
  const def = REGION_BY_ID[id];
  const st = g.regions[id];
  const qs = g.quests.filter((q) => q.region === id);
  const active = qs.filter((q) => q.state !== "completed");
  const done = qs.filter((q) => q.state === "completed");
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (building) {
      list.current?.querySelector(`[data-stage="${building}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [building]);
  return (
    <section className="glass animate-sheet pointer-events-auto max-h-[52dvh] !bg-[#0d1322]/[0.93] w-full overflow-y-auto rounded-2xl p-4 shadow-2xl lg:max-h-[calc(100dvh-8rem)] lg:w-[24rem]" aria-label={def.name} data-testid="region-panel">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold" style={{ color: def.color.glow }}>
            {def.name}
          </h2>
          <p className="text-xs text-slate-400">
            {st.stage ? `שלב ${st.stage}/5 · ${def.stages[st.stage - 1].title}` : UNDEVELOPED}
          </p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10" aria-label="סגירה">
          <X size={18} />
        </button>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px] text-slate-400">
          <span className="ltr-nums">{st.xp} XP</span>
          <span>{st.next ? `עוד ${st.next - st.xp} XP לציון הבא` : "האזור מפותח במלואו"}</span>
        </div>
        <XpBar fraction={st.fraction} />
      </div>

      <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">ציוני דרך</h3>
      <ol ref={list} className="mt-1.5 space-y-1.5">
        {def.stages.map((s, i) => {
          const stage = i + 1;
          const built = stage <= st.stage;
          const unlock = st.unlocks.find((u) => u.stage === stage)?.event;
          const next = stage === st.stage + 1;
          return (
            <li
              key={stage}
              data-stage={stage}
              className={cx("flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-sm", building === stage ? "bg-white/12 ring-1 ring-amber-300/60" : "bg-white/[0.03]")}
            >
              <span className={cx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", built ? "bg-amber-300 text-stone-900" : "bg-white/10 text-slate-400")}>
                {built ? <Check size={12} strokeWidth={3} /> : <Lock size={11} />}
              </span>
              <div className="min-w-0">
                <div className={cx("font-medium", !built && "text-slate-400")}>{s.building}</div>
                {built && unlock && (
                  <div className="text-[11px] text-slate-400">
                    נפתח בזכות: <span className="text-slate-200">{unlock.title}</span> · {formatHebDate(unlock.at.slice(0, 10))}
                  </div>
                )}
                {next && st.next && <div className="text-[11px] text-slate-500">ייבנה ב-{st.next} XP באזור</div>}
              </div>
            </li>
          );
        })}
      </ol>

      <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">מסעות באזור</h3>
      {active.length === 0 && done.length === 0 ? (
        <p className="mt-1.5 text-sm text-slate-400">
          אין עדיין מסעות כאן.{" "}
          <Link href="/goals/new" className="font-semibold text-amber-200">
            מטרה חדשה
          </Link>
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {[...active, ...done].map((q) => (
            <li key={q.goal.id}>
              <Link href={`/quests#q-${q.goal.id}`} className="block rounded-xl bg-white/[0.03] px-2.5 py-2 hover:bg-white/[0.07]">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{q.goal.title}</span>
                  <StateChip state={q.state} />
                </div>
                {q.milestones.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <XpBar fraction={q.progress} thin className="flex-1" />
                    <span className="text-[11px] text-slate-400 ltr-nums">
                      {q.milestones.filter((m) => m.state === "completed").length}/{q.milestones.length}
                    </span>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
