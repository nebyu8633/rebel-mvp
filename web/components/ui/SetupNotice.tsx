import { Settings2 } from "lucide-react";

import { Ltr } from "@/components/ui/Ltr";
import { getDictionary } from "@/lib/i18n";

const dict = getDictionary();

const ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AI_API_KEY",
] as const;

/**
 * Shown when the app is running without a Supabase project configured.
 *
 * A fresh checkout has no credentials, and letting the Supabase client throw
 * there produces an English stack trace that says nothing about what to do.
 * This states the three concrete steps instead.
 *
 * Every file path and variable name is LTR-isolated: dropped into Hebrew flow
 * text unisolated, ".env.local" renders as "env.local." and a path's slashes
 * end up in the wrong places.
 *
 * `headingLevel` lets the caller keep the document outline correct — this is
 * the only heading on the dashboard's setup screen, but it sits under an
 * existing h1 on the upload page.
 */
export function SetupNotice({
  headingLevel = "h2",
}: {
  headingLevel?: "h1" | "h2";
}) {
  const Heading = headingLevel;

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-6">
      <Heading className="flex items-center gap-2 text-base font-semibold text-content">
        <Settings2 className="size-4 shrink-0 text-warning" aria-hidden="true" />
        {dict.setup.title}
      </Heading>

      <ol className="mt-4 space-y-2 text-sm leading-relaxed text-content-muted">
        <li className="flex gap-2.5">
          <Step n={1} />
          {dict.setup.step1}
        </li>
        <li className="flex gap-2.5">
          <Step n={2} />
          <span>
            {dict.setup.step2Before}{" "}
            <Ltr className="text-content">{dict.setup.step2Path}</Ltr>
          </span>
        </li>
        <li className="flex gap-2.5">
          <Step n={3} />
          <span>
            {dict.setup.step3Before}{" "}
            <Ltr className="text-content">{dict.setup.step3Path}</Ltr>
          </span>
        </li>
      </ol>

      <p className="mt-5 text-xs font-medium text-content-subtle">
        {dict.setup.envTitle}
      </p>
      <ul className="mt-2 space-y-1">
        {ENV_VARS.map((name) => (
          <li key={name} className="text-xs text-content-subtle">
            <Ltr>{name}</Ltr>
          </li>
        ))}
      </ul>

      <p className="mt-5 border-t border-border pt-4 text-xs text-content-subtle">
        {dict.setup.readmeNote}
      </p>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-warning/15 text-[11px] font-semibold text-warning"
    >
      {n}
    </span>
  );
}
