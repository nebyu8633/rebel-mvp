"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useToday } from "@/hooks/useToday";
import { aiConfigured, buildContext, requestAIAnswer, AIRequestError } from "@/lib/ai/client";
import { basicAnswer, type BasicAnswer } from "@/lib/assistant";
import { startOfWeek, weekday, addDays } from "@/lib/dates";
import { generateGroceryList } from "@/lib/actions";
import { Badge, Button, Card, Input, PageHeader, Spinner, cx } from "@/components/ui";
import { RecoveryModal } from "@/components/RecoveryModal";

interface Msg {
  role: "user" | "assistant";
  text: string;
  source?: "ai" | "basic" | "error";
  actions?: BasicAnswer["actions"];
}

const SUGGESTIONS = ["על מה כדאי להתמקד היום?", "פספסתי שתי משימות. עזור לי לסדר מחדש את השבוע", "צור רשימת קניות מהתפריט המאושר", "איך אני מתקדם במטרות השנתיות?", "פרק מטרה לצעדים שבועיים ריאליים"];

/** Minimal, safe rendering: **bold** and line breaks only (no HTML injection). */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <p key={i} className={cx(line.trim() === "" && "h-2")}>
          {line.split(/(\*\*[^*]+\*\*)/).map((part, j) => (part.startsWith("**") && part.endsWith("**") ? <b key={j}>{part.slice(2, -2)}</b> : <span key={j}>{part}</span>))}
        </p>
      ))}
    </>
  );
}

export default function AssistantPage() {
  const db = useStore((s) => s.db);
  const toast = useStore((s) => s.toast);
  const today = useToday();
  const router = useRouter();
  const [ai, setAi] = useState<boolean | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    aiConfigured().then(setAi);
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setQ("");
    setMsgs((m) => [...m, { role: "user", text }]);
    const basic = basicAnswer(db, text, today);
    if (!ai) {
      setMsgs((m) => [...m, { role: "assistant", text: basic.text, source: "basic", actions: basic.actions }]);
      return;
    }
    setBusy(true);
    try {
      const r = await requestAIAnswer(text, buildContext(db, today));
      setMsgs((m) => [...m, { role: "assistant", text: r.answer, source: "ai", actions: basic.actions }]);
    } catch (e) {
      const msg = e instanceof AIRequestError ? e.message : "שגיאה";
      setMsgs((m) => [
        ...m,
        { role: "assistant", text: `לא התקבלה תשובה משירות ה-AI: ${msg}`, source: "error" },
        { role: "assistant", text: basic.text, source: "basic", actions: basic.actions },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function runAction(kind: BasicAnswer["actions"][number]["kind"]) {
    if (kind === "recovery") setRecovery(true);
    else if (kind === "planner") router.push("/goals/new");
    else if (kind === "progress") router.push("/progress?review=1");
    else if (kind === "tasks") router.push("/tasks");
    else if (kind === "groceries") {
      const ws = weekday(today) >= 4 ? addDays(startOfWeek(today), 7) : startOfWeek(today);
      if (db.mealWeeks[ws]?.approved) {
        const r = await generateGroceryList(ws);
        toast(`רשימת הקניות עודכנה (${r.count} פריטים)`, "success");
      }
      router.push("/meals?tab=groceries");
    }
  }

  return (
    <div className="flex min-h-[70dvh] flex-col">
      <PageHeader
        title="עוזר תכנון"
        subtitle={
          ai == null ? "…" : ai ? (
            <span className="flex items-center gap-2">
              <Badge tone="indigo">AI מחובר</Badge> רואה רק את הנתונים שלך, ולא משנה דבר בלי אישורך.
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Badge>מנוע בסיסי</Badge> לא הוגדר מפתח AI — תשובות מבוססות כללים על הנתונים שלך.
            </span>
          )
        }
      />
      <div className="flex-1 space-y-3">
        {msgs.length === 0 && (
          <Card>
            <p className="mb-3 text-sm text-stone-600 dark:text-stone-300">אפשר לשאול למשל:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => void ask(s)} className="rounded-full border hairline px-3 py-1.5 text-sm hover:border-accent-500">
                  {s}
                </button>
              ))}
            </div>
          </Card>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cx("flex", m.role === "user" ? "justify-start" : "justify-end")}>
            <div
              className={cx(
                "animate-in max-w-[85%] space-y-1 rounded-2xl px-4 py-3 text-[15px] leading-relaxed",
                m.role === "user" ? "bg-accent-600 text-white" : m.source === "error" ? "bg-rose-50 text-rose-800 dark:bg-rose-900/20 dark:text-rose-200" : "surface border",
              )}
            >
              {m.role === "assistant" && m.source && m.source !== "error" && (
                <div className="mb-1 text-[11px] text-stone-400">{m.source === "ai" ? "AI" : "מנוע בסיסי (ללא AI)"}</div>
              )}
              <Rich text={m.text} />
              {m.actions && m.actions.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {m.actions.map((a) => (
                    <Button key={a.kind} size="sm" variant="subtle" onClick={() => void runAction(a.kind)}>
                      {a.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-end">
            <div className="surface flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm text-stone-500">
              <Spinner /> חושב…
            </div>
          </div>
        )}
        <div ref={end} />
      </div>
      <form
        className="surface sticky bottom-20 mt-4 flex gap-2 rounded-2xl border p-2 shadow-sm lg:bottom-4"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
      >
        <Sparkles size={18} className="ms-2 self-center text-stone-400" />
        <Input className="border-0 focus:ring-0" placeholder="שאלה על היום, השבוע או המטרות…" value={q} onChange={(e) => setQ(e.target.value)} maxLength={1000} aria-label="שאלה" />
        <Button type="submit" variant="primary" disabled={busy || !q.trim()} aria-label="שליחה">
          <Send size={16} />
        </Button>
      </form>
      {recovery && <RecoveryModal open onClose={() => setRecovery(false)} />}
    </div>
  );
}
