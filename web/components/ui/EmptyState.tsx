import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Empty states are a designed surface, not a fallback (spec §49, §61). When
 * there is no data we say so plainly and point at the one action that changes
 * it — never a placeholder or an invented example.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed",
        "border-border bg-surface/50 px-6 py-14 text-center",
        className,
      )}
    >
      {icon !== undefined && (
        <div className="mb-4 text-content-subtle" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-content">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-content-muted">{body}</p>
      {action !== undefined && <div className="mt-6">{action}</div>}
    </div>
  );
}
