"use client";
import { useEffect, useMemo, useState } from "react";
import { Trophy, Flag, Sparkles, Swords, Gift, Repeat, Check, ImageOff } from "lucide-react";
import { useGame } from "@/lib/game/useGame";
import { seasonSummary, SEASON_THEMES } from "@/lib/game/engine";
import { evidenceFileUrl } from "@/lib/game/evidenceFiles";
import { EVIDENCE_STATUS_LABEL } from "@/lib/game/evidence";
import { REGION_BY_ID } from "@/lib/game/regions";
import { addDays, formatHebDate, MONTHS_HE } from "@/lib/dates";
import type { Evidence, XpEvent } from "@/lib/types";
import { cx } from "@/components/ui";
import { GamePage, Panel } from "@/components/game/bits";

const KIND_ICON: Record<XpEvent["kind"], typeof Check> = { unlock: Sparkles, task: Check, occurrence: Repeat, milestone: Flag, goal: Trophy, habit: Repeat, achievement: Sparkles, challenge: Swords, chest: Gift };

export default function LegacyPage() {
  const g = useGame();
  const [tab, setTab] = useState<"timeline" | "evidence" | "seasons">("timeline");
  return (
    <GamePage title="מורשת" subtitle="כל מה שבנית. ההיסטוריה לא נמחקת.">
      <div className="flex gap-1.5" role="tablist">
        {(
          [
            ["timeline", "ציר זמן"],
            ["evidence", "הוכחות"],
            ["seasons", "עונות"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx("rounded-full px-3 py-1 text-sm", tab === k ? "bg-amber-300/15 font-semibold text-amber-100" : "text-slate-400 hover:bg-white/5")}>
            {l}
          </button>
        ))}
      </div>
      {tab === "timeline" && <Timeline ledger={g.ledger} />}
      {tab === "evidence" && <Gallery evidence={Object.values(g.db.evidence)} titles={(id) => g.db.tasks[id]?.title ?? "משימה שנמחקה"} />}
      {tab === "seasons" && <Seasons g={g} />}
    </GamePage>
  );
}

function Timeline({ ledger }: { ledger: XpEvent[] }) {
  const months = useMemo(() => {
    const sorted = ledger.slice().sort((a, b) => (a.at < b.at ? 1 : -1));
    const m = new Map<string, XpEvent[]>();
    for (const e of sorted) {
      const k = e.at.slice(0, 7);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()];
  }, [ledger]);
  if (!months.length) return <Panel className="text-sm text-slate-400">ציר הזמן יתמלא ברגע שתשלים את המשימה המאומתת הראשונה.</Panel>;
  return (
    <div className="space-y-5">
      {months.map(([k, evs]) => (
        <section key={k}>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">
            {MONTHS_HE[Number(k.slice(5, 7)) - 1]} {k.slice(0, 4)} <span className="text-slate-500 ltr-nums">· {evs.reduce((s, e) => s + e.amount, 0)} XP</span>
          </h2>
          <ol className="space-y-1">
            {evs.map((e) => {
              const I = KIND_ICON[e.kind];
              const big = e.kind === "milestone" || e.kind === "goal" || e.kind === "achievement";
              return (
                <li key={e.id} className={cx("flex items-center gap-3 rounded-xl px-3 py-2", big ? "bg-amber-300/10" : "bg-white/[0.03]")}>
                  <I size={15} className={big ? "gold-text" : "text-slate-500"} />
                  <span className="min-w-0 flex-1">
                    <span className={cx("block truncate text-sm", big ? "font-semibold text-amber-50" : "text-slate-200")}>{e.title}</span>
                    {e.detail && <span className="block truncate text-[11px] text-slate-500">{e.detail}</span>}
                  </span>
                  {e.region && <span className="hidden text-[11px] sm:inline" style={{ color: REGION_BY_ID[e.region].color.glow }}>{REGION_BY_ID[e.region].short}</span>}
                  <span className="text-[11px] text-slate-500">{formatHebDate(e.at.slice(0, 10))}</span>
                  <span className="gold-text w-12 text-end text-[12px] font-semibold ltr-nums">+{e.amount}</span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

function Thumb({ ev }: { ev: Evidence }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let off = false;
    if (ev.fileRef)
      void evidenceFileUrl(ev.fileRef)
        .then((u) => !off && (u ? setUrl(u) : setFailed(true)))
        .catch(() => !off && setFailed(true));
    return () => {
      off = true;
    };
  }, [ev.fileRef]);
  if (!ev.fileRef || failed)
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl bg-white/5 text-slate-600">
        <ImageOff size={22} />
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" loading="lazy" className="aspect-square w-full rounded-xl object-cover" /> : <div className="aspect-square animate-pulse rounded-xl bg-white/5" />;
}

function Gallery({ evidence, titles }: { evidence: Evidence[]; titles: (taskId: string) => string }) {
  const list = evidence.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (!list.length) return <Panel className="text-sm text-slate-400">הוכחות שתצרף למשימות יישמרו כאן באופן פרטי.</Panel>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {list.map((e) => (
        <li key={e.id}>
          {e.kind === "manual" ? (
            <div className="flex aspect-square items-center justify-center rounded-xl bg-white/5 text-[12px] text-slate-400">אישור ידני</div>
          ) : (
            <Thumb ev={e} />
          )}
          <div className="mt-1 truncate text-[12px] text-slate-200">{titles(e.taskId)}</div>
          <div className="text-[11px] text-slate-500">
            {formatHebDate(e.createdAt.slice(0, 10))} · {EVIDENCE_STATUS_LABEL[e.status]}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Seasons({ g }: { g: ReturnType<typeof useGame> }) {
  const seasons = [];
  const start0 = g.profile?.seasonStart ?? g.today;
  for (let i = 0; i < g.season.index; i++) {
    const start = addDays(start0, i * 90);
    const end = addDays(start, 89);
    seasons.push({ i: i + 1, start, end, theme: SEASON_THEMES[i % SEASON_THEMES.length], current: i + 1 === g.season.index, sum: seasonSummary(g.db, start, end) });
  }
  return (
    <div className="space-y-3">
      {seasons.reverse().map((s) => (
        <Panel key={s.i} data-testid="season">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-amber-200/80">עונה {s.i}{s.current ? " · נוכחית" : ""}</span>
              <h3 className="font-semibold text-white">{s.theme}</h3>
            </div>
            <span className="text-[12px] text-slate-400">
              {formatHebDate(s.start)} – {formatHebDate(s.end)}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              ["XP", s.sum.xp],
              ["משימות", s.sum.tasks],
              ["אבני דרך", s.sum.milestones.length],
              ["הישגים", s.sum.achievements.length],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-white/[0.04] py-2">
                <dd className="text-lg font-bold text-white ltr-nums">{v}</dd>
                <dt className="text-[11px] text-slate-400">{l}</dt>
              </div>
            ))}
          </dl>
          {s.sum.goals.length > 0 && <p className="mt-2 text-sm text-slate-300">מטרות שהושגו: {s.sum.goals.map((x) => x.title).join(", ")}</p>}
          {s.sum.needsAttention.length > 0 && <p className="mt-1 text-[12px] text-slate-400">אזורים שמחכים לתשומת לב: {s.sum.needsAttention.map((r) => REGION_BY_ID[r].name).join(", ")}</p>}
        </Panel>
      ))}
    </div>
  );
}
