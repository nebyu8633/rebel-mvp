"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Download, Upload, LogOut, UserRound, Clock, Repeat, UtensilsCrossed, Bell, Sparkles, Cloud, HardDrive, Gamepad2 } from "lucide-react";
import { useStore, useSettings } from "@/lib/store/store";
import { updateSettings, saveTask, uid } from "@/lib/actions";
import { SEED_IDS } from "@/lib/seed";
import { WEEKDAYS_HE, isValidTimeZone, nowInZone } from "@/lib/dates";
import { aiConfigured } from "@/lib/ai/client";
import { LocalRepository } from "@/lib/store/local";
import { hydrate } from "@/lib/store/repo";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { CollectionName, MealReminder } from "@/lib/types";
import { Badge, Button, Card, Details, Disclosure, Field, Input, PageHeader, Select, Toggle, confirmDialog } from "@/components/ui";
import { PushToggle } from "@/components/PushToggle";
import { NotifySettings, XpSettings } from "@/components/game/NotifySettings";

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
    <div className="space-y-3">
      <PageHeader title="הגדרות" />

      <Disclosure id="s-general" icon={<UserRound size={16} />} title="כללי" summary={`${settings.displayName || "ללא שם"} · ${settings.timezone}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="שם">
            <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== settings.displayName && updateSettings({ displayName: name.trim() })} maxLength={60} />
          </Field>
          <Field label="אזור זמן" hint={`עכשיו ${nowInZone(settings.timezone).time}`}>
            <Select value={settings.timezone} onChange={(e) => isValidTimeZone(e.target.value) && updateSettings({ timezone: e.target.value })}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Disclosure>

      <Disclosure id="s-availability" icon={<Clock size={16} />} title="זמינות" summary={availabilitySummary(settings.availability)}>
        <p className="mb-3 text-xs text-stone-500">שעות פנויות למשימות בכל יום. ריק = לא הוגדר.</p>
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
        <Details className="mt-2" label="למה זה חשוב">משמש לאזהרות עומס, לשיבוץ תוכניות ולתוכנית התאוששות.</Details>
      </Disclosure>

      <Disclosure id="s-routines" icon={<Repeat size={16} />} title="שגרות" summary={[grocery && `קניות: ${WEEKDAYS_HE[grocery.recurrence?.byWeekday?.[0] ?? 4]}`, review && `סיכום: ${WEEKDAYS_HE[review.recurrence?.byWeekday?.[0] ?? 5]}`].filter(Boolean).join(" · ")}>
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
          <a className="inline-block text-sm text-accent-700" href="/meals?tab=prep">
            ימי הכנת אוכל ←
          </a>
        </div>
      </Disclosure>

      <Disclosure
        id="s-meals"
        icon={<UtensilsCrossed size={16} />}
        title="תזכורות ארוחות"
        summary={reminders.filter((r) => r.enabled).map((r) => r.time).join(" · ") || "אין"}
        action={
          <Button size="icon" variant="ghost" aria-label="תזכורת ארוחה חדשה" onClick={() => setReminders([...reminders, { id: uid(), label: "ארוחה", time: "13:00", enabled: false }])}>
            <Plus size={16} />
          </Button>
        }
      >
        {reminders.length === 0 ? (
          <p className="text-sm text-stone-500">אין. רק שעות שתגדירו (+).</p>
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
      </Disclosure>

      <Disclosure id="s-notify" icon={<Bell size={16} />} title="התראות" summary={[settings.notifyInApp && "באפליקציה", settings.notifyBrowser && perm === "granted" && "דפדפן"].filter(Boolean).join(" · ") || "כבויות"}>
        <Toggle checked={settings.notifyInApp} onChange={(v) => updateSettings({ notifyInApp: v })} label="תזכורות בתוך האפליקציה" />
        <Toggle checked={settings.notifyBrowser && perm === "granted"} onChange={(v) => void enableBrowser(v)} label="התראות דפדפן" disabled={perm === "unsupported"} />
        <Field label="ברירת מחדל לתזכורת (דקות לפני)" className="mt-2 max-w-xs">
          <Input type="number" min={0} max={1440} defaultValue={settings.defaultReminderMinutes} onBlur={(e) => updateSettings({ defaultReminderMinutes: Math.max(0, Math.min(1440, Number(e.target.value) || 0)) })} />
        </Field>
        {perm === "denied" && <p className="mt-2 text-xs text-rose-600">ההרשאה נחסמה בדפדפן — יש לאפשר בהגדרות האתר.</p>}
        <NotifySettings />
        <PushToggle />
      </Disclosure>

      <Disclosure id="s-game" icon={<Gamepad2 size={16} />} title="משחק" summary="טבלת XP">
        <XpSettings />
      </Disclosure>

      <Card className="flex items-center gap-3 py-3.5">
        <Sparkles size={16} className="text-stone-400" />
        <span className="text-[15px] font-semibold">עוזר AI</span>
        {ai == null ? <span className="text-sm text-stone-500">…</span> : ai ? <Badge tone="accent">מחובר</Badge> : <Badge>לא מוגדר</Badge>}
        <Details className="ms-auto" label="מידע">המפתח נשמר רק בשרת (ANTHROPIC_API_KEY) ולא נשלח לדפדפן. בלי מפתח עובד מנוע בסיסי.</Details>
      </Card>

      <div id="data">
      <Disclosure id="s-data" icon={mode === "supabase" ? <Cloud size={16} /> : <HardDrive size={16} />} title="נתונים" summary={mode === "supabase" ? "בענן" : "מקומי · בדפדפן הזה"}>
        <p className="mb-3 text-sm text-stone-600 dark:text-stone-300">
          {mode === "supabase" ? "שמורים בענן, מוגנים בהתחברות." : "שמורים רק בדפדפן הזה — מומלץ לגבות."}
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
      </Disclosure>
      </div>
    </div>
  );
}

function availabilitySummary(av: Array<number | null>) {
  const set = av.filter((a) => a != null) as number[];
  if (!set.length) return "לא הוגדרה";
  const total = set.reduce((s, a) => s + a, 0);
  return `${Math.round((total / 60) * 10) / 10} שע׳ בשבוע`;
}
