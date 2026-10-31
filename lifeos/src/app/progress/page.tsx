"use client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useToday } from "@/hooks/useToday";
import { addDays, formatHebDate, formatShortDate, startOfWeek } from "@/lib/dates";
import { goalColor, goalProgress, GOAL_STATUS } from "@/lib/goals";
import { importanceScore, instancesInRange, isOpen, weekStats } from "@/lib/tasks";
import { weekCompletion } from "@/lib/habits";
import { setInstanceStatus } from "@/lib/actions";
import { SEED_IDS } from "@/lib/seed";
import { Badge, Button, Card, EmptyState, PageHeader, ProgressBar, SectionTitle } from "@/components/ui";
import { FinanceSummary } from "@/components/FinancePanel";
import { GroupedBars, LineChart, SERIES } from "@/components/charts";
import { RecoveryModal } from "@/components/RecoveryModal";
import { motorcycleCost } from "@/lib/finance";
import type { MotorcycleInfo } from "@/lib/types";

export default function ProgressPage() {
  return (
    <Suspense>
      <Progress />
    </Suspense>
  );
}

function Progress() {
  const params = useSearchParams();
  const db = useStore((s) => s.db);
  const today = useToday();
  const ws = startOfWeek(today);
  const goals = Object.values(db.goals).sort((a, b) => a.order - b.order);

  const weeks = useMemo(() => Array.from({ length: 8 }, (_, i) => addDays(ws, -7 * (7 - i))), [ws]);
  const taskWeeks = useMemo(() => weeks.map((w) => weekStats(db, w, today)), [db, weeks, today]);
  const habits = Object.values(db.habits);
  const habitWeeks = useMemo(
    () =>
      weeks.map((w) => {
        let done = 0;
        let due = 0;
        for (const h of habits) {
          if (h.startDate > addDays(w, 6)) continue;
          const c = weekCompletion(h, db.habitLogs, w, today);
          done += Math.min(c.done, c.due);
          due += c.due;
        }
        return { w, done, due };
      }),
    [weeks, habits, db.habitLogs, today],
  );
  const weights = Object.values(db.weightLogs).sort((a, b) => (a.date < b.date ? -1 : 1));
  const moto = db.goals[SEED_IDS.motorcycle];
  const portfolio = db.goals[SEED_IDS.portfolio];
  const anyTasks = taskWeeks.some((w) => w.planned > 0);

  return (
    <div className="space-y-5">
      <PageHeader title="התקדמות" subtitle="נתונים אמיתיים בלבד — בלי ציון כולל מומצא." />

      <WeeklyReview open={params.get("review") === "1"} />

      <Card>
        <SectionTitle>מטרות שנתיות</SectionTitle>
        {goals.length === 0 ? (
          <EmptyState title="אין מטרות" />
        ) : (
          <ul className="space-y-5">
            {goals.map((g) => {
              const p = goalProgress(db, g, today);
              const c = goalColor(g.color);
              const ms = Object.values(db.milestones).filter((m) => m.goalId === g.id);
              const msDone = ms.filter((m) => m.status === "done").length;
              return (
                <li key={g.id}>
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/goals/${g.id}`} className="font-medium hover:underline">
                      {g.title}
                    </Link>
                    <span className="text-xs text-stone-500">
                      <Badge tone={GOAL_STATUS[g.status].tone}>{GOAL_STATUS[g.status].label}</Badge> · אבני דרך {msDone}/{ms.length}
                    </span>
                  </div>
                  <div className="relative">
                    <ProgressBar value={p.fraction} barClass={c.bar} label={g.title} />
                    <span className="absolute -top-1 h-4 w-0.5 rounded bg-stone-500" style={{ insetInlineStart: `${p.timeElapsed * 100}%` }} title="כמה מהזמן עבר" aria-hidden />
                  </div>
                  <p className="mt-1 text-xs text-stone-500">
                    {p.fraction != null ? `${Math.round(p.fraction * 100)}% מהיעד` : `חסר מידע: ${p.missing.join(", ")}`} · עבר {Math.round(p.timeElapsed * 100)}% מהזמן (הקו האנכי)
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="8 השבועות האחרונים">משימות: מתוכנן מול הושלם</SectionTitle>
          {anyTasks ? (
            <GroupedBars
              ariaLabel="משימות מתוכננות מול שהושלמו לפי שבוע"
              keys={[
                { label: "מתוכננות", color: SERIES[0] },
                { label: "הושלמו", color: SERIES[1] },
              ]}
              groups={taskWeeks.map((w) => ({ label: formatShortDate(w.weekStart), values: [w.planned, w.completed] }))}
            />
          ) : (
            <p className="text-sm text-stone-500">עוד אין היסטוריית משימות.</p>
          )}
        </Card>
        <Card>
          <SectionTitle hint="ימים שבוצעו מתוך ימים שנדרשו (דילוג לא נספר כפספוס)">עקביות בהרגלים</SectionTitle>
          {habits.length === 0 ? (
            <p className="text-sm text-stone-500">
              אין הרגלים. <Link href="/habits" className="text-accent-700">הוספה</Link>
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {habitWeeks.map((h) => (
                <li key={h.w} className="flex items-center gap-3">
                  <span className="w-12 text-xs text-stone-500">{formatShortDate(h.w)}</span>
                  <ProgressBar value={h.due ? h.done / h.due : null} className="flex-1" label={`שבוע ${formatShortDate(h.w)}`} />
                  <span className="ltr-nums w-12 text-xs text-stone-500">{h.due ? `${h.done}/${h.due}` : "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {portfolio?.financeAccountId && (
          <Card>
            <SectionTitle action={<Link href={`/goals/${portfolio.id}`} className="text-sm text-accent-700">עדכון</Link>}>תיק השקעות</SectionTitle>
            <FinanceSummary accountId={portfolio.financeAccountId} target={portfolio.targetValue} />
          </Card>
        )}
        {moto?.financeAccountId && (
          <Card>
            <SectionTitle action={<Link href={`/goals/${moto.id}`} className="text-sm text-accent-700">עדכון</Link>}>חיסכון לאופנוע</SectionTitle>
            <FinanceSummary accountId={moto.financeAccountId} target={motorcycleCost((moto.info ?? {}) as Partial<MotorcycleInfo>).upfront || null} />
          </Card>
        )}
      </div>

      <Card>
        <SectionTitle>היסטוריית משקל</SectionTitle>
        {weights.length >= 2 ? (
          <LineChart ariaLabel="משקל לאורך זמן" series={[{ label: "משקל (ק״ג)", color: SERIES[0], points: weights.map((w) => ({ x: w.date, y: w.kg })) }]} />
        ) : (
          <p className="text-sm text-stone-500">{weights.length === 1 ? `שקילה אחת (${weights[0].kg} ק״ג). הגרף יופיע מהשקילה השנייה.` : "עוד אין שקילות."}</p>
        )}
      </Card>
    </div>
  );
}

function WeeklyReview({ open: initialOpen }: { open: boolean }) {
  const db = useStore((s) => s.db);
  const today = useToday();
  const [open, setOpen] = useState(initialOpen);
  const [recovery, setRecovery] = useState(false);
  const ws = startOfWeek(today);
  const list = instancesInRange(db, ws, addDays(ws, 6), today);
  const completed = list.filter((i) => i.status === "completed");
  const missed = list.filter((i) => isOpen(i.status) && i.date! < today);
  const nextWeek = instancesInRange(db, addDays(ws, 7), addDays(ws, 13), today)
    .filter((i) => isOpen(i.status))
    .sort((a, b) => importanceScore(db, b, today) - importanceScore(db, a, today))
    .slice(0, 5);
  const reviewInst = instancesInRange(db, ws, addDays(ws, 6), today).find((i) => i.task.routine === "weekly_review" && isOpen(i.status));

  if (!open)
    return (
      <Button onClick={() => setOpen(true)}>
        <Sparkles size={16} /> סיכום שבועי
      </Button>
    );
  return (
    <Card className="border-accent-200 dark:border-accent-800/50">
      <SectionTitle hint={`${formatHebDate(ws)} – ${formatHebDate(addDays(ws, 6))}`} action={<Button size="sm" variant="ghost" onClick={() => setOpen(false)}>סגירה</Button>}>
        סיכום שבועי
      </SectionTitle>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <h3 className="mb-1 flex items-center gap-1 text-sm font-semibold">
            <CheckCircle2 size={14} className="text-accent-600" /> הושלמו ({completed.length})
          </h3>
          <ul className="space-y-0.5 text-sm text-stone-600 dark:text-stone-300">
            {completed.slice(0, 10).map((i) => (
              <li key={i.key}>• {i.title}</li>
            ))}
            {!completed.length && <li className="text-stone-400">—</li>}
          </ul>
        </div>
        <div>
          <h3 className="mb-1 flex items-center gap-1 text-sm font-semibold">
            <XCircle size={14} className="text-stone-400" /> לא בוצעו ({missed.length})
          </h3>
          <ul className="space-y-0.5 text-sm text-stone-600 dark:text-stone-300">
            {missed.slice(0, 10).map((i) => (
              <li key={i.key}>• {i.title}</li>
            ))}
            {!missed.length && <li className="text-stone-400">—</li>}
          </ul>
          {missed.length > 0 && (
            <Button size="sm" variant="subtle" className="mt-2" onClick={() => setRecovery(true)}>
              תוכנית התאוששות
            </Button>
          )}
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">עדיפויות לשבוע הבא</h3>
          <ul className="space-y-0.5 text-sm text-stone-600 dark:text-stone-300">
            {nextWeek.map((i) => (
              <li key={i.key}>• {i.title}</li>
            ))}
            {!nextWeek.length && <li className="text-stone-400">עדיין לא תוכנן — זה זמן טוב לתכנן.</li>}
          </ul>
        </div>
      </div>
      <div className="mt-4 border-t hairline pt-3 text-sm">
        <h3 className="mb-1 font-semibold">מטרות</h3>
        <ul className="space-y-0.5 text-stone-600 dark:text-stone-300">
          {Object.values(db.goals).map((g) => {
            const p = goalProgress(db, g, today);
            return (
              <li key={g.id}>
                • {g.title}: {p.fraction != null ? `${Math.round(p.fraction * 100)}%` : `חסר: ${p.missing.join(", ")}`}
              </li>
            );
          })}
        </ul>
      </div>
      {reviewInst && (
        <Button variant="primary" className="mt-4" onClick={() => void setInstanceStatus(reviewInst, "completed")}>
          סימון הסיכום השבועי כבוצע
        </Button>
      )}
      {recovery && <RecoveryModal open onClose={() => setRecovery(false)} />}
    </Card>
  );
}
