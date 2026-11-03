"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, X, ShieldCheck, Loader2, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useGameUI } from "@/lib/game/ui";
import { instanceFromKey, setInstanceStatus } from "@/lib/actions";
import { assessEvidence, decideEvidence, submitEvidence } from "@/lib/game/actions";
import { compressImage, evidenceFileUrl } from "@/lib/game/evidenceFiles";
import { latestEvidence, profileOf, taskXp } from "@/lib/game/engine";
import { EVIDENCE_LABEL, EVIDENCE_STATUS_LABEL } from "@/lib/game/evidence";
import type { Evidence } from "@/lib/types";
import { cx } from "@/components/ui";
import { GhostButton, GoldButton } from "./bits";

const VERDICT: Record<NonNullable<Evidence["aiVerdict"]>, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  likely: { label: "נראה רלוונטי", cls: "text-emerald-300", icon: CheckCircle2 },
  unclear: { label: "לא ברור", cls: "text-amber-300", icon: HelpCircle },
  unlikely: { label: "לא נראה קשור", cls: "text-rose-300", icon: AlertTriangle },
};

export function EvidenceHost() {
  const req = useGameUI((s) => s.evidence);
  const close = () => useGameUI.getState().openEvidence(null);
  if (!req) return null;
  return <EvidenceModal key={req.key} instanceKey={req.key} complete={req.complete} onClose={close} />;
}

function EvidenceModal({ instanceKey, complete, onClose }: { instanceKey: string; complete: boolean; onClose: () => void }) {
  const db = useStore((s) => s.db);
  const inst = instanceFromKey(db, instanceKey);
  const existing = latestEvidence(db, instanceKey);
  const [current, setCurrent] = useState<Evidence | null>(existing && existing.status !== "waiting" ? existing : null);
  const [file, setFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<null | "save" | "ai">(null);
  const [manualOk, setManualOk] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const live = current ? (db.evidence[current.id] ?? current) : null;

  useEffect(() => {
    let cancelled = false;
    if (live?.fileRef && !preview) {
      void evidenceFileUrl(live.fileRef).then((u) => {
        if (!cancelled && u) setPreview(u);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [live?.fileRef, preview]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!inst) return null;
  const t = inst.task;
  const wantsPhoto = t.evidence === "photo" || t.evidence === "document";
  const decided = live && (live.status === "accepted" || live.status === "manual");

  const pick = async (f: File | undefined) => {
    if (!f) return;
    try {
      const small = await compressImage(f);
      setFile(small);
      setPreview(URL.createObjectURL(small));
    } catch (e) {
      useStore.getState().toast(e instanceof Error ? e.message : "לא ניתן לקרוא את התמונה", "error");
    }
  };

  const ensureComplete = async () => {
    if (complete && inst.status !== "completed") await setInstanceStatus(inst, "completed");
  };

  const send = async () => {
    if (!file) return;
    setBusy("save");
    const ev = await submitEvidence(inst, { kind: t.evidence === "document" ? "document" : "photo", blob: file, note });
    if (!ev) return setBusy(null);
    await ensureComplete();
    setCurrent(ev);
    setFile(null);
    setBusy("ai");
    const assessed = await assessEvidence(ev, file, t.title, t.evidenceCriteria);
    setCurrent(assessed);
    setBusy(null);
  };

  const confirmManual = async () => {
    setBusy("save");
    if (live) await decideEvidence(live, "manual");
    else {
      const ev = await submitEvidence(inst, { kind: "manual", blob: null, note });
      if (!ev) return setBusy(null);
      setCurrent(ev);
    }
    await ensureComplete();
    setBusy(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="הוכחת ביצוע">
      <div className="absolute inset-0 bg-[#05080f]/70 backdrop-blur-sm" onClick={onClose} />
      <div className="game-bg animate-sheet relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-amber-200/15 p-5 shadow-2xl sm:max-w-md sm:rounded-3xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-amber-200/80">הוכחת ביצוע · {EVIDENCE_LABEL[t.evidence]}</div>
            <h2 className="mt-0.5 text-lg font-bold text-white">{inst.title}</h2>
            {t.evidenceCriteria && <p className="mt-1 text-sm text-slate-300">{t.evidenceCriteria}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10" aria-label="סגירה">
            <X size={18} />
          </button>
        </div>
        <p className="mt-2 text-[12px] text-slate-400">
          <span className="gold-text font-semibold ltr-nums">+{taskXp(t, profileOf(db))} XP</span> יתווספו אחרי שתאשר את ההוכחה. התמונות נשמרות באופן פרטי.
        </p>

        {live && (
          <div className="glass-soft mt-3 rounded-xl p-3 text-sm" data-testid="evidence-status">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">סטטוס</span>
              <span className="font-semibold text-white">{EVIDENCE_STATUS_LABEL[live.status]}</span>
            </div>
            {live.aiVerdict && (
              <div className={cx("mt-2 flex items-start gap-2", VERDICT[live.aiVerdict].cls)}>
                {(() => {
                  const I = VERDICT[live.aiVerdict].icon;
                  return <I size={16} className="mt-0.5 shrink-0" />;
                })()}
                <div>
                  <div className="font-semibold">{VERDICT[live.aiVerdict].label}</div>
                  {live.aiReason && <div className="text-slate-300">{live.aiReason}</div>}
                </div>
              </div>
            )}
            {!live.aiVerdict && live.aiReason && <div className="mt-2 text-slate-300">{live.aiReason}</div>}
            {(live.aiVerdict || live.status === "review" || live.status === "more") && <p className="mt-2 text-[11px] text-slate-500">זו הערכת רלוונטיות של AI בלבד — לא הוכחה. ההחלטה שלך.</p>}
          </div>
        )}

        {preview && (
          <div className="relative mt-3 overflow-hidden rounded-xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="תמונת ההוכחה" className="max-h-64 w-full object-cover" />
          </div>
        )}

        {busy === "ai" && (
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-300">
            <Loader2 size={16} className="animate-spin" /> בודק רלוונטיות…
          </div>
        )}

        {!decided && wantsPhoto && (!live || live.status === "more" || file) && (
          <div className="mt-4 space-y-3">
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} data-testid="evidence-camera" />
            <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} data-testid="evidence-file" />
            <div className="grid grid-cols-2 gap-2">
              <GhostButton onClick={() => camRef.current?.click()} className="py-3">
                <Camera size={18} /> צילום
              </GhostButton>
              <GhostButton onClick={() => galRef.current?.click()} className="py-3">
                <ImagePlus size={18} /> מהגלריה
              </GhostButton>
            </div>
            {t.evidence === "document" && <p className="text-[11px] text-slate-400">אפשר להסתיר מספרי חשבון או פרטים רגישים לפני הצילום.</p>}
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="הערה (לא חובה)" maxLength={300} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
            <GoldButton onClick={() => void send()} disabled={!file || !!busy} className="w-full" data-testid="evidence-send">
              {busy === "save" ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} שליחת הוכחה
            </GoldButton>
          </div>
        )}

        {!decided && live && (live.status === "review" || live.status === "submitted") && busy !== "ai" && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <GoldButton onClick={() => void decideEvidence(live, live.aiVerdict === "likely" ? "accepted" : "manual").then(onClose)} data-testid="evidence-accept">
              <ShieldCheck size={16} /> לאשר
            </GoldButton>
            <GhostButton onClick={() => void decideEvidence(live, "more")}>תמונה אחרת</GhostButton>
          </div>
        )}

        {!decided && (
          <div className="mt-4 border-t border-white/10 pt-3">
            <label className="flex items-start gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={manualOk} onChange={(e) => setManualOk(e.target.checked)} className="mt-1 accent-amber-400" data-testid="evidence-manual-check" />
              <span>{t.evidence === "manual" ? "אני מאשר שביצעתי את המשימה" : "אין לי הוכחה כרגע — אני מאשר ידנית שביצעתי"}</span>
            </label>
            <GhostButton onClick={() => void confirmManual()} disabled={!manualOk || !!busy} className="mt-2 w-full" data-testid="evidence-manual">
              אישור ידני
            </GhostButton>
          </div>
        )}

        {decided && (
          <div className="mt-4">
            <GoldButton onClick={onClose} className="w-full">
              סגירה
            </GoldButton>
          </div>
        )}
        {!decided && (
          <button onClick={onClose} className="mt-3 w-full text-center text-[12px] text-slate-500 hover:text-slate-300">
            אחר כך (ה-XP ימתין)
          </button>
        )}
      </div>
    </div>
  );
}
