"use client";
import { useEffect, useState } from "react";
import { VAPID_PUBLIC_KEY } from "@/lib/push/config";
import { useStore } from "@/lib/store/store";
import { Button, Badge } from "./ui";

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
  if (!status) return null;
  if (!status.available || mode !== "supabase" || !supported)
    return (
      <p className="mt-2 text-xs text-stone-500">
        <Badge>לא פעיל</Badge> התראות כשהאפליקציה סגורה דורשות שמירה בענן (Supabase), מפתחות VAPID ותזמון בשרת.
        {!supported ? " הדפדפן הזה לא תומך ב-Web Push." : status.missing.length ? ` חסר בשרת: ${status.missing.join(", ")}.` : mode !== "supabase" ? " האפליקציה רצה במצב מקומי." : ""}
      </p>
    );

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
      <span className="text-sm">התראות גם כשהאפליקציה סגורה (Web Push):</span>
      {on ? (
        <>
          <Badge tone="accent">פעיל במכשיר הזה</Badge>
          <Button size="sm" variant="ghost" disabled={busy} onClick={disable}>
            כיבוי
          </Button>
        </>
      ) : (
        <Button size="sm" disabled={busy} onClick={enable}>
          הפעלה במכשיר הזה
        </Button>
      )}
    </div>
  );
}
