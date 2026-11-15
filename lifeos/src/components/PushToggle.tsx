"use client";
import { useEffect, useState } from "react";
import { VAPID_PUBLIC_KEY } from "@/lib/push/config";
import { useStore } from "@/lib/store/store";
import { Button, Badge, Details } from "./ui";
import { DeliveryLog } from "./DeliveryLog";

const FLAG = "lifeos:push:on";

function b64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Background notifications via Web Push. Shown as available ONLY when the server reports
 * that push is fully configured (and the app runs with Supabase sign-in).
 */
export function PushToggle() {
  const mode = useStore((s) => s.mode);
  const toast = useStore((s) => s.toast);
  const [status, setStatus] = useState<{ available: boolean; missing: string[] } | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/push/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ available: false, missing: ["server"] }));
    try {
      setOn(localStorage.getItem(FLAG) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  const ios = typeof navigator !== "undefined" && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1));
  const installed = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  if (!status) return null;

  // iPhone/iPad: Web Push exists only for an app added to the Home Screen (iOS 16.4+)
  if (ios && !installed)
    return (
      <div className="mt-3 rounded-field bg-surface-2 p-3 text-sm">
        <div className="font-medium text-ink">התראות כשהאפליקציה סגורה — באייפון</div>
        <ol className="mt-1.5 list-decimal space-y-0.5 ps-5 text-ink-2">
          <li>בספארי: כפתור השיתוף (ריבוע עם חץ).</li>
          <li>„הוספה למסך הבית”.</li>
          <li>לפתוח את LifeOS מהאייקון, ולהפעיל כאן.</li>
        </ol>
        <p className="mt-1.5 text-footnote text-ink-3">דורש iOS 16.4 ומעלה. עד אז התזכורות מופיעות רק כשהאפליקציה פתוחה.</p>
      </div>
    );

  if (!status.available || mode !== "supabase" || !supported)
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span>התראות כשהאפליקציה סגורה</span>
        <Badge>לא פעיל</Badge>
        <Details label="למה">
          {!supported
            ? "הדפדפן הזה לא תומך ב-Web Push."
            : mode !== "supabase"
              ? "האפליקציה רצה במצב מקומי (בלי חשבון בענן), ולשרת אין דרך לדעת מה לשלוח."
              : `ההגדרה בשרת לא הושלמה (חסר: ${status.missing.join(", ")}).`}{" "}
          עד אז התזכורות מופיעות רק כשהאפליקציה פתוחה.
        </Details>
      </div>
    );

  async function sendTest() {
    setBusy(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "הבדיקה נכשלה");
      if (j.accepted) toast(`נשלחה בדיקה ל-${j.accepted} ${j.accepted === 1 ? "מכשיר" : "מכשירים"}. אם לא הופיעה התראה תוך דקה — משהו בדרך לא עובד.`, "info");
      else toast(`שירות ההתראות דחה את המשלוח (${(j.failures ?? []).join(", ")})`, "error");
    } catch (e) {
      toast(e instanceof Error ? e.message : "הבדיקה נכשלה", "error");
    } finally {
      setBusy(false);
    }
  }

  async function enable() {
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== "granted") return toast("לא ניתנה הרשאה להתראות", "error");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID_PUBLIC_KEY) }));
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "שמירת המנוי נכשלה");
      localStorage.setItem(FLAG, "1");
      setOn(true);
      toast("התראות ברקע הופעלו במכשיר הזה", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "ההפעלה נכשלה", "error");
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      localStorage.removeItem(FLAG);
      setOn(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-sm">התראות כשהאפליקציה סגורה</span>
      {on ? (
        <>
          <Badge tone="accent">רשום במכשיר הזה</Badge>
          <Button size="sm" disabled={busy} onClick={sendTest}>
            שליחת התראת בדיקה
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={disable}>
            כיבוי
          </Button>
        </>
      ) : (
        <Button size="sm" disabled={busy} onClick={enable}>
          הפעלה במכשיר הזה
        </Button>
      )}
      {on && <DeliveryLog />}
      {on && (
        <p className="w-full text-footnote text-ink-3">
          ההתראה מגיעה בתוך דקה-שתיים מהזמן, לא בדיוק של שעון מעורר. תזכורות מתוזמנות נשלחות רק כשהמתזמן בשרת פועל.
        </p>
      )}
    </div>
  );
}
