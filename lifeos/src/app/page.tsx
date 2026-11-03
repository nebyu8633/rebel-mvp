"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, CalendarDays, Bell, ShoppingCart, ChefHat, Check, Star, AlertCircle, Send, Moon } from "lucide-react";
import { useStore, useSettings } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { useNow } from "@/hooks/useToday";
import { addDays, addMonths, formatHebDate, formatJewishDate, formatDuration, greetingFor, relativeDayLabel } from "@/lib/dates";
import { dayLoad, eventsInRange, habitDueOn, instancesInRange, isOpen, mostImportant, overdueInstances } from "@/lib/tasks";
import { remindersForDate } from "@/lib/reminders";
import { setHabitLog, toggleComplete, updateSettings, nowIso } from "@/lib/actions";
import { Badge, Button, Card, Details, Disclosure, Field, Input, Ring, SectionTitle, cx } from "@/components/ui";
import { TaskRow } from "@/components/TaskRow";
import { RecoveryModal } from "@/components/RecoveryModal";
import { GoalCard } from "@/components/GoalCard";

const AI_PROMPTS = ["על מה להתמקד היום?", "לסדר מחדש את השבוע", "איך אני מתקדם?"];

export default function MyDay() {
  const db = useStore((s) => s.db);
  const settings = useSettings();
  const now = useNow();
  const today = now.date;
  const tomorrow = addDays(today, 1);
  const router = useRouter();
  const openEditor = useUI((s) => s.openEditor);
  const [recovery, setRecovery] = useState(false);
  const [ask, setAsk] = useState("");

  const todayList = useMemo(() => instancesInRange(db, today, today, today), [db, today]);
  const overdue = useMemo(() => overdueInstances(db, today), [db, today]);
  const top = useMemo(() => mostImportant(db, [...overdue, ...todayList], today), [db, overdue, todayList, today]);
  const load = dayLoad(db, today, todayList);
  const upcoming = eventsInRange(db, today, addDays(today, 2)).filter((e) => e.date > today || !e.event.startTime || e.event.startTime >= now.time.slice(0, 5)).slice(0, 4);
  const habits = Object.values(db.habits).filter((h) => habitDueOn(h, today)).sort((a, b) => a.order - b.order);
  const reminders = remindersForDate(db, today).filter((r) => r.at >= now.minutes);
  const goals = Object.values(db.goals).filter((g) => g.status !== "done").sort((a, b) => a.order - b.order);
  const open = todayList.filter((i) => isOpen(i.status));
  const doneCount = todayList.filter((i) => i.status === "completed").length;
  const rest = [...open.filter((i) => i.key !== top?.key), ...todayList.filter((i) => !isOpen(i.status))];
  const tomorrowList = instancesInRange(db, tomorrow, tomorrow, today);
  const tomorrowEvents = eventsInRange(db, tomorrow, tomorrow);
  const mealsToPrep = Object.values(db.mealPlan).filter((m) => m.prepDate === today && !m.prepared);
  const isGroceryToday = todayList.some((i) => i.task.routine === "grocery" && isOpen(i.status));
  const goAsk = (q: string) => q.trim() && router.push(`/assistant?q=${encodeURIComponent(q.trim())}`);

  return (
    <div className="space-y-4">
      {/* Header: greeting + today's completion ring */}
      <header className="animate-in flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-50">
            {greetingFor(now.minutes)}
            {settings?.displayName ? `, ${settings.displayName}` : ""}
          </h1>
          <p className="mt-0.5 text-sm text-stone-500">
            {formatHebDate(today, { weekday: true })} · {formatJewishDate(today)}
          </p>
        </div>
        {todayList.length > 0 && (
          <div className="flex items-center gap-2 text-end">
            <div className="hidden text-xs text-stone-500 sm:block">
              <div>
                {doneCount}/{todayList.length} הושלמו
              </div>
              {load.availableMinutes != null && (
                <div className={cx(load.over && "font-medium text-amber-700")}>
                  {formatDuration(load.plannedMinutes) || "0"} / {formatDuration(load.availableMinutes)}
                </div>
              )}
            </div>
            <Ring value={doneCount / todayList.length} size={52} label="משימות היום" />
          </div>
        )}
      </header>

      {settings && !settings.onboarded && <Onboarding />}

      {/* 1. Most important + today's tasks */}
      {top && (
        <Card className="animate-in border-accent-200 bg-gradient-to-l from-accent-50/70 to-transparent p-4 dark:border-accent-800/50 dark:from-accent-800/10">
          <div className="flex items-center gap-3">
            <Star size={18} className="shrink-0 text-accent-600" aria-label="הכי חשוב" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{top.title}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                {top.task.goalId && db.goals[top.task.goalId] && <span>{db.goals[top.task.goalId].title}</span>}
                {top.date && top.date < today && <Badge tone="rose">באיחור</Badge>}
                {top.startTime && <span className="ltr-nums">{top.startTime}</span>}
                {top.task.estimatedMinutes ? <span>{formatDuration(top.task.estimatedMinutes)}</span> : null}
              </div>
            </div>
            <Button variant="primary" size="sm" onClick={() => void toggleComplete(top)} aria-label={`סיום: ${top.title}`}>
              <Check size={16} /> בוצע
            </Button>
          </div>
          {top.task.rationale && <Details label="למה זה חשוב" className="mt-2">{top.task.rationale}</Details>}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <Card className="animate-in p-3 sm:p-4">
            <SectionTitle
              action={
                <Button size="sm" variant="ghost" onClick={() => openEditor({ defaults: { date: today } })}>
                  <Plus size={16} /> משימה
                </Button>
              }
            >
              היום
            </SectionTitle>

            {overdue.length > 0 && (
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm dark:bg-rose-900/15">
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
                <Link href="/tasks?view=overdue" className="flex-1 text-rose-800 dark:text-rose-200">
                  {overdue.length} באיחור
                </Link>
                <Button size="sm" variant="subtle" onClick={() => setRecovery(true)}>
                  <Sparkles size={14} /> לסדר מחדש
                </Button>
              </div>
            )}

            {todayList.length === 0 ? (
              <p className="py-6 text-center text-sm text-stone-500">אין משימות להיום.</p>
            ) : rest.length === 0 ? (
              <p className="py-3 text-center text-sm text-stone-500">זה הכול להיום ✓</p>
            ) : (
              <div className="-mx-2">
                {rest.map((i) => (
                  <TaskRow key={i.key} inst={i} />
                ))}
              </div>
            )}

            {(isGroceryToday || mealsToPrep.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {isGroceryToday && (
                  <Link href="/meals?tab=groceries" className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-sm dark:bg-white/5">
                    <ShoppingCart size={14} /> רשימת קניות
                  </Link>
                )}
                {mealsToPrep.length > 0 && (
                  <Link href="/meals?tab=prep" className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-sm dark:bg-white/5">
                    <ChefHat size={14} /> {mealsToPrep.length} להכנה
                  </Link>
                )}
              </div>
            )}
          </Card>

          {/* 3–4. Active goals + progress */}
          {goals.length > 0 && (
            <section className="animate-in">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold">המטרות שלי</h2>
                <Link href="/goals" className="text-sm text-accent-700 dark:text-accent-200">
                  הכול
                </Link>
              </div>
              <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-3">
                {goals.map((g) => (
                  <div key={g.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
                    <GoalCard goal={g} today={today} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {/* 2. Upcoming events */}
          <Card className="animate-in p-3 sm:p-4">
            <SectionTitle action={<Link href="/calendar" className="text-sm text-accent-700 dark:text-accent-200">יומן</Link>}>אירועים קרובים</SectionTitle>
            {upcoming.length === 0 ? (
              <p className="text-sm text-stone-500">אין אירועים ביומיים הקרובים.</p>
            ) : (
              <ol className="relative space-y-3 border-s-2 border-sky-100 ps-4 dark:border-sky-900/40">
                {upcoming.map((e) => (
                  <li key={e.key} className="relative">
                    <span className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-sky-500" />
                    <div className="text-sm font-medium">{e.event.title}</div>
                    <div className="text-xs text-stone-500">
                      {relativeDayLabel(e.date, today)}
                      {e.event.startTime && (
                        <>
                          {" · "}
                          <span className="ltr-nums">{e.event.startTime}</span>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {habits.length > 0 && (
            <Card className="animate-in p-3 sm:p-4">
              <SectionTitle>הרגלים</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {habits.map((h) => {
                  const isDone = db.habitLogs[`${h.id}:${today}`]?.status === "done";
                  return (
                    <button
                      key={h.id}
                      onClick={() => void setHabitLog(h, today, isDone ? null : "done")}
                      aria-pressed={isDone}
                      className={cx("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors", isDone ? "border-accent-600 bg-accent-600 text-white" : "hairline hover:border-accent-500")}
                    >
                      {isDone && <Check size={14} />}
                      {h.title}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          {/* 5. Quick access to AI */}
          <Card className="animate-in p-3 sm:p-4">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                goAsk(ask);
              }}
            >
              <Sparkles size={18} className="shrink-0 text-accent-600" />
              <Input className="border-0 bg-transparent px-1 focus:ring-0 dark:bg-transparent" placeholder="לשאול את העוזר…" value={ask} onChange={(e) => setAsk(e.target.value)} aria-label="שאלה לעוזר" />
              <Button type="submit" size="icon" variant="ghost" aria-label="שליחה" disabled={!ask.trim()}>
                <Send size={16} />
              </Button>
            </form>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {AI_PROMPTS.map((p) => (
                <button key={p} onClick={() => goAsk(p)} className="rounded-full border hairline px-2.5 py-1 text-xs text-stone-600 hover:border-accent-500 dark:text-stone-300">
                  {p}
                </button>
              ))}
            </div>
          </Card>

          <Disclosure
            id="day-tomorrow"
            icon={<Moon size={16} />}
            title="מחר ותזכורות"
            summary={`${tomorrowList.length} משימות${tomorrowEvents.length ? ` · ${tomorrowEvents.length} אירועים` : ""}${reminders.length ? ` · ${reminders.length} תזכורות` : ""}`}
          >
            <ul className="space-y-1.5 text-sm">
              {tomorrowList.slice(0, 5).map((i) => (
                <li key={i.key} className="truncate">
                  • {i.title}
                </li>
              ))}
              {tomorrowList.length === 0 && <li className="text-stone-500">אין משימות למחר</li>}
            </ul>
            {reminders.length > 0 && (
              <ul className="mt-3 space-y-1 border-t hairline pt-2 text-sm">
                {reminders.slice(0, 5).map((r) => (
                  <li key={r.key} className="flex items-center gap-2">
                    <Bell size={13} className="text-stone-400" />
                    <span className="ltr-nums w-11 text-stone-500">{r.time}</span>
                    <span className="truncate">{r.title}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => openEditor({ defaults: { date: tomorrow } })}>
              <Plus size={14} /> משימה למחר
            </Button>
          </Disclosure>
        </div>
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
