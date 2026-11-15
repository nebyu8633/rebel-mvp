"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Sparkles, Bell, ShoppingCart, ChefHat, Check, ChevronLeft, CalendarDays } from "lucide-react";
import { useStore, useSettings } from "@/lib/store/store";
import { useNow } from "@/hooks/useToday";
import { addDays, addMonths, formatHebDate, formatJewishDate, greetingFor, relativeDayLabel } from "@/lib/dates";
import { eventsInRange, habitDueOn, instancesInRange, isOpen, mostImportant, overdueInstances } from "@/lib/tasks";
import { scheduledReminders } from "@/lib/game/notify";
import { goalSnapshot } from "@/lib/goals";
import { setHabitLog, updateSettings, nowIso } from "@/lib/actions";
import { Button, Card, Details, Field, Input, Ring, SectionTitle, cx } from "@/components/ui";
import { Section } from "@/components/ds";
import { TaskRow } from "@/components/TaskRow";
import { RecoveryModal } from "@/components/RecoveryModal";
import { useQuickAdd } from "@/components/QuickAdd";

/**
 * Today — one column, in the order the day is used: what's next, what's waiting, habits, what's
 * coming later. Completed items fold away; nothing here punishes an empty or missed day.
 */
export default function MyDay() {
  const db = useStore((s) => s.db);
  const settings = useSettings();
  const now = useNow();
  const today = now.date;
  const tomorrow = addDays(today, 1);
  const quickAdd = useQuickAdd((s) => s.show);
  const [recovery, setRecovery] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const todayList = useMemo(() => instancesInRange(db, today, today, today), [db, today]);
  const overdue = useMemo(() => overdueInstances(db, today), [db, today]);
  const open = todayList.filter((i) => isOpen(i.status));
  const done = todayList.filter((i) => !isOpen(i.status));
  // the most important open task first, then by time (untimed after timed)
  const top = useMemo(() => mostImportant(db, open, today), [db, open, today]);
  const ordered = useMemo(
    () => [...open].sort((a, b) => (a.key === top?.key ? -1 : b.key === top?.key ? 1 : (a.startTime ?? "99") < (b.startTime ?? "99") ? -1 : (a.startTime ?? "99") > (b.startTime ?? "99") ? 1 : 0)),
    [open, top],
  );
  const habits = Object.values(db.habits).filter((h) => !h.paused && habitDueOn(h, today)).sort((a, b) => a.order - b.order);
  const later = useMemo(() => {
    const ev = eventsInRange(db, today, tomorrow)
      .filter((e) => e.date > today || !e.event.startTime || e.event.startTime >= now.time.slice(0, 5))
      .slice(0, 5)
      .map((e) => ({ key: e.key, kind: "event" as const, title: e.event.title, when: `${e.date === today ? "" : `${relativeDayLabel(e.date, today)} · `}${e.event.startTime ?? "כל היום"}`, sort: `${e.date} ${e.event.startTime ?? "00:00"}` }));
    const rem = scheduledReminders(db, today)
      // task reminders already show on their row (bell); here: habits, meals, events
      .filter((r) => r.at >= now.minutes && !r.muted && r.kind !== "task")
      .slice(0, 5)
      .map((r) => ({ key: r.key, kind: "reminder" as const, title: r.title, when: r.time, sort: `${today} ${r.time}` }));
    return [...ev, ...rem].sort((a, b) => (a.sort < b.sort ? -1 : 1)).slice(0, 6);
  }, [db, today, tomorrow, now.minutes, now.time]);
  const tomorrowCount = instancesInRange(db, tomorrow, tomorrow, today).length;
  const goals = Object.values(db.goals).filter((g) => g.status !== "done").sort((a, b) => a.order - b.order).slice(0, 2);
  const mealsToPrep = Object.values(db.mealPlan).filter((m) => m.prepDate === today && !m.prepared);
  const isGroceryToday = todayList.some((i) => i.task.routine === "grocery" && isOpen(i.status));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* header: date, greeting, today's progress */}
      <header className="animate-in flex items-end justify-between gap-4 px-1">
        <div className="min-w-0">
          <p className="text-footnote font-medium text-ink-2">
            {formatHebDate(today, { weekday: true })} · {formatJewishDate(today)}
          </p>
          <h1 className="mt-0.5 text-display text-ink">
            {greetingFor(now.minutes)}
            {settings?.displayName ? `, ${settings.displayName}` : ""}
          </h1>
        </div>
        {todayList.length > 0 && (
          <span className="tnum shrink-0 pb-1 text-footnote text-ink-2" aria-label={`הושלמו ${done.length} מתוך ${todayList.length}`}>
            {done.length} מתוך {todayList.length}
          </span>
        )}
      </header>

      {settings && !settings.onboarded && <Onboarding />}

      {/* quick capture: looks like a field, opens the parser sheet */}
      <button
        type="button"
        onClick={() => quickAdd(today)}
        className="animate-in flex h-12 w-full items-center gap-2 rounded-panel border border-line bg-surface px-4 text-start text-body text-ink-3 transition-colors hover:border-line-strong"
      >
        <Plus size={18} className="text-accent" />
        <span className="truncate">מה צריך לעשות?</span>
      </button>

      {/* waiting from earlier days — one calm line, the user decides */}
      {overdue.length > 0 && (
        <button type="button" onClick={() => setRecovery(true)} className="animate-in flex min-h-11 w-full items-center gap-2 rounded-panel bg-warn-soft px-4 text-start text-body text-ink">
          <span className="flex-1">
            {overdue.length === 1 ? "משימה אחת מחכה מימים קודמים" : `${overdue.length} משימות מחכות מימים קודמים`}
          </span>
          <span className="text-footnote font-medium text-warn">לבחור מה לעשות</span>
          <ChevronLeft size={16} className="text-warn" />
        </button>
      )}

      {/* today's tasks */}
      {todayList.length === 0 ? (
        <section className="animate-in rounded-panel border border-dashed border-line px-6 py-10 text-center">
          <p className="text-headline text-ink">יום פנוי.</p>
          <p className="mt-1 text-body text-ink-2">רוצה לתכנן אותו, או להשאיר אותו פתוח?</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={() => quickAdd(today)}>
              <Plus size={16} /> להוסיף משימה
            </Button>
            <Link href={`/assistant?q=${encodeURIComponent("עזור לי לתכנן את היום")}`} className="inline-flex h-11 items-center gap-1.5 rounded-field px-4 text-body font-medium text-accent-ink hover:bg-surface-2 sm:h-10">
              <Sparkles size={16} /> לתכנן עם העוזר
            </Link>
          </div>
        </section>
      ) : (
        <Section title="היום">
          {ordered.length === 0 ? (
            <p className="flex items-center gap-2 px-4 py-4 text-body text-ink-2">
              <Check size={16} className="text-accent" /> הכול בוצע להיום.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {ordered.map((i) => (
                <TaskRow key={i.key} inst={i} />
              ))}
            </div>
          )}
          {done.length > 0 && (
            <>
              <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className="flex min-h-11 w-full items-center border-t border-line px-4 text-start text-footnote font-medium text-ink-2">
                {showDone ? "הסתרת" : "הצגת"} {done.length} שהושלמו
              </button>
              {showDone && (
                <div className="divide-y divide-line border-t border-line">
                  {done.map((i) => (
                    <TaskRow key={i.key} inst={i} />
                  ))}
                </div>
              )}
            </>
          )}
        </Section>
      )}

      {/* habits: one tap to mark; no streak pressure here */}
      {habits.length > 0 && (
        <Section title="הרגלים" flush action={<Link href="/habits" className="text-footnote font-medium text-accent-ink">הכול</Link>}>
          <div className="flex flex-wrap gap-2">
            {habits.map((h) => {
              const isDone = db.habitLogs[`${h.id}:${today}`]?.status === "done";
              return (
                <button
                  key={h.id}
                  onClick={() => void setHabitLog(h, today, isDone ? null : "done")}
                  aria-pressed={isDone}
                  className={cx("inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-footnote font-medium transition-colors", isDone ? "border-accent bg-accent text-white dark:text-[#06201c]" : "border-line bg-surface text-ink hover:border-line-strong")}
                >
                  {isDone && <Check size={14} strokeWidth={3} />}
                  {h.title}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* later: events and upcoming reminders, in time order */}
      {(later.length > 0 || isGroceryToday || mealsToPrep.length > 0) && (
        <Section title="בהמשך" action={<Link href="/calendar" className="text-footnote font-medium text-accent-ink">יומן</Link>}>
          <ul className="divide-y divide-line">
            {later.map((l) => (
              <li key={l.key} className="flex min-h-11 items-center gap-3 px-4">
                {l.kind === "event" ? <CalendarDays size={15} className="shrink-0 text-ink-3" aria-label="אירוע" /> : <Bell size={15} className="shrink-0 text-ink-3" aria-label="תזכורת" />}
                <span className="min-w-0 flex-1 truncate text-body text-ink">{l.title}</span>
                <span className="tnum shrink-0 text-footnote text-ink-2">{l.when}</span>
              </li>
            ))}
            {isGroceryToday && (
              <li>
                <Link href="/meals?tab=groceries" className="flex min-h-11 items-center gap-3 px-4 text-body text-ink">
                  <ShoppingCart size={15} className="text-ink-3" /> רשימת הקניות
                </Link>
              </li>
            )}
            {mealsToPrep.length > 0 && (
              <li>
                <Link href="/meals?tab=prep" className="flex min-h-11 items-center gap-3 px-4 text-body text-ink">
                  <ChefHat size={15} className="text-ink-3" /> {mealsToPrep.length} ארוחות להכנה
                </Link>
              </li>
            )}
          </ul>
        </Section>
      )}

      {/* goals: the next step, not a dashboard */}
      {goals.length > 0 && (
        <Section title="מטרות" action={<Link href="/goals" className="text-footnote font-medium text-accent-ink">הכול</Link>}>
          <ul className="divide-y divide-line">
            {goals.map((g) => {
              const snap = goalSnapshot(db, g, today);
              return (
                <li key={g.id}>
                  <Link href={`/goals/${g.id}`} className="flex min-h-[52px] items-center gap-3 px-4 py-2.5">
                    <Ring value={snap.progress.fraction} size={30} stroke={3.5} label={g.title} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body text-ink">{g.title}</span>
                      <span className="block truncate text-footnote text-ink-2">
                        {snap.nextAction ? `הצעד הבא: ${snap.nextAction.title}` : snap.nextMilestone ? `אבן הדרך הבאה: ${snap.nextMilestone.title}` : "עוד אין תוכנית — לבנות אחת"}
                      </span>
                    </span>
                    <ChevronLeft size={16} className="shrink-0 text-ink-3" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* tomorrow, at a glance */}
      <div className="flex items-center justify-between px-1 text-footnote text-ink-2">
        <span>מחר: {tomorrowCount === 0 ? "עוד אין משימות" : tomorrowCount === 1 ? "משימה אחת" : `${tomorrowCount} משימות`}</span>
        <button type="button" onClick={() => quickAdd(tomorrow)} className="inline-flex min-h-11 items-center gap-1 font-medium text-accent-ink">
          <Plus size={14} /> משימה למחר
        </button>
      </div>

      {recovery && <RecoveryModal open onClose={() => setRecovery(false)} />}
    </div>
  );
}

function Onboarding() {
  const settings = useSettings()!;
  const db = useStore((s) => s.db);
  const putMany = useStore((s) => s.putMany);
  const today = useNow().date;
  const [name, setName] = useState(settings.displayName);
  const [hours, setHours] = useState("");
  const [start, setStart] = useState(today);
  const unconfirmed = Object.values(db.goals).filter((g) => !g.startConfirmed);

  async function save() {
    const h = hours === "" ? null : Math.round(Number(hours) * 60);
    if (h != null && (Number.isNaN(h) || h < 0 || h > 24 * 60)) return;
    const n = nowIso();
    await putMany(unconfirmed.map((g) => ["goals", { ...g, startDate: start, targetDate: addMonths(start, 12), startConfirmed: true, updatedAt: n }]));
    await updateSettings({ displayName: name.trim(), availability: h == null ? settings.availability : [h, h, h, h, h, h, h], onboarded: true });
  }

  return (
    <Card className="animate-in border-dashed">
      <SectionTitle>ברוכים הבאים 👋</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="איך לקרוא לך?">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        <Field label="שעות פנויות ביום">
          <Input type="number" inputMode="decimal" min={0} max={24} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="למשל 2" />
        </Field>
        <Field label="תחילת המטרות השנתיות">
          <Input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={save}>
          התחלה
        </Button>
        <Button variant="ghost" onClick={() => updateSettings({ onboarded: true })}>
          אחר כך
        </Button>
        <Details className="ms-auto" label="מה הוגדר מראש">
          קניות בחמישי, הכנת אוכל בשלישי (גיבוי: שבת) וסיכום שבועי בשישי — בלי שעות עד שתבחרו. השעות הפנויות משמשות לבדיקת עומס; יעד המטרות: 12 חודשים מתאריך ההתחלה.
        </Details>
      </div>
    </Card>
  );
}
