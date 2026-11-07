"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui";

/** The form-based planner was replaced by the conversational workspace. Old links keep working. */
export default function LegacyPlannerRedirect() {
  return (
    <Suspense>
      <Redirect />
    </Suspense>
  );
}

function Redirect() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const g = params.get("goal");
    router.replace(g ? `/goals/${g}/chat` : "/goals/new");
  }, [params, router]);
  return (
    <div className="flex items-center gap-2 p-8 text-sm text-stone-500">
      <Spinner /> מעביר לשיחת התכנון…
    </div>
  );
}
