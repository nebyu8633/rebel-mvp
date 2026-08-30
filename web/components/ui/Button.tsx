import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  // The single accent is reserved for the primary action, so on any screen
  // there is never a question about what to do next (spec §69).
  primary:
    "bg-accent text-ground hover:bg-accent-strong font-semibold shadow-lg shadow-accent/20",
  secondary:
    "bg-surface-2 text-content hover:bg-border border border-border hover:border-border-strong",
  ghost: "text-content-muted hover:text-content hover:bg-surface-2",
  danger: "bg-danger/10 text-danger hover:bg-danger/20 border border-danger/30",
};

const SIZES: Record<Size, string> = {
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg transition-colors " +
  "disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: CommonProps & { href: string }) {
  return (
    <Link href={href} className={cn(BASE, VARIANTS[variant], SIZES[size], className)}>
      {children}
    </Link>
  );
}
