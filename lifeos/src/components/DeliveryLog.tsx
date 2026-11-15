"use client";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Row = { reminder_key: string; sent_at: string; status?: string | null; error?: string | null; late?: boolean | null };

/**
 * What the server actually sent in the last 24 hours (push_deliveries, the user's own rows via RLS).
 * "Sent" means Apple/Google's push service accepted it — the app can't know whether it was displayed.
 */
export function DeliveryLog() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tracked, setTracked] = useState(true);
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    void (async () => {
      const full = await sb.from("push_deliveries").select("reminder_key,sent_at,status,error,late").gte("sent_at", since).order("sent_at", { ascending: false }).limit(50);
      if (!full.error) return setRows((full.data as Row[]) ?? []);
      // reliability migration not applied: only the claim time exists
      setTracked(false);
      const basic = await sb.from("push_deliveries").select("reminder_key,sent_at").gte("sent_at", since).order("sent_at", { ascending: false }).limit(50);
      setRows((basic.data as Row[]) ?? []);
    })();
  }, []);
  if (!rows) return null;
  const failed = rows.filter((r) => r.status === "failed" || r.status === "partial");
  const last = rows[0] ? new Date(rows[0].sent_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <div className="w-full rounded-field bg-surface-2 px-3 py-2 text-footnote text-ink-2">
      {rows.length === 0 ? (
        "לא נשלחו התראות מהשרת ב-24 השעות האחרונות."
      ) : (
        <>
          ב-24 השעות האחרונות: {rows.length} התראות, האחרונה ב-<span className="tnum">{last}</span>
          {tracked && failed.length > 0 && <span className="text-danger"> · {failed.length} לא הגיעו לכל המכשירים ({failed[0].error ?? "שגיאה"})</span>}
          {!tracked && <span className="text-ink-3"> · מעקב הצלחה/כישלון יופעל אחרי עדכון מסד הנתונים</span>}
        </>
      )}
    </div>
  );
}
