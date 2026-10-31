"use client";
import { useEffect, useState } from "react";
import { nowInZone } from "@/lib/dates";
import { useSettings } from "@/lib/store/store";

export function useTimezone(): string {
  const s = useSettings();
  return s?.timezone || "Asia/Jerusalem";
}

/** Current date/time in the user's configured time zone; refreshes every 30s. */
export function useNow() {
  const tz = useTimezone();
  const [now, setNow] = useState(() => nowInZone(tz));
  useEffect(() => {
    setNow(nowInZone(tz));
    const t = setInterval(() => setNow(nowInZone(tz)), 30_000);
    return () => clearInterval(t);
  }, [tz]);
  return now;
}

export function useToday(): string {
  return useNow().date;
}
