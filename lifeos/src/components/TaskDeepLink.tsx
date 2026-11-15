"use client";
import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { instanceFromKey } from "@/lib/actions";

/**
 * Deep link from a reminder: `?task=<instanceKey>` opens that task's sheet (complete, snooze,
 * reschedule, edit). The parameter is removed afterwards so back/refresh don't reopen it.
 */
function Inner() {
  const params = useSearchParams();
  const key = params.get("task");
  const status = useStore((s) => s.status);
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (!key || status !== "ready") return;
    const inst = instanceFromKey(useStore.getState().db, key);
    if (inst) useUI.getState().openEditor({ instance: inst });
    else useStore.getState().toast("המשימה מהתזכורת כבר לא קיימת", "info");
    router.replace(path ?? "/today", { scroll: false });
  }, [key, status, router, path]);
  return null;
}

export function TaskDeepLink() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
