"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Download, Upload, LogOut } from "lucide-react";
import { useStore, useSettings } from "@/lib/store/store";
import { updateSettings, saveTask, uid } from "@/lib/actions";
import { SEED_IDS } from "@/lib/seed";
import { WEEKDAYS_HE, isValidTimeZone, nowInZone } from "@/lib/dates";
import { aiConfigured } from "@/lib/ai/client";
import { LocalRepository } from "@/lib/store/local";
import { hydrate } from "@/lib/store/repo";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { CollectionName, MealReminder } from "@/lib/types";
import { Badge, Button, Card, Field, Input, PageHeader, SectionTitle, Select, Toggle, confirmDialog } from "@/components/ui";

export default function SettingsPage() {
  const settings = useSettings();
  const db = useStore((s) => s.db);
  const mode = useStore((s) => s.mode);
  const toast = useStore((s) => s.toast);
  const [name, setName] = useState(settings?.displayName ?? "");
  const [ai, setAi] = useState<boolean | null>(null);
  const [perm, setPerm] = useState<string>("default");
  useEffect(() => {
    aiConfigured().then(setAi);
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    else setPerm("unsupported");
  }, []);
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
    } catch {
      return ["Asia/Jerusalem", "Europe/London", "America/New_York", "UTC"];
    }
  }, []);
  if (!settings) return null;

  const routine = (id: string) => db.tasks[id];
  const grocery = routine(SEED_IDS.grocery);
  const review = routine(SEED_IDS.review);

  async function setRoutineDay(id: string, day: number) {
    const t = routine(id);
    if (t?.recurrence) await saveTask({ ...t, recurrence: { ...t.recurrence, byWeekday: [day] } });
  }
  async function setRoutineTime(id: string, time: string) {
    const t = routine(id);
    if (t) await saveTask({ ...t, startTime: time || null, reminderMinutes: time ? (t.reminderMinutes ?? settings!.defaultReminderMinutes) : null });
  }

  async function enableBrowser(v: boolean) {
    if (!v) return updateSettings({ notifyBrowser: false });
    if (typeof Notification === "undefined") return toast("הדפדפן הזה לא תומך בהתראות", "error");
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p !== "granted") return toast("לא ניתנה הרשאה להתראות בדפדפן", "error");
    try {
      await navigator.serviceWorker?.register("/sw.js");
    } catch {
      /* optional */
    }
    await updateSettings({ notifyBrowser: true });
  }

  function exportData() {
    const blob = new Blob([LocalRepository.exportJSON(db)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lifeos-backup-${nowInZone(settings!.timezone).date}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importData(file: File) {
    try {
      const json = JSON.parse(await file.text());
      const { db: imported, invalid } = hydrate(json.db ?? json);
      const count = Object.values(imported).reduce((s, c) => s + Object.keys(c).length, 0);
      if (!(await confirmDialog({ title: "ייבוא גיבוי", message: `${count} רשומות ימוזגו לנתונים הקיימים (רשומות עם אותו מזהה יוחלפו).${invalid.length ? ` ${invalid.length} רשומות לא תקינות ידולגו.` : ""}`, confirmLabel: "ייבוא" }))) return;
      const items: Array<[CollectionName, unknown]> = [];
      for (const [c, recs] of Object.entries(imported)) for (const r of Object.values(recs as Record<string, unknown>)) items.push([c as CollectionName, r]);
      const order: CollectionName[] = ["settings", "goals", "financeAccounts", "milestones", "objectives", "tasks", "occurrences", "events", "habits", "habitLogs", "meals", "mealWeeks", "mealPlan", "groceries", "pantry", "financeEntries", "weightLogs"];
      items.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
      if (await useStore.getState().putMany(items)) toast(`יובאו ${items.length} רשומות`, "success");
    } catch {
      toast("הקובץ אינו גיבוי תקין של LifeOS", "error");
    }
  }

  const reminders = settings.mealReminders;
  const setReminders = (r: MealReminder[]) => updateSettings({ mealReminders: r });

  return (
    <div className="space-y-5">
      <PageHeader title="הגדרות" />

      <Card>
        <SectionTitle>כללי</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="שם">
            <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== settings.displayName && updateSettings({ displayName: name.trim() })} maxLength={60} />
          </Field>
          <Field label="אזור זמן" hint={`השעה עכשיו: ${nowInZone(settings.timezone).time}. כל התאריכים והתזכורות מחושבים לפיו.`}>
            <Select value={settings.timezone} onChange={(e) => isValidTimeZone(e.target.value) && updateSettings({ timezone: e.target.value })}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="mt-2 text-xs text-stone-500">השבוע מתחיל ביום ראשון.</p>
      </Card>

      <Card>
        <SectionTitle hint="כמה זמן פנוי למשימות בכל יום. משמש לאזהרות עומס, לשיבוץ תוכניות ולתוכנית התאוששות. ריק = לא הוגדר.">זמינות</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {WEEKDAYS_HE.map((d, i) => (
            <Field key={i} label={d}>
              <Input
                inputMode="decimal"
                placeholder="שעות"
                defaultValue={settings.availability[i] == null ? "" : String(settings.availability[i]! / 60)}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  const n = v === "" ? null : Math.round(Number(v) * 60);
                  if (n !== null && (Number.isNaN(n) || n < 0 || n > 1440)) return toast("ערך לא תקין (0–24 שעות)", "error");
                  const next = settings.availability.slice();
                  next[i] = n;
                  void updateSettings({ availability: next });
                }}
                aria-label={`שעות פנויות ביום ${d}`}
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle hint="שגרות הן משימות חוזרות רגילות — אפשר גם לערוך אותן במסך המשימות.">שגרות</SectionTitle>
        <div className="space-y-4">
          {grocery ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="self-center font-medium">קניות</div>
              <Field label="יום">
                <Select value={grocery.recurrence?.byWeekday?.[0] ?? 4} onChange={(e) => void setRoutineDay(SEED_IDS.grocery, Number(e.target.value))}>
                  {WEEKDAYS_HE.map((d, i) => (
                    <option key={i} value={i}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="שעה (לתזכורת)">
                <Input type="time" defaultValue={grocery.startTime ?? ""} onBlur={(e) => e.target.value !== (grocery.startTime ?? "") && void setRoutineTime(SEED_IDS.grocery, e.target.value)} />
              </Field>
            </div>
          ) : (
            <p className="text-sm text-stone-500">שגרת הקניות נמחקה.</p>
          )}
          {review ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="self-center font-medium">סיכום שבועי</div>
              <Field label="יום">
                <Select value={review.recurrence?.byWeekday?.[0] ?? 5} onChange={(e) => void setRoutineDay(SEED_IDS.review, Number(e.target.value))}>
                  {WEEKDAYS_HE.map((d, i) => (
                    <option key={i} value={i}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="שעה">
                <Input type="time" defaultValue={review.startTime ?? ""} onBlur={(e) => e.target.value !== (review.startTime ?? "") && void setRoutineTime(SEED_IDS.review, e.target.value)} />
              </Field>
            </div>
          ) : null}
          <p className="text-sm text-stone-500">
            ימי הכנת אוכל (מועדף וגיבוי) — בעמוד <a className="text-accent-700" href="/meals?tab=prep">אוכל וקניות ← הכנה</a>.
          </p>
        </div>
      </Card>

      <Card>
        <SectionTitle
          hint="רק שעות שתגדירו. אין שעות ברירת מחדל."
          action={
            <Button size="sm" variant="ghost" onClick={() => setReminders([...reminders, { id: uid(), label: "ארוחה", time: "13:00", enabled: false }])}>
              <Plus size={14} /> תזכורת
            </Button>
          }
        >
          תזכורות ארוחות
        </SectionTitle>
        {reminders.length === 0 ? (
          <p className="text-sm text-stone-500">לא הוגדרו תזכורות ארוחות.</p>
        ) : (
          <ul className="space-y-2">
            {reminders.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <Input className="w-36" value={r.label} aria-label="שם" onChange={(e) => setReminders(reminders.map((x) => (x.id === r.id ? { ...x, label: e.target.value || "ארוחה" } : x)))} />
                <Input className="w-28" type="time" value={r.time} aria-label="שעה" onChange={(e) => e.target.value && setReminders(reminders.map((x) => (x.id === r.id ? { ...x, time: e.target.value } : x)))} />
                <Toggle checked={r.enabled} onChange={(v) => setReminders(reminders.map((x) => (x.id === r.id ? { ...x, enabled: v } : x)))} label={<span className="sr-only">פעילה</span>} />
                <Button size="icon" variant="ghost" aria-label="מחיקה" onClick={() => setReminders(reminders.filter((x) => x.id !== r.id))}>
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>התראות</SectionTitle>
        <Toggle checked={settings.notifyInApp} onChange={(v) => updateSettings({ notifyInApp: v })} label="תזכורות בתוך האפליקציה" />
        <Toggle checked={settings.notifyBrowser && perm === "granted"} onChange={(v) => void enableBrowser(v)} label="התראות דפדפן" disabled={perm === "unsupported"} />
        <Field label="ברירת מחדל לתזכורת (דקות לפני)" className="mt-2 max-w-xs">
          <Input type="number" min={0} max={1440} defaultValue={settings.defaultReminderMinutes} onBlur={(e) => updateSettings({ defaultReminderMinutes: Math.max(0, Math.min(1440, Number(e.target.value) || 0)) })} />
        </Field>
        <div className="mt-3 rounded-xl bg-stone-50 p-3 text-xs leading-relaxed text-stone-600 dark:bg-white/[0.03] dark:text-stone-300">
          <b>חשוב לדעת:</b> התזכורות פועלות כל עוד LifeOS פתוח בלשונית כלשהי בדפדפן (גם ברקע). כשכל הלשוניות סגורות — לא תצא תזכורת, ותזכורת שהוחמצה ביותר מ-10 דקות לא תוצג בדיעבד. אין כרגע שרת Push, ולכן אין
          התחייבות להתראות כשהאפליקציה סגורה. בטלפון: מומלץ ״הוספה למסך הבית״; ב-iOS התראות דפדפן נתמכות רק לאפליקציה שהותקנה למסך הבית. כל תזכורת נשלחת פעם אחת בלבד, גם אם פתוחות כמה לשוניות.
          {perm === "denied" && <div className="mt-1 text-rose-600">ההרשאה להתראות נחסמה בדפדפן — יש לאפשר אותה בהגדרות האתר.</div>}
        </div>
        {settings.notifyBrowser && perm === "granted" && (
          <Button size="sm" className="mt-3" onClick={() => new Notification("LifeOS", { body: "בדיקת התראה ✓", lang: "he", dir: "rtl" })}>
            שליחת התראת בדיקה
          </Button>
        )}
      </Card>

      <Card>
        <SectionTitle>עוזר AI</SectionTitle>
        <p className="text-sm">
          {ai == null ? "בודק…" : ai ? <Badge tone="accent">מחובר (Anthropic, דרך השרת)</Badge> : <Badge>לא מוגדר</Badge>}
        </p>
        <p className="mt-2 text-xs text-stone-500">
          המפתח נשמר רק בשרת (משתנה הסביבה ANTHROPIC_API_KEY) ולעולם לא נשלח לדפדפן. בלי מפתח, המתכנן והעוזר עובדים עם מנוע בסיסי ללא AI.
        </p>
      </Card>

      <Card id="data">
        <SectionTitle>נתונים</SectionTitle>
        <p className="mb-3 text-sm">
          {mode === "supabase" ? (
            <>הנתונים נשמרים בענן (Supabase), מוגנים בהתחברות ובהרשאות ברמת השורה.</>
          ) : (
            <>
              <b>מצב מקומי:</b> הנתונים נשמרים רק בדפדפן הזה (localStorage). ניקוי נתוני האתר ימחק אותם, והם לא מסתנכרנים בין מכשירים. מומלץ לגבות מדי פעם.
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportData}>
            <Download size={16} /> ייצוא גיבוי (JSON)
          </Button>
          <label className="inline-flex">
            <input type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && void importData(e.target.files[0])} />
            <span className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border hairline px-4 text-sm font-medium hover:bg-stone-50 dark:hover:bg-white/5">
              <Upload size={16} /> ייבוא גיבוי
            </span>
          </label>
          {mode === "supabase" && (
            <Button
              variant="ghost"
              onClick={async () => {
                await getBrowserSupabase()?.auth.signOut();
                window.location.href = "/login";
              }}
            >
              <LogOut size={16} /> התנתקות
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
