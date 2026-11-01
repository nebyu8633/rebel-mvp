"use client";
import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, FileText, Pencil, Send, Sparkles, RotateCcw, ListChecks, X } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useToday } from "@/hooks/useToday";
import { aiConfigured } from "@/lib/ai/client";
import {
  aiTurn,
  answerPending,
  approvedOf,
  buildDraft,
  BUILD_KEY,
  confirmFact,
  currentStage,
  draftOf,
  editFact,
  ensureConversation,
  factsOf,
  freeText,
  handleSplit,
  KIND_LABEL,
  skipPending,
  SPLIT_KEY,
  switchToAI,
  switchToBasic,
  type TurnResult,
} from "@/lib/goalplan/session";
import { missingCritical, STAGES } from "@/lib/goalplan/interview";
import type { FactKind } from "@/lib/goalplan/schema";
import { Badge, Button, Card, EmptyState, Input, Spinner, cx } from "@/components/ui";
import { QuestionCard, type QuestionAnswer } from "@/components/goalchat/QuestionCard";

export const FACT_KIND: Record<FactKind, { label: string; tone: "accent" | "amber" | "stone" | "indigo" }> = {
  confirmed: { label: "אושר", tone: "accent" },
  estimate: { label: "הערכה", tone: "amber" },
  assumption: { label: "הנחה", tone: "stone" },
  recommendation: { label: "המלצה", tone: "indigo" },
};

export default function GoalChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useStore((s) => s.db);
  const today = useToday();
  const router = useRouter();
  const goal = db.goals[id];
  const conv = db.conversations[id];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; retry?: () => Promise<TurnResult> } | null>(null);
  const [text, setText] = useState("");
  const [ai, setAi] = useState<boolean | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    aiConfigured().then(setAi);
  }, []);
  useEffect(() => {
    if (goal && !conv && ai != null) void ensureConversation(goal, today, ai ? "ai" : "basic");
  }, [goal, conv, ai, today]);

  const messages = useMemo(
    () => Object.values(db.messages).filter((m) => m.goalId === id).sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0)),
    [db.messages, id],
  );
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy]);

  if (!goal) return <EmptyState title="המטרה לא נמצאה" action={<Link href="/goals" className="text-accent-700">למטרות</Link>} />;
  if (!conv)
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-stone-500">
        <Spinner /> פותח שיחה…
      </div>
    );

  const facts = factsOf(db, id);
  const stage = currentStage(db, id);
  const draft = draftOf(db, id);
  const approved = approvedOf(db, id);
  const pending = conv.pending;
  const lastAssistantWithQ = [...messages].reverse().find((m) => m.role === "assistant" && m.question);
  const missing = missingCritical(goal.kind, facts);

  async function run(fn: () => Promise<TurnResult>) {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      if (!r.ok) setError({ text: r.error, retry: r.retryable ? fn : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function answer(a: QuestionAnswer) {
    if (!pending) return;
    if (pending.key === SPLIT_KEY) {
      const sel = Array.isArray(a.value) ? (a.value as string[]) : [];
      return run(async () => {
        const r = await handleSplit(id, sel, today);
        return r;
      });
    }
    return run(() => answerPending(id, a.value, { estimate: a.estimate, today }));
  }

  async function send() {
    const t = text.trim();
    if (!t) return;
    setText("");
    if (conv!.mode === "ai" && ai) {
      const fn = () => aiTurn(id, t, today);
      setBusy(true);
      setError(null);
      const r = await fn();
      setBusy(false);
      // retry must not re-save the user's message
      if (!r.ok) setError({ text: r.error, retry: r.retryable ? () => aiTurn(id, t, today, { persistUser: false }) : undefined });
      return;
    }
    return run(() => freeText(id, t, today));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/goals/${id}`} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
          <ArrowRight size={14} /> {goal.title}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{KIND_LABEL[goal.kind]}</Badge>
          <Badge tone={conv.mode === "ai" ? "indigo" : "stone"}>{conv.mode === "ai" ? "AI" : "מנוע בסיסי"}</Badge>
          {conv.mode === "basic" && ai && (
            <Button size="sm" variant="ghost" onClick={() => void switchToAI(id)}>
              <Sparkles size={14} /> מעבר ל-AI
            </Button>
          )}
          {(draft || approved) && (
            <Button size="sm" variant="primary" onClick={() => router.push(`/goals/${id}/plan`)}>
              <FileText size={14} /> {draft ? "לטיוטת התוכנית" : "לתוכנית הפעילה"}
            </Button>
          )}
        </div>
      </div>

      <Stepper stage={stage} phase={conv.phase} />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="flex min-h-[60dvh] flex-col p-3 sm:p-4">
          <div className="flex-1 space-y-3" aria-live="polite">
            {messages.map((m) => {
              const isActiveQ = !!(m.question && pending && lastAssistantWithQ?.id === m.id && pending.key === m.question.key);
              if (m.role === "system")
                return (
                  <div key={m.id} className="flex justify-center">
                    <span className="rounded-full bg-accent-50 px-3 py-1 text-xs text-accent-800 dark:bg-accent-800/20 dark:text-accent-100">{m.text}</span>
                  </div>
                );
              return (
                <div key={m.id} className={cx("flex", m.role === "user" ? "justify-start" : "justify-end")}>
                  <div className={cx("max-w-[92%] sm:max-w-[80%]", m.role === "user" ? "" : "w-full sm:w-auto")}>
                    <div
                      className={cx(
                        "whitespace-pre-line rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                        m.role === "user" ? "bg-accent-600 text-white" : "bg-stone-100 text-stone-800 dark:bg-white/5 dark:text-stone-100",
                      )}
                    >
                      {m.text}
                    </div>
                    {isActiveQ && m.question!.key === BUILD_KEY && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button variant="primary" disabled={busy} onClick={() => run(() => buildDraft(id, { today }))}>
                          {busy ? <Spinner /> : <Sparkles size={16} />} {m.question!.options[0]?.label}
                        </Button>
                      </div>
                    )}
                    {isActiveQ && m.question!.key !== BUILD_KEY && (
                      <QuestionCard key={m.id} q={m.question!} today={today} busy={busy} error={error?.text ?? null} onAnswer={answer} onSkip={() => void run(() => skipPending(id))} />
                    )}
                  </div>
                </div>
              );
            })}
            {busy && (
              <div className="flex justify-end">
                <span className="flex items-center gap-2 rounded-2xl bg-stone-100 px-4 py-2.5 text-sm text-stone-500 dark:bg-white/5">
                  <Spinner /> {conv.mode === "ai" ? "חושב…" : "שומר…"}
                </span>
              </div>
            )}
            {error && !(pending && lastAssistantWithQ) && (
              <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-900/20 dark:text-rose-200">
                {error.text}
                <div className="mt-2 flex flex-wrap gap-2">
                  {error.retry && (
                    <Button size="sm" onClick={() => run(error.retry!)}>
                      <RotateCcw size={14} /> ניסיון חוזר
                    </Button>
                  )}
                  {conv.mode === "ai" && (
                    <Button size="sm" onClick={() => run(async () => ((await switchToBasic(id)) ? { ok: true } : { ok: false, error: "שגיאה" }))}>
                      המשך עם המנוע הבסיסי
                    </Button>
                  )}
                </div>
              </div>
            )}
            {draft && conv.phase !== "discovery" && !pending && (
              <div className="flex justify-end">
                <Link href={`/goals/${id}/plan`} className="inline-flex items-center gap-1.5 rounded-xl border border-accent-300 px-3 py-2 text-sm font-medium text-accent-800 hover:bg-accent-50 dark:text-accent-100">
                  <FileText size={15} /> פתיחת טיוטת התוכנית (גרסה {draft.version})
                </Link>
              </div>
            )}
            <div ref={end} />
          </div>
          <form
            className="mt-3 flex gap-2 border-t hairline pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={pending ? "או כתבו תשובה משלכם…" : conv.phase === "discovery" ? "כתבו הודעה…" : "מה לשנות בתוכנית?"}
              aria-label="הודעה"
              maxLength={2000}
            />
            <Button type="submit" variant="primary" disabled={busy || !text.trim()} aria-label="שליחה">
              <Send size={16} />
            </Button>
            <Button className="lg:hidden" variant="ghost" aria-label="סיכום התשובות" onClick={() => setSummaryOpen(true)}>
              <ListChecks size={18} />
            </Button>
          </form>
        </Card>

        <aside className={cx("lg:block", summaryOpen ? "fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)] p-4 lg:static lg:bg-transparent lg:p-0" : "hidden")}>
          <div className="mb-2 flex items-center justify-between lg:hidden">
            <span className="font-semibold">סיכום התשובות</span>
            <Button variant="ghost" size="icon" aria-label="סגירה" onClick={() => setSummaryOpen(false)}>
              <X size={18} />
            </Button>
          </div>
          <Summary goalId={id} busy={busy} missing={missing} onEdit={(k) => { setSummaryOpen(false); void run(() => editFact(id, k)); }} onBuild={() => run(() => buildDraft(id, { today }))} />
        </aside>
      </div>
    </div>
  );
}

function Stepper({ stage, phase }: { stage: number; phase: string }) {
  return (
    <ol className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="שלבי התכנון">
      {STAGES.map((s, i) => {
        const n = i + 1;
        const done = n < stage || phase === "active";
        const current = n === stage && phase !== "active";
        return (
          <li key={s} aria-current={current ? "step" : undefined} className={cx("flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs", current ? "bg-accent-600 font-semibold text-white" : done ? "bg-accent-50 text-accent-800 dark:bg-accent-800/20 dark:text-accent-100" : "text-stone-400")}>
            <span className={cx("flex h-4 w-4 items-center justify-center rounded-full text-[10px]", current ? "bg-white/25" : done ? "bg-accent-600 text-white" : "border hairline")}>{done ? <Check size={10} /> : n}</span>
            {s}
          </li>
        );
      })}
    </ol>
  );
}

function Summary({ goalId, busy, missing, onEdit, onBuild }: { goalId: string; busy: boolean; missing: string[]; onEdit: (k: string) => void; onBuild: () => void }) {
  const db = useStore((s) => s.db);
  const facts = Object.values(factsOf(db, goalId)).sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : 1));
  const unresolved = db.profiles[goalId]?.unresolved ?? [];
  const conv = db.conversations[goalId];
  return (
    <Card className="space-y-4 p-4">
      <div>
        <h2 className="mb-2 text-sm font-semibold">מה ידוע עד עכשיו</h2>
        {facts.length === 0 ? (
          <p className="text-xs text-stone-500">עדיין אין תשובות.</p>
        ) : (
          <ul className="space-y-2">
            {facts.map((f) => (
              <li key={f.key} className="group text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-stone-500">{f.label}</span>
                  <Badge tone={FACT_KIND[f.kind].tone}>{FACT_KIND[f.kind].label}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <span className="flex-1 font-medium">{f.display}</span>
                  {f.kind !== "confirmed" && (
                    <button className="rounded p-1 text-accent-700 hover:bg-accent-50" aria-label={`אישור: ${f.label}`} title="זה נכון — לאשר" onClick={() => void confirmFact(goalId, f.key)}>
                      <Check size={13} />
                    </button>
                  )}
                  <button className="rounded p-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-white/5" aria-label={`עריכה: ${f.label}`} disabled={busy} onClick={() => onEdit(f.key)}>
                    <Pencil size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {unresolved.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold text-stone-500">שאלות פתוחות</h3>
          <ul className="space-y-0.5 text-xs text-stone-600 dark:text-stone-300">
            {unresolved.map((u) => (
              <li key={u}>• {u}</li>
            ))}
          </ul>
        </div>
      )}
      {conv?.phase === "discovery" && (
        <div className="border-t hairline pt-3">
          {missing.length ? (
            <p className="text-xs text-stone-500">חסר לפני בניית תוכנית: {missing.join(", ")}</p>
          ) : (
            <Button size="sm" variant="subtle" className="w-full" disabled={busy} onClick={onBuild}>
              <Sparkles size={14} /> לבנות טיוטה עכשיו
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
