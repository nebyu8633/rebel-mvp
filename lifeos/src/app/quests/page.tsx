"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Lock, Check, Play, Camera, ChevronDown, Gift, Plus } from "lucide-react";
import { useGame } from "@/lib/game/useGame";
import { useGameUI } from "@/lib/game/ui";
import { isVerified, latestEvidence, profileOf, taskXp, type Quest, type QuestState } from "@/lib/game/engine";
import { EVIDENCE_LABEL, EVIDENCE_STATUS_LABEL } from "@/lib/game/evidence";
import { REGIONS } from "@/lib/game/regions";
import { formatHebDate } from "@/lib/dates";
import { singleInstance } from "@/lib/tasks";
import type { DB, Task } from "@/lib/types";
import { cx } from "@/components/ui";
import { GamePage, GoldButton, Panel, RegionChip, StateChip, XpBar } from "@/components/game/bits";

const FILTERS: Array<[QuestState | "all", string]> = [
  ["all", "הכל"],
  ["active", "פעילים"],
  ["pending", "ממתינים"],
  ["available", "זמינים"],
  ["completed", "הושלמו"],
];

export default function QuestsPage() {
  const g = useGame();
  const [filter, setFilter] = useState<QuestState | "all">("all");
  const list = g.quests.filter((q) => filter === "all" || q.state === filter);
  const byRegion = useMemo(() => REGIONS.map((r) => ({ r, qs: list.filter((q) => q.region === r.id) })).filter((x) => x.qs.length), [list]);

  return (
    <GamePage
      title="מפת המסעות"
      subtitle="כל מטרה היא מסע: אבני דרך נפתחות אחת אחרי השנייה."
      actions={
        <Link href="/goals/new" className="gold-btn inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold">
          <Plus size={16} /> מסע חדש
        </Link>
      }
    >
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} role="tab" aria-selected={filter === k} className={cx("rounded-full px-3 py-1 text-sm", filter === k ? "bg-amber-300/15 font-semibold text-amber-100" : "text-slate-400 hover:bg-white/5")}>
            {l}
          </button>
        ))}
      </div>
      {g.quests.length === 0 ? (
        <Panel className="py-10 text-center">
          <p className="text-slate-300">עדיין אין מסעות. מסע מתחיל ממטרה אמיתית.</p>
          <Link href="/goals/new" className="mt-3 inline-block font-semibold text-amber-200">
            יצירת מטרה ראשונה
          </Link>
        </Panel>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-400">אין מסעות במצב הזה.</p>
      ) : (
        byRegion.map(({ r, qs }) => (
          <section key={r.id} className="space-y-2">
            <h2 className="text-sm font-semibold" style={{ color: r.color.glow }}>
              {r.name}
            </h2>
            {qs.map((q) => (
              <QuestCard key={q.goal.id} q={q} db={g.db} />
            ))}
          </section>
        ))
      )}
    </GamePage>
  );
}

function QuestCard({ q, db }: { q: Quest; db: DB }) {
  const [open, setOpen] = useState(q.state === "active" || q.state === "pending");
  const loose = Object.values(db.tasks).filter((t) => t.goalId === q.goal.id && !t.milestoneId && !t.recurrence);
  const routines = Object.values(db.tasks).filter((t) => t.goalId === q.goal.id && t.recurrence && !t.recurrence.paused);
  return (
    <Panel id={`q-${q.goal.id}`} className="scroll-mt-20 p-0">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-4 text-start" aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">{q.goal.title}</span>
            <StateChip state={q.state} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <XpBar fraction={q.progress} thin className="max-w-56 flex-1" />
            <span className="text-[11px] text-slate-400 ltr-nums">
              {q.milestones.filter((m) => m.state === "completed").length}/{q.milestones.length} אבני דרך
            </span>
          </div>
        </div>
        <ChevronDown size={18} className={cx("shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3">
          {q.milestones.length === 0 && loose.length === 0 && routines.length === 0 && (
            <p className="text-sm text-slate-400">
              למסע הזה אין עדיין תוכנית.{" "}
              <Link href={`/goals/${q.goal.id}/plan`} className="font-semibold text-amber-200">
                לבנות תוכנית
              </Link>
            </p>
          )}
          <ol className="relative space-y-3 border-s border-white/10 ps-4">
            {q.milestones.map((m, i) => (
              <li key={m.milestone.id} className="relative">
                <span className={cx("absolute -start-[1.4rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full", m.state === "completed" ? "bg-amber-300 text-stone-900" : m.state === "locked" ? "bg-[#1b2336] text-slate-500" : "bg-sky-400/20 text-sky-200")}>
                  {m.state === "completed" ? <Check size={12} strokeWidth={3} /> : m.state === "locked" ? <Lock size={10} /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cx("text-sm font-medium", m.state === "locked" ? "text-slate-500" : "text-slate-100")}>{m.milestone.title}</span>
                  <StateChip state={m.state} />
                  {m.milestone.targetDate && <span className="text-[11px] text-slate-500">עד {formatHebDate(m.milestone.targetDate)}</span>}
                  {m.state === "completed" && (
                    <Link href="/rewards#chests" className="inline-flex items-center gap-1 text-[11px] text-amber-200">
                      <Gift size={12} /> תיבת אוצר
                    </Link>
                  )}
                </div>
                {m.state === "locked" ? (
                  <p className="mt-1 text-[12px] text-slate-500">ייפתח אחרי השלמת אבן הדרך הקודמת.</p>
                ) : (
                  m.tasks.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {m.tasks.map((t) => (
                        <TaskLine key={t.id} t={t} db={db} />
                      ))}
                    </ul>
                  )
                )}
              </li>
            ))}
          </ol>
          {loose.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {loose.map((t) => (
                <TaskLine key={t.id} t={t} db={db} />
              ))}
            </ul>
          )}
          {routines.length > 0 && (
            <p className="mt-3 text-[12px] text-slate-400">שגרות קבועות: {routines.map((t) => t.title).join(" · ")}</p>
          )}
          <div className="mt-3 flex gap-3 text-[12px]">
            <Link href={`/goals/${q.goal.id}`} className="text-slate-400 hover:text-slate-200">
              פרטי המטרה
            </Link>
            <RegionChip id={q.region} />
          </div>
        </div>
      )}
    </Panel>
  );
}

function TaskLine({ t, db }: { t: Task; db: DB }) {
  const done = t.status === "completed";
  const verified = isVerified(db, t, t.id);
  const ev = latestEvidence(db, t.id);
  const openFocus = useGameUI((s) => s.openFocus);
  const openEvidence = useGameUI((s) => s.openEvidence);
  return (
    <li className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
      <span className={cx("flex h-4 w-4 shrink-0 items-center justify-center rounded border", done && verified ? "border-emerald-400 bg-emerald-400 text-stone-900" : done ? "border-violet-300 text-violet-300" : t.status === "skipped" ? "border-slate-600" : "border-white/25")}>
        {done && <Check size={11} strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className={cx("truncate", done ? "text-slate-400" : "text-slate-100", t.status === "skipped" && "line-through")}>{t.title}</div>
        <div className="flex flex-wrap gap-x-2 text-[11px] text-slate-500">
          <span className="gold-text ltr-nums">+{taskXp(t, profileOf(db))} XP</span>
          {(t.date || t.deadline) && <span>{formatHebDate((t.date ?? t.deadline)!)}</span>}
          {t.evidence !== "none" && <span>הוכחה: {EVIDENCE_LABEL[t.evidence]}{ev ? ` · ${EVIDENCE_STATUS_LABEL[ev.status]}` : done ? " · ממתין" : ""}</span>}
        </div>
      </div>
      {done && !verified ? (
        <button onClick={() => openEvidence(t.id, false)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-violet-200 hover:bg-white/5">
          <Camera size={14} /> הוכחה
        </button>
      ) : (
        !done &&
        t.status !== "skipped" && (
          <GoldButton onClick={() => openFocus(singleInstance(t).key)} className="px-2.5 py-1 text-[12px]" aria-label={`להתחיל: ${t.title}`}>
            <Play size={12} fill="currentColor" />
          </GoldButton>
        )
      )}
    </li>
  );
}
