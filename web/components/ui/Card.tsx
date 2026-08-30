import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface p-5 sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn("text-base font-semibold text-content", className)}>{children}</h2>
  );
}

export function CardLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-sm text-content-muted", className)}>{children}</p>
  );
}
