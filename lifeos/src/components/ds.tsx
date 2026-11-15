"use client";
/**
 * LifeOS design-system building blocks for the daily screens (lists rather than cards).
 * Tokens live in globals.css (`--surface`, `--ink-2`, `--accent` …) and are exposed as Tailwind
 * utilities (`bg-surface`, `text-ink-2`, `border-line`, `rounded-panel`, `text-headline` …).
 */
import { forwardRef, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cx } from "./ui";

/** A titled group of rows: small caption heading, hairline-separated rows, no heavy card chrome. */
export function Section({ title, action, children, className, flush }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={cx("animate-in", className)}>
      {(title || action) && (
        <div className="mb-1.5 flex min-h-8 items-center justify-between gap-2 px-1">
          {title && <h2 className="text-footnote font-semibold text-ink-2">{title}</h2>}
          {action}
        </div>
      )}
      <div className={cx(!flush && "overflow-hidden rounded-panel border border-line bg-surface")}>{children}</div>
    </section>
  );
}

/** One list row (≥ 52px): leading control, title + meta, trailing accessory. Rows separate with hairlines. */
export function ListRow({
  leading,
  title,
  meta,
  trailing,
  onClick,
  muted,
  className,
  "aria-label": ariaLabel,
}: {
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  muted?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const body = (
    <span className="flex min-w-0 flex-1 flex-col py-3">
      <span className={cx("truncate text-body", muted ? "text-ink-3 line-through decoration-ink-3/50" : "text-ink")}>{title}</span>
      {meta && <span className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-footnote text-ink-2">{meta}</span>}
    </span>
  );
  return (
    <div className={cx("flex min-h-[52px] items-center gap-3 border-b border-line ps-3 pe-2 last:border-b-0", className)}>
      {leading}
      {onClick ? (
        <button type="button" onClick={onClick} aria-label={ariaLabel} className="flex min-w-0 flex-1 items-center text-start focus-visible:outline-none">
          {body}
        </button>
      ) : (
        body
      )}
      {trailing && <span className="flex shrink-0 items-center gap-0.5">{trailing}</span>}
    </div>
  );
}

/** The round completion control (44×44 hit area, 22px circle). */
export const CheckCircle = forwardRef<HTMLButtonElement, { checked: boolean; onToggle: () => void; label: string; tone?: "accent" | "danger" }>(function CheckCircle(
  { checked, onToggle, label, tone = "accent" },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className="-ms-2 grid h-11 w-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span
        className={cx(
          "grid h-[22px] w-[22px] place-items-center rounded-full border-[1.5px] transition-colors duration-150",
          checked ? "border-accent bg-accent text-white dark:text-[#06201c]" : tone === "danger" ? "border-danger" : "border-line-strong hover:border-accent",
        )}
      >
        {checked && <Check size={14} strokeWidth={3} />}
      </span>
    </button>
  );
});

/** Pill used for filters, habits and parsed quick-capture tokens. */
export function Chip({
  children,
  selected,
  onClick,
  onRemove,
  icon,
  tone = "neutral",
  className,
  removeLabel = "הסרה",
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  icon?: ReactNode;
  tone?: "neutral" | "accent" | "warn";
  className?: string;
  removeLabel?: string;
}) {
  const cls = cx(
    "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-footnote font-medium transition-colors",
    selected ? "border-accent bg-accent text-white dark:text-[#06201c]" : tone === "accent" ? "border-transparent bg-accent-soft text-accent-ink" : tone === "warn" ? "border-transparent bg-warn-soft text-warn" : "border-line bg-surface text-ink hover:border-line-strong",
    className,
  );
  const inner = (
    <>
      {icon}
      <span className="tnum">{children}</span>
    </>
  );
  return (
    <span className={cls}>
      {onClick ? (
        <button type="button" onClick={onClick} aria-pressed={selected} className="inline-flex items-center gap-1.5">
          {inner}
        </button>
      ) : (
        inner
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={removeLabel} className="-me-1.5 grid h-7 w-7 place-items-center rounded-full opacity-60 hover:opacity-100">
          ×
        </button>
      )}
    </span>
  );
}

/** Small dot for priority (only "high" is shown — colour is a signal, not decoration). */
export function PriorityDot({ high, label = "עדיפות גבוהה" }: { high: boolean; label?: string }) {
  if (!high) return null;
  return <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-warn" role="img" aria-label={label} />;
}
