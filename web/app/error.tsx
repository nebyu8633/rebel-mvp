"use client";

import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { getDictionary } from "@/lib/i18n";

const dict = getDictionary();

/**
 * Route-level error boundary (spec §48).
 *
 * The user always gets a Hebrew message and a way forward — retry or go home
 * — never a stack trace and never an indefinite spinner. The underlying error
 * goes to the console for diagnosis and is not shown, since it is English and
 * may leak internals.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <AlertCircle className="size-10 text-danger" aria-hidden="true" />
      <h1 className="mt-5 text-xl font-semibold">{dict.errors.generic}</h1>

      <div className="mt-7 flex gap-3">
        <Button onClick={reset}>{dict.common.retry}</Button>
        <ButtonLink href="/" variant="secondary">
          {dict.common.appName}
        </ButtonLink>
      </div>
    </main>
  );
}
