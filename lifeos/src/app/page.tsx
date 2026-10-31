"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Sparkles, ArrowLeft, CalendarDays, Bell, ShoppingCart, ChefHat, Check, Star } from "lucide-react";
import { useStore, useSettings } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { useNow } from "@/hooks/useToday";
import { addDays, addMonths, formatHebDate, formatJewishDate, formatDuration, greetingFor, weekday } from "@/lib/dates";
import { dayLoad, eventsInRange, habitDueOn, instancesInRange, isOpen, mostImportant, overdueInstances } from "@/lib/tasks";
import { goalColor, goalProgress } from "@/lib/goals";
import { remindersForDate } from "@/lib/reminders";
import { setHabitLog, toggleComplete, updateSettings, nowIso } from "@/lib/actions";
import { Badge, Button, Card, EmptyState, Field, Input, ProgressBar, SectionTitle, cx } from "@/components/ui";
import { TaskRow } from "@/components/TaskRow";
import { RecoveryModal } from "@/components/RecoveryModal";
import { WEEKDAYS_HE } from "@/lib/dates";

export default function MyDay() {
  const db = useStore((s) => s.db);
  const settings = useSettings();
  const now = useNow();
  const today = now.date;
  const tomorrow = addDays(today, 1);
  const openEditor = useUI((s) => s.openEditor);
  const [recovery, setRecovery] = useState(false);

  const todayList = useMemo(() => instancesInRange(db, today, today, today), [db, today]);
  const overdue = useMemo(() => overdueInstances(db, today), [db, today]);
  const top = useMemo(() => mostImportant(db, [...overdue, ...todayList], today), [db, overdue, todayList, today]);
  const load = dayLoad(db, today, todayList);
  const events = eventsInRange(db, today, today);
  const habits = Object.values(db.habits).filter((h) => habitDueOn(h, today)).sort((a, b) => a.order - b.order);
  const reminders = remindersForDate(db, today).filter((r) => r.at >= now.minutes);
  const goals = Object.values(db.goals).filter((g) => g.status !== "done").sort((a, b) => a.order - b.order);
  const open = todayList.filter((i) => isOpen(i.status));
  const done = todayList.filter((i) => i.status === "completed");
  const tomorrowList = instancesInRange(db, tomorrow, tomorrow, today);
  const tomorrowEvents = eventsInRange(db, tomorrow, tomorrow);
  const tomorrowMeals = Object.values(db.mealPlan).filter((m) => m.date === tomorrow);
  const mealsToPrep = Object.values(db.mealPlan).filter((m) => m.prepDate === today && !m.prepared);
  const isGroceryToday = todayList.some((i) => i.task.routine === "grocery" && isOpen(i.status));
  const name = settings?.displayName;

  return (
    <div className="space-y-5">
      <header className="animate-in">
        <p className="text-sm text-stone-500">
          {formatHebDate(today, { weekday: true, year: true })} · <span>{formatJewishDate(today)}</span>
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-50">
          {greetingFor(now.minutes)}
          {name ? `, ${name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {open.length === 0 && todayList.length > 0
            ? "סיימת את כל מה שתוכנן להיום."
            : open.length
              ? `${open.length} משימות להיום${load.plannedMinutes ? ` · כ-${formatDuration(load.plannedMinutes)}` : ""}${done.length ? ` · ${done.length} הושלמו` : ""}`
              : "אין משימות מתוכננות להיום."}
        </p>
      </header>

      {settings && !settings.onboarded && <Onboarding />}

      {/* 1. The most important action */}
      {top && (
        <Card className="animate-in border-accent-200 bg-gradient-to-l from-accent-50/60 to-transparent dark:border-accent-800/50 dark:from-accent-800/10">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-accent-700 dark:text-accent-200">
            <Star size={14} /> הצעד החשוב ביותר עכשיו
          </div>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold leading-snug">{top.title}</p>
              {top.task.goalId && db.goals[top.task.goalId] && (
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                  מקדם את <b>{db.goals[top.task.goalId].title}</b>
                  {top.task.rationale ? ` — ${top.task.rationale}` : ""}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-500">
                {top.date && top.date < today && <Badge tone="rose">באיחור</Badge>}
                {top.task.estimatedMinutes ? <Badge>{formatDuration(top.task.estimatedMinutes)}</Badge> : null}
                {top.startTime && <Badge>{top.startTime}</Badge>}
              </div>
            </div>
            <Button variant="primary" onClick={() => void toggleComplete(top)} aria-label={`סיום: ${top.title}`}>
              <Check size={16} /> בוצע
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* Overdue */}
          {overdue.length > 0 && (
            <Card className="animate-in">
              <SectionTitle
                hint="בלי אשמה — בואו נמצא להן מקום ריאלי"
                action={
                  <Button size="sm" variant="subtle" onClick={() => setRecovery(true)}>
                    <Sparkles size={14} /> תוכנית התאוששות
                  </Button>
                }
              >
                <span className="text-rose-700 dark:text-rose-300">באיחור ({overdue.length})</span>
              </SectionTitle>
              <div className="-mx-2">
                {overdue.slice(0, 6).map((i) => (
                  <TaskRow key={i.key} inst={i} />
                ))}
              </div>
              {overdue.length > 6 && (
                <Link href="/tasks?view=overdue" className="mt-1 inline-block text-sm text-accent-700">
                  עוד {overdue.length - 6} ←
                </Link>
              )}
            </Card>
          )}

          {/* Today */}
          <Card className="animate-in">
            <SectionTitle
              action={
                <Button size="sm" variant="ghost" onClick={() => openEditor({ defaults: { date: today } })}>
                  <Plus size={16} /> הוספה
                </Button>
              }
              hint={
                load.availableMinutes != null ? (
                  <span className={cx(load.over && "font-medium text-amber-700")}>
                    {formatDuration(load.plannedMinutes) || "0 דק׳"} מתוכננות מתוך {formatDuration(load.availableMinutes)} פנויות
                    {load.over && " — יותר מהזמן הפנוי"}
                  </span>
                ) : undefined
              }
            >
              היום
            </SectionTitle>
            {load.availableMinutes != null && load.availableMinutes > 0 && (
              <ProgressBar
                className="mb-2"
                value={load.plannedMinutes / load.availableMinutes}
                barClass={load.over ? "bg-amber-500" : "bg-accent-600"}
                label="עומס היום"
              />
            )}
            {todayList.length === 0 ? (
              <EmptyState
                title="היום פנוי"
                action={
                  <Button variant="primary" size="sm" onClick={() => openEditor({ defaults: { date: today } })}>
                    <Plus size={16} /> משימה להיום
                  </Button>
                }
              >
                אפשר להוסיף משימה, או למשוך משימה מרשימת ״ללא תאריך״.
              </EmptyState>
            ) : (
              <div className="-mx-2">
                {[...open, ...todayList.filter((i) => !isOpen(i.status))].map((i) => (
                  <TaskRow key={i.key} inst={i} showWhy={i.key === top?.key ? false : i.task.priority === "high"} />
                ))}
              </div>
            )}
            {isGroceryToday && (
              <Link href="/meals?tab=groceries" className="mt-2 flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm text-accent-800 dark:bg-white/5 dark:text-accent-200">
                <ShoppingCart size={16} /> פתיחת רשימת הקניות לשבוע
              </Link>
            )}
            {mealsToPrep.length > 0 && (
              <Link href="/meals?tab=prep" className="mt-2 flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm text-accent-800 dark:bg-white/5 dark:text-accent-200">
                <ChefHat size={16} /> {mealsToPrep.length} ארוחות להכנה היום
              </Link>
            )}
          </Card>

          {/* Goals */}
          <Card className="animate-in">
            <SectionTitle action={<Link href="/goals" className="text-sm text-accent-700 dark:text-accent-200">כל המטרות ←</Link>}>איך היום מקדם את המטרות</SectionTitle>
            {goals.length === 0 ? (
              <EmptyState title="אין מטרות פעילות" action={<Link href="/goals" className="text-sm text-accent-700">הוספת מטרה</Link>} />
            ) : (
              <ul className="space-y-4">
                {goals.map((g) => {
                  const p = goalProgress(db, g, today);
                  const c = goalColor(g.color);
                  const todayForGoal = todayList.filter((i) => i.task.goalId === g.id);
                  const doneForGoal = todayForGoal.filter((i) => i.status === "completed").length;
                  return (
                    <li key={g.id}>
                      <Link href={`/goals/${g.id}`} className="block">
                        <div className="mb-1 flex items-baseline justify-between gap-2">
                          <span className="font-medium">{g.title}</span>
                          <span className="text-xs text-stone-500">
                            {p.fraction != null ? `${Math.round(p.fraction * 100)}%` : g.status === "planning" ? "דורש תכנון" : "חסרים נתונים"}
                          </span>
                        </div>
                        <ProgressBar value={p.fraction} barClass={c.bar} label={g.title} />
                        <p className="mt-1 text-xs text-stone-500">
                          {todayForGoal.length
                            ? `היום: ${doneForGoal}/${todayForGoal.length} משימות למטרה הזו`
                            : p.missing.length
                              ? `חסר: ${p.missing.slice(0, 2).join(", ")}`
                              : "אין משימות להיום במטרה הזו"}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {events.length > 0 && (
            <Card className="animate-in">
              <SectionTitle>אירועים היום</SectionTitle>
              <ul className="space-y-2 text-sm">
                {events.map((e) => (
                  <li key={e.key} className="flex items-center gap-2">
                    <CalendarDays size={14} className="text-sky-600" />
                    <span className="ltr-nums w-12 text-stone-500">{e.event.startTime ?? "כל היום"}</span>
                    <span>{e.event.title}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="animate-in">
            <SectionTitle action={<Link href="/habits" className="text-sm text-accent-700 dark:text-accent-200">ניהול</Link>}>הרגלים להיום</SectionTitle>
            {habits.length === 0 ? (
              <p className="text-sm text-stone-500">
                אין הרגלים להיום. <Link href="/habits" className="text-accent-700">הוספת הרגל</Link>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {habits.map((h) => {
                  const log = db.habitLogs[`${h.id}:${today}`];
                  const isDone = log?.status === "done";
                  return (
                    <button
                      key={h.id}
                      onClick={() => void setHabitLog(h, today, isDone ? null : "done")}
                      aria-pressed={isDone}
                      className={cx(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                        isDone ? "border-accent-600 bg-accent-600 text-white" : "hairline hover:border-accent-500",
                      )}
                    >
                      {isDone && <Check size={14} />}
                      {h.title}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="animate-in">
            <SectionTitle>תזכורות קרובות</SectionTitle>
            {reminders.length === 0 ? (
              <p className="text-sm text-stone-500">אין תזכורות נוספות להיום.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {reminders.slice(0, 6).map((r) => (
                  <li key={r.key} className="flex items-center gap-2">
                    <Bell size={14} className="text-stone-400" />
                    <span className="ltr-nums w-12 text-stone-500">{r.time}</span>
                    <span className="truncate">{r.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="animate-in">
            <SectionTitle
              hint={`יום ${WEEKDAYS_HE[weekday(tomorrow)]}`}
              action={
                <Button size="sm" variant="ghost" onClick={() => openEditor({ defaults: { date: tomorrow } })}>
                  <Plus size={16} />
                </Button>
              }
            >
              הכנה למחר
            </SectionTitle>
            <ul className="space-y-1.5 text-sm text-stone-600 dark:text-stone-300">
              <li>{tomorrowList.length ? `${tomorrowList.length} משימות (${formatDuration(dayLoad(db, tomorrow, tomorrowList).plannedMinutes) || "ללא הערכת זמן"})` : "אין עדיין משימות למחר"}</li>
              {tomorrowEvents.length > 0 && <li>{tomorrowEvents.length} אירועים ביומן</li>}
              {tomorrowMeals.length > 0 && <li>{tomorrowMeals.length} ארוחות מתוכננות</li>}
              {tomorrowList.some((i) => i.task.routine === "grocery") && <li>מחר קניות — כדאי לבדוק את הרשימה</li>}
              {tomorrowList.some((i) => i.task.routine === "meal_prep") && <li>מחר הכנת אוכל</li>}
            </ul>
            <Link href="/calendar" className="mt-3 inline-flex items-center gap-1 text-sm text-accent-700 dark:text-accent-200">
              לתכנון השבוע <ArrowLeft size={14} />
            </Link>
          </Card>
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
    await updateSettings({
      displayName: name.trim(),
      availability: h == null ? settings.availability : [h, h, h, h, h, h, h],
      onboarded: true,
    });
  }

  return (
    <Card className="animate-in border-dashed">
      <SectionTitle hint="שלוש שאלות קצרות. אפשר לשנות הכול אחר כך בהגדרות.">ברוכים הבאים ל-LifeOS</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="איך לקרוא לך?">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        <Field label="שעות פנויות למשימות ביום" hint="לבדיקת עומס. ריק = לא להגדיר עכשיו">
          <Input type="number" inputMode="decimal" min={0} max={24} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="למשל 2" />
        </Field>
        <Field label="תאריך התחלה של המטרות השנתיות" hint="היעד: 12 חודשים מתאריך זה">
          <Input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" onClick={save}>
          שמירה והתחלה
        </Button>
        <Button variant="ghost" onClick={() => updateSettings({ onboarded: true })}>
          אחר כך
        </Button>
      </div>
      <p className="mt-2 text-xs text-stone-500">
        הוגדרו מראש: קניות בימי חמישי, הכנת אוכל בשלישי (גיבוי: שבת) וסיכום שבועי בשישי — ללא שעות, עד שתבחרו.
      </p>
    </Card>
  );
}
