"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useStore } from "@/lib/store/store";
import { LocalRepository } from "@/lib/store/local";
import { SupabaseRepository } from "@/lib/store/supabase";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { supabaseEnabled } from "@/lib/supabase/config";
import { buildSeed } from "@/lib/seed";
import { todayInZone, isValidTimeZone } from "@/lib/dates";
import { Button, Skeleton } from "./ui";

function browserTz() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return tz && isValidTimeZone(tz) ? tz : "Asia/Jerusalem";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const init = useStore((s) => s.init);
  const router = useRouter();
  const pathname = usePathname();
  const [attempt, setAttempt] = useState(0);
  const isAuthPage = pathname?.startsWith("/login");

  useEffect(() => {
    if (isAuthPage) return;
    let cancelled = false;
    (async () => {
      const tz = browserTz();
      const seed = (db: Parameters<typeof buildSeed>[0]) => buildSeed(db, todayInZone(tz), tz, new Date().toISOString());
      if (supabaseEnabled) {
        const sb = getBrowserSupabase()!;
        const { data } = await sb.auth.getUser();
        if (cancelled) return;
        if (!data.user) {
          router.replace("/login");
          return;
        }
        await init(new SupabaseRepository(sb, data.user.id), seed);
      } else {
        await init(new LocalRepository(), seed);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [init, router, attempt, isAuthPage]);

  if (isAuthPage) return <>{children}</>;

  if (status === "error")
    return (
      <div className="mx-auto mt-24 max-w-sm px-4 text-center">
        <p className="mb-2 text-lg font-semibold">לא הצלחנו לטעון את הנתונים</p>
        <p className="mb-4 text-sm text-stone-500">{error}</p>
        <Button variant="primary" onClick={() => setAttempt((a) => a + 1)}>
          נסו שוב
        </Button>
      </div>
    );

  if (status !== "ready")
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-10" aria-busy="true" aria-label="טוען">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
      </div>
    );

  return <>{children}</>;
}
