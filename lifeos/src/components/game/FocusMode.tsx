"use client";
import { useEffect, useMemo, useState } from "react";
import { X, Play, Pause, RotateCcw, Camera, Check, Trophy, ChevronLeft } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useGameUI } from "@/lib/game/ui";
import { useToday } from "@/hooks/useToday";
import { instanceFromKey, setInstanceStatus, nowIso } from "@/lib/actions";
import { isVerified, mainQuestInstance, profileOf, regionStates, taskRegion, taskXp } from "@/lib/game/engine";
import { EVIDENCE_LABEL } from "@/lib/game/evidence";
import { REGION_BY_ID } from "@/lib/game/regions";
import { cx } from "@/components/ui";
import { GhostButton, GoldButton, RegionChip, XpBar } from "./bits";

export function FocusHost() {
  const key = useGameUI((s) => s.focusKey);
  if (!key) return null;
  return <FocusMode key={key} instanceKey={key} onClose={() => useGameUI.getState().openFocus(null)} />;
}

function stepsFrom(notes: string): string[] {
  return notes
    .split("\n")
    .map((l) => l.replace(/^\s*([-*•]|\[ ?\]|\d+[.)])\s*/, "").trim())
    .filter((l) => l.length > 1)
    .slice(0, 8);
}

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function FocusMode({ instanceKey, onClose }: { instanceKey: string; onClose: () => void }) {
  const db = useStore((s) => s.db);
  const today = useToday();
  const inst = instanceFromKey(db, instanceKey);
  const total = Math.max(5, inst?.task.estimatedMinutes ?? 25) * 60;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  const [checked, setChecked] = useState<number[]>([]);
  const [doneAt, setDoneAt] = useState<string | null>(null);
  const steps = useMemo(() => stepsFrom(inst?.notes ?? ""), [inst?.notes]);
  const regionBefore = useMemo(() => (inst ? regionStates(Object.values(db.xpEvents))[taskRegion(db, inst.task) ?? "mind"] : null), [inst?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((l) => (l <= 1 ? (setRunning(false), 0) : l - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!inst) return null;
  const t = inst.task;
  const region = taskRegion(db, t);
  const profile = profileOf(db);
  const xp = taskXp(db, t);
  const needsEvidence = t.evidence !== "none";

  const complete = async () => {
    setRunning(false);
    const ok = inst.status === "completed" ? true : await setInstanceStatus(inst, "completed");
    if (!ok) return;
    // calibration: remember how long it really took (only if the timer was used)
    const spent = Math.round((total - left) / 60);
    if (spent >= 1 && !inst.recurring) {
      const cur = useStore.getState().db.tasks[inst.task.id];
      if (cur) await useStore.getState().put("tasks", { ...cur, actualMinutes: Math.min(spent, 24 * 60), updatedAt: cur.updatedAt });
    }
    setDoneAt(nowIso());
    if (needsEvidence && !isVerified(useStore.getState().db, t, inst.key)) useGameUI.getState().openEvidence(inst.key, false);
  };

  return (
    <div className="game-bg fixed inset-0 z-[60] flex flex-col overflow-y-auto" role="dialog" aria-modal="true" aria-label="מצב מיקוד">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <span className="text-[11px] uppercase tracking-[0.25em] text-amber-200/80">{doneAt ? "המשימה הושלמה" : "מצב מיקוד"}</span>
        <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10" aria-label="יציאה ממצב מיקוד">
          <X size={20} />
        </button>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8">
        {doneAt ? (
          <Result instanceKey={instanceKey} doneAt={doneAt} regionBefore={regionBefore} today={today} onClose={onClose} />
        ) : (
          <>
            <h2 className="mt-2 text-2xl font-bold text-white">{inst.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-slate-400">
              <RegionChip id={region} />
              <span className="gold-text font-semibold ltr-nums">+{xp} XP</span>
              {needsEvidence && <span>· הוכחה: {EVIDENCE_LABEL[t.evidence]}</span>}
            </div>

            {/* timer */}
            <div className="relative mx-auto mt-8 flex h-56 w-56 items-center justify-center">
              <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="#e8c26a" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(1 - left / total) * 282.7} 282.7`} className="transition-[stroke-dasharray] duration-1000" />
              </svg>
              <div className="text-center">
                <div className="text-5xl font-bold tabular-nums text-white ltr-nums" data-testid="focus-timer">
                  {fmt(left)}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">{left === 0 ? "הזמן הסתיים" : running ? "בפוקוס" : "מוכן"}</div>
              </div>
            </div>
            <div className="mt-5 flex justify-center gap-2">
              <GhostButton onClick={() => setRunning((r) => !r)} className="min-w-28" data-testid="focus-toggle">
                {running ? <Pause size={16} /> : <Play size={16} />} {running ? "השהיה" : left < total ? "המשך" : "התחלה"}
              </GhostButton>
              <GhostButton
                onClick={() => {
                  setRunning(false);
                  setLeft(total);
                }}
                aria-label="איפוס טיימר"
              >
                <RotateCcw size={16} />
              </GhostButton>
            </div>

            {steps.length > 0 && (
              <ul className="mt-7 space-y-1.5">
                {steps.map((s, i) => {
                  const on = checked.includes(i);
                  return (
                    <li key={i}>
                      <button onClick={() => setChecked((c) => (on ? c.filter((x) => x !== i) : [...c, i]))} className="flex w-full items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 text-start text-sm">
                        <span className={cx("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", on ? "border-amber-300 bg-amber-300 text-stone-900" : "border-white/25")}>{on && <Check size={13} strokeWidth={3} />}</span>
                        <span className={cx(on ? "text-slate-500 line-through" : "text-slate-100")}>{s}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-auto space-y-2 pt-8">
              {needsEvidence && (t.evidence === "photo" || t.evidence === "document") && (
                <GhostButton onClick={() => useGameUI.getState().openEvidence(inst.key, true)} className="w-full py-3">
                  <Camera size={18} /> צילום הוכחה
                </GhostButton>
              )}
              <GoldButton onClick={() => void complete()} className="w-full py-3.5 text-base" data-testid="focus-complete">
                <Check size={18} strokeWidth={3} /> סיימתי
              </GoldButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Result({ instanceKey, doneAt, regionBefore, today, onClose }: { instanceKey: string; doneAt: string; regionBefore: ReturnType<typeof regionStates>[keyof ReturnType<typeof regionStates>] | null; today: string; onClose: () => void }) {
  const db = useStore((s) => s.db);
  const inst = instanceFromKey(db, instanceKey)!;
  const evId = inst.recurring ? `occ:${inst.key}` : `task:${inst.task.id}`;
  const ev = db.xpEvents[evId];
  const region = taskRegion(db, inst.task);
  const rs = region ? regionStates(Object.values(db.xpEvents))[region] : null;
  const newAch = Object.values(db.xpEvents).filter((e) => e.kind === "achievement" && e.createdAt >= doneAt);
  const next = mainQuestInstance(db, today);
  const pendingEvidence = !ev && inst.task.evidence !== "none";

  return (
    <div className="flex flex-1 flex-col items-center pt-6 text-center" data-testid="focus-result">
      <div className="animate-pop gold-btn flex h-24 w-24 items-center justify-center rounded-full">
        <Check size={48} strokeWidth={2.5} />
      </div>
      <h2 className="mt-5 text-2xl font-bold text-white">{inst.title}</h2>
      <div className="mt-3 text-3xl font-bold ltr-nums">
        {ev ? <span className="gold-text">+{ev.amount} XP</span> : pendingEvidence ? <span className="text-base font-medium text-violet-200">ה-XP ממתין לאישור ההוכחה</span> : <span className="text-base text-slate-400">מעדכן…</span>}
      </div>
      {rs && region && (
        <div className="mt-6 w-full text-start">
          <div className="mb-1 flex justify-between text-[12px] text-slate-400">
            <span>{REGION_BY_ID[region].name}</span>
            <span className="ltr-nums">
              {regionBefore?.xp ?? 0} → {rs.xp} XP
            </span>
          </div>
          <XpBar fraction={rs.fraction} />
          {regionBefore && rs.stage > regionBefore.stage && <div className="mt-2 text-sm text-amber-200">נבנה: {REGION_BY_ID[region].stages[rs.stage - 1].building}</div>}
        </div>
      )}
      {newAch.length > 0 && (
        <div className="mt-5 w-full space-y-1.5">
          {newAch.map((a) => (
            <div key={a.id} className="glass-soft flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
              <Trophy size={16} className="gold-text" /> הישג: {a.title}
            </div>
          ))}
        </div>
      )}
      <div className="mt-auto w-full space-y-2 pt-8">
        {next && next.key !== instanceKey ? (
          <>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">המסע הבא</div>
            <GoldButton onClick={() => useGameUI.getState().openFocus(next.key)} className="w-full py-3">
              {next.title} <ChevronLeft size={16} />
            </GoldButton>
          </>
        ) : (
          <div className="text-sm text-slate-400">אין עוד משימות פתוחות להיום.</div>
        )}
        <GhostButton onClick={onClose} className="w-full">
          חזרה לעולם
        </GhostButton>
      </div>
    </div>
  );
}
