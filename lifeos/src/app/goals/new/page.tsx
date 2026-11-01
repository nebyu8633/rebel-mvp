"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, Split } from "lucide-react";
import { useToday } from "@/hooks/useToday";
import { aiConfigured } from "@/lib/ai/client";
import { createGoals, aiTurn } from "@/lib/goalplan/session";
import { splitGoals, KIND_LABEL } from "@/lib/goalplan/interview";
import { Badge, Button, Card, PageHeader, Spinner, Textarea } from "@/components/ui";

const EXAMPLES = [
  "אני רוצה לעלות 10 קילו בתוך שנה.",
  "אני רוצה להגיע לתיק השקעות בשווי 30,000 ₪.",
  "אני רוצה לקנות אופנוע.",
  "אני רוצה להגדיל את ההכנסה החודשית שלי.",
  "אני רוצה ללמוד שפה חדשה.",
];

export default function NewGoalPage() {
  const router = useRouter();
  const today = useToday();
  const [text, setText] = useState("");
  const [ai, setAi] = useState<boolean | null>(null);
  const [useAi, setUseAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [split, setSplit] = useState<Array<{ text: string; kind: keyof typeof KIND_LABEL }> | null>(null);

  useEffect(() => {
    aiConfigured().then((c) => {
      setAi(c);
      setUseAi(c);
    });
  }, []);

  async function start(descriptions: string[]) {
    setBusy(true);
    setError(null);
    const res = await createGoals(descriptions, { today, mode: useAi ? "ai" : "basic" });
    if ("error" in res) {
      setBusy(false);
      return setError(res.error);
    }
    if (useAi) {
      // first AI turn for each new goal; on failure the goal and message stay saved and the chat shows a retry
      await Promise.all(res.goalIds.map((id, i) => aiTurn(id, descriptions[i], today, { persistUser: false })));
    }
    router.push(res.goalIds.length === 1 ? `/goals/${res.goalIds[0]}/chat` : "/goals");
  }

  function submit() {
    const t = text.trim();
    if (t.length < 4) return setError("ספר/י במשפט מה המטרה");
    const parts = splitGoals(t);
    if (parts.length >= 2) return setSplit(parts);
    void start([t]);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/goals" className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
        <ArrowRight size={14} /> המטרות שלי
      </Link>
      <PageHeader title="מטרה חדשה" subtitle="תאר/י את המטרה במילים שלך. נעבור יחד על מה שחשוב — שאלה אחת בכל פעם — ונבנה תוכנית לאישורך." />
      <Card>
        <Textarea
          autoFocus
          className="min-h-28 text-base"
          placeholder="למשל: אני רוצה לחסוך לרכב עד הקיץ הבא"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSplit(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          aria-label="תיאור המטרה"
          maxLength={2000}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setText(ex)} className="rounded-full border hairline px-3 py-1 text-xs text-stone-600 hover:border-accent-500 dark:text-stone-300">
              {ex}
            </button>
          ))}
        </div>

        {split && (
          <div className="animate-in mt-4 rounded-2xl bg-amber-50 p-3 text-sm dark:bg-amber-900/20">
            <p className="mb-2 flex items-center gap-1.5 font-medium">
              <Split size={16} /> זיהיתי {split.length} מטרות שונות:
            </p>
            <ul className="mb-3 space-y-1">
              {split.map((s) => (
                <li key={s.text}>
                  • {s.text} <Badge>{KIND_LABEL[s.kind]}</Badge>
                </li>
              ))}
            </ul>
            <p className="mb-3 text-xs text-stone-600 dark:text-stone-300">מומלץ לתכנן כל אחת בנפרד. הן ישתפו את אותו לוח שנה ואותה מגבלת זמן.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" disabled={busy} onClick={() => start(split.map((s) => s.text))}>
                יצירת {split.length} מטרות נפרדות
              </Button>
              <Button size="sm" disabled={busy} onClick={() => start([text.trim()])}>
                זו מטרה אחת
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-stone-500">
            {ai == null ? (
              "…"
            ) : ai ? (
              <label className="flex items-center gap-2">
                <input type="checkbox" className="accent-accent-600" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
                שיחה עם AI (אחרת: מנוע תכנון בסיסי)
              </label>
            ) : (
              <span>מנוע תכנון בסיסי (ללא AI) — לא הוגדר מפתח AI בשרת.</span>
            )}
          </div>
          {!split && (
            <Button variant="primary" onClick={submit} disabled={busy || !text.trim()}>
              {busy ? <Spinner /> : <Sparkles size={16} />} התחלת שיחת תכנון
            </Button>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-rose-600">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}
