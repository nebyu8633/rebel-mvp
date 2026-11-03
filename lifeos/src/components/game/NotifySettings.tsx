"use client";
import { useEffect, useMemo, useState } from "react";
import { Volume2 } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useNow } from "@/hooks/useToday";
import { profileOf, defaultProfile } from "@/lib/game/engine";
import { updateProfile } from "@/lib/game/actions";
import { CATEGORY_LABEL, scheduledReminders, type ReminderCategory } from "@/lib/game/notify";
import { readLog, type LogEntry } from "@/lib/game/notifyLog";
import { playSound, SOUND_LABEL, type SoundId } from "@/lib/game/sound";
import { deliver } from "@/components/ReminderEngine";
import { Button, Details, Field, Input, Select, Toggle, cx } from "@/components/ui";
import { nowIso } from "@/lib/actions";
import { LEVEL_LABEL, XP_TABLE } from "@/lib/game/difficulty";
import { GOAL_XP, MILESTONE_XP } from "@/lib/game/rewards";
import type { GameProfile } from "@/lib/types";

const CH_LABEL: Record<LogEntry["channels"][number], string> = { inapp: "באפליקציה", browser: "דפדפן", sound: "צליל", "push-device": "Push" };

export function NotifySettings() {
  const db = useStore((s) => s.db);
  const settings = Object.values(db.settings)[0];
  const now = useNow();
  const profile = profileOf(db) ?? defaultProfile(now.date, nowIso());
  const n = profile.notify;
  const setN = (patch: Partial<GameProfile["notify"]>) => void updateProfile({ notify: { ...n, ...patch } }, now.date);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [test, setTest] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setLog(readLog());
    read();
    window.addEventListener("lifeos:notify-log", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("lifeos:notify-log", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  const schedule = useMemo(() => scheduledReminders(db, now.date), [db, now.date]);

  const runTest = () => {
    const key = `test:${Date.now()}`;
    const ch = deliver(
      { key, title: "בדיקת התראה", body: "כך תיראה תזכורת של LifeOS", href: "/settings", date: now.date, time: now.time.slice(0, 5) },
      { inApp: true, browser: !!settings?.notifyBrowser, sound: n.sound, onOpen: () => undefined, note: "בדיקה" },
    );
    const parts = [ch.includes("inapp") ? "באפליקציה ✓" : "באפליקציה ✗"];
    parts.push(n.sound === "none" ? "צליל: כבוי" : ch.includes("sound") ? "צליל ✓" : "צליל ✗ (הדפדפן חסם השמעה)");
    if (!settings?.notifyBrowser) parts.push("דפדפן: כבוי");
    else if (typeof Notification === "undefined") parts.push("דפדפן: לא נתמך");
    else if (Notification.permission !== "granted") parts.push("דפדפן ✗ (אין הרשאה)");
    else parts.push(ch.includes("browser") ? "דפדפן ✓" : "דפדפן ✗");
    setTest(parts.join(" · "));
  };

  const statusOf = (r: (typeof schedule)[number]) => {
    const delivered = log.find((l) => l.key === r.key);
    if (delivered) return { label: `נשלחה ${new Date(delivered.deliveredAt).toTimeString().slice(0, 5)} · ${delivered.channels.map((c) => CH_LABEL[c]).join(", ")}`, cls: "text-emerald-700 dark:text-emerald-300" };
    if (r.muted === "quiet") return { label: "מושתקת (שעות שקט)", cls: "text-stone-400" };
    if (r.muted === "category") return { label: "מושתקת (קטגוריה כבויה)", cls: "text-stone-400" };
    if (r.at > now.minutes) return { label: "מתוזמנת", cls: "text-stone-500" };
    return { label: "לא נשלחה במכשיר הזה (האפליקציה הייתה סגורה)", cls: "text-amber-700 dark:text-amber-300" };
  };

  return (
    <div className="mt-4 space-y-4 border-t hairline pt-4" data-testid="notify-settings">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="צליל">
          <div className="flex gap-2">
            <Select value={n.sound} onChange={(e) => setN({ sound: e.target.value as GameProfile["notify"]["sound"] })}>
              {(Object.keys(SOUND_LABEL) as Array<keyof typeof SOUND_LABEL>).map((k) => (
                <option key={k} value={k}>
                  {SOUND_LABEL[k]}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="ghost" onClick={() => playSound(n.sound as SoundId)} disabled={n.sound === "none"} aria-label="השמעת הצליל">
              <Volume2 size={16} />
            </Button>
          </div>
        </Field>
        <Field label="שעות שקט" hint="בשעות האלה רק תזכורות בעדיפות גבוהה יישלחו">
          <div className="flex items-center gap-2">
            <Input type="time" value={n.quietStart ?? ""} onChange={(e) => setN({ quietStart: e.target.value || null })} aria-label="תחילת שעות שקט" />
            <span className="text-stone-400">–</span>
            <Input type="time" value={n.quietEnd ?? ""} onChange={(e) => setN({ quietEnd: e.target.value || null })} aria-label="סוף שעות שקט" />
          </div>
        </Field>
      </div>

      <div>
        <Toggle checked={n.prepAndFollowUp} onChange={(v) => setN({ prepAndFollowUp: v })} label="הכנה, התחלה ומעקב למשימות עם שעה" />
        {n.prepAndFollowUp && (
          <div className="mt-2 grid max-w-md grid-cols-2 gap-3">
            <Field label="הכנה (דקות לפני)">
              <Input type="number" min={0} max={240} value={n.prepMinutes} onChange={(e) => setN({ prepMinutes: Math.max(0, Math.min(240, Number(e.target.value) || 0)) })} />
            </Field>
            <Field label="מעקב (דקות אחרי ההתחלה)">
              <Input type="number" min={0} max={240} value={n.followUpMinutes} onChange={(e) => setN({ followUpMinutes: Math.max(0, Math.min(240, Number(e.target.value) || 0)) })} />
            </Field>
          </div>
        )}
        <p className="mt-1 text-xs text-stone-500">למשל אימון ב-18:00: הכנה ב-17:45, „הגיע הזמן” ב-18:00, ו„התחלת?” ב-18:15 — רק אם עוד לא סומן.</p>
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">סוגי תזכורות</span>
        <div className="grid gap-1 sm:grid-cols-2">
          {(Object.keys(CATEGORY_LABEL) as ReminderCategory[]).map((c) => (
            <Toggle key={c} checked={n.categories[c]} onChange={(v) => setN({ categories: { ...n.categories, [c]: v } })} label={CATEGORY_LABEL[c]} />
          ))}
        </div>
      </div>

      <div>
        <Button size="sm" onClick={runTest} data-testid="notify-test">
          בדיקת התראה עכשיו
        </Button>
        {test && (
          <p className="mt-1.5 text-xs text-stone-600 dark:text-stone-300" data-testid="notify-test-result">
            {test}
          </p>
        )}
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">היום: מתוזמן מול נשלח</span>
        {schedule.length === 0 ? (
          <p className="text-xs text-stone-500">אין תזכורות מתוזמנות להיום.</p>
        ) : (
          <ul className="divide-y hairline rounded-xl border hairline text-sm" data-testid="notify-log">
            {schedule.map((r) => {
              const st = statusOf(r);
              return (
                <li key={r.key} className="flex flex-wrap items-baseline gap-x-2 px-3 py-2">
                  <span className="w-11 shrink-0 text-xs text-stone-500 ltr-nums">{r.time}</span>
                  <span className="min-w-0 flex-1 truncate">{r.title}</span>
                  <span className="text-[11px] text-stone-400">{CATEGORY_LABEL[r.category]}</span>
                  <span className={cx("w-full ps-13 text-[11px]", st.cls)}>{st.label}</span>
                </li>
              );
            })}
          </ul>
        )}
        {log.filter((l) => l.key.startsWith("test:") || l.key.includes(":snz")).length > 0 && (
          <p className="mt-1 text-[11px] text-stone-500">
            נשלחו גם: {log.filter((l) => l.key.startsWith("test:") || l.key.includes(":snz")).slice(-5).map((l) => `${l.title} (${new Date(l.deliveredAt).toTimeString().slice(0, 5)})`).join(", ")}
          </p>
        )}
      </div>

      <Details label="מגבלות — חשוב לדעת">
        אתר אינטרנט לא יכול לפעול כמו שעון מעורר של הטלפון: התזכורות באפליקציה, הצליל והתראות הדפדפן פועלים רק כשהאתר פתוח בלשונית כלשהי (גם ברקע). צליל מושמע רק אחרי שנגעת בדף לפחות פעם אחת. כשהאתר סגור לגמרי — רק Web Push, כשהשרת מוגדר (למטה); בתלות במכשיר, ההתראה עשויה להגיע באיחור או בלי צליל. ב-iPhone: Web Push רק אחרי „הוספה למסך הבית” (iOS 16.4 ומעלה). תזכורת שהוחמצה ביותר מ-10 דקות לא נשלחת בדיעבד, וכל תזכורת נשלחת פעם אחת בלבד.
      </Details>
    </div>
  );
}

/** The XP table (read-only: rewards are set by the evaluation model, not by the player). */
export function XpSettings() {
  return (
    <div className="space-y-3" data-testid="xp-settings">
      <table className="w-full max-w-md text-sm">
        <thead>
          <tr className="text-xs text-stone-500">
            <th className="py-1 text-start font-medium">רמת קושי</th>
            <th className="py-1 text-start font-medium">XP</th>
          </tr>
        </thead>
        <tbody>
          {([1, 2, 3, 4, 5] as const).map((l) => (
            <tr key={l} className="border-t hairline">
              <td className="py-1.5">
                {l} · {LEVEL_LABEL[l]}
              </td>
              <td className="py-1.5 ltr-nums">
                {XP_TABLE[l][0]}–{XP_TABLE[l][1]}
              </td>
            </tr>
          ))}
          <tr className="border-t hairline">
            <td className="py-1.5">אבן דרך</td>
            <td className="py-1.5 ltr-nums">
              {MILESTONE_XP.minor}–{MILESTONE_XP.epic_plus}
            </td>
          </tr>
          <tr className="border-t hairline">
            <td className="py-1.5">מטרה שהושגה</td>
            <td className="py-1.5 ltr-nums">{GOAL_XP}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-stone-500">
        הקושי מוערך לפי ההיקף האמיתי של המשימה (זמן, מורכבות, מאמץ, היקף, וקשר קטן למטרה). אי אפשר לבחור XP — אפשר להבהיר את היקף המשימה. XP ניתן רק אחרי השלמה מאומתת, ובמצב ענן מחושב בשרת בלבד.
      </p>
    </div>
  );
}
