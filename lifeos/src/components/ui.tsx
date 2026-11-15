"use client";
import { forwardRef, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { create } from "zustand";
import { X, ChevronDown, Info } from "lucide-react";
import { twMerge } from "tailwind-merge";

/** Join class names; later Tailwind classes override conflicting earlier ones (e.g. w-20 beats w-full). */
export function cx(...c: Array<string | false | null | undefined>) {
  return twMerge(c.filter(Boolean).join(" "));
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-field font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:pointer-events-none select-none";
const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-accent text-white hover:brightness-[1.05] dark:text-[#06201c]",
  secondary: "bg-surface border border-line text-ink hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  subtle: "bg-surface-2 text-ink hover:bg-line",
  danger: "bg-danger text-white hover:brightness-[1.05]",
};
// touch-first: md/icon reach 44px on phones, a little denser with a pointer (sm+)
const btnSizes = { sm: "h-9 px-3 text-footnote sm:h-8", md: "h-11 px-4 text-body sm:h-10 sm:text-sm", lg: "h-12 px-5 text-base", icon: "h-11 w-11 sm:h-9 sm:w-9" };

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: keyof typeof btnSizes }
>(function Button({ variant = "secondary", size = "md", className, type = "button", ...p }, ref) {
  return <button ref={ref} type={type} className={cx(btnBase, btnVariants[variant], btnSizes[size], className)} {...p} />;
});

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-panel border border-line bg-surface p-4 sm:p-5", className)} {...p}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action, hint }: { children: ReactNode; action?: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2">
      <div>
        <h2 className="text-body font-semibold text-ink">{children}</h2>
        {hint && <p className="text-footnote text-ink-3">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-display text-ink">{title}</h1>
        {subtitle && <div className="mt-0.5 text-footnote text-ink-2">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

// 16px on phones: iOS Safari zooms into any focused field smaller than that
const inputCls =
  "w-full rounded-field border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60 sm:py-2 sm:text-[15px]";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...p },
  ref,
) {
  return <input ref={ref} className={cx(inputCls, className)} {...p} />;
});

export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputCls, "min-h-20", className)} {...p} />;
}

export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputCls, "appearance-auto pe-2", className)} {...p}>
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-footnote font-medium text-ink-2">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-footnote text-danger">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-footnote text-ink-3">{hint}</span>
      ) : null}
    </label>
  );
}

export function Badge({ children, tone = "stone", className }: { children: ReactNode; tone?: "stone" | "accent" | "amber" | "rose" | "indigo" | "sky"; className?: string }) {
  const tones = {
    stone: "bg-surface-2 text-ink-2",
    accent: "bg-accent-soft text-accent-ink",
    amber: "bg-warn-soft text-warn",
    rose: "bg-danger-soft text-danger",
    indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", tones[tone], className)}>{children}</span>;
}

export function ProgressBar({ value, className, barClass = "bg-accent", label }: { value: number | null; className?: string; barClass?: string; label?: string }) {
  const pct = value == null ? 0 : Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={value == null ? undefined : pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cx("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}
    >
      {value != null && <div className={cx("h-full rounded-full transition-[width] duration-500", barClass)} style={{ width: `${pct}%` }} />}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      {icon && <div className="text-ink-3">{icon}</div>}
      <p className="text-headline text-ink">{title}</p>
      {children && <div className="max-w-sm text-body text-ink-2">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" className={cx("inline-flex rounded-field bg-surface-2 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-[8px] font-medium transition-colors",
            size === "sm" ? "px-2.5 py-1 text-footnote" : "min-h-9 px-3 py-1.5 text-footnote sm:text-sm",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx("flex cursor-pointer items-center justify-between gap-3 py-1.5", disabled && "opacity-50")}>
      <span className="text-body text-ink">{label}</span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx("relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-line-strong")}
      >
        <span className={cx("absolute top-[3px] h-6 w-6 rounded-full bg-white shadow transition-all", checked ? "start-[23px]" : "start-[3px]")} />
      </button>
    </label>
  );
}

/**
 * Height of the on-screen keyboard (iOS Safari doesn't shrink the layout viewport for it), so
 * bottom sheets can sit above it instead of hiding the focused field and the save button.
 */
export function useKeyboardInset(active = true) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setInset(0);
    };
  }, [active]);
  return inset > 80 ? inset : 0; // ignore toolbar wobble
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const kb = useKeyboardInset(open);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      // don't steal focus if the user (or an autoFocus field) is already inside the dialog
      if (panel.current?.contains(document.activeElement)) return;
      const first = panel.current?.querySelector<HTMLElement>("input,textarea,select,button:not([data-close])");
      first?.focus();
    }, 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/35" onClick={onClose} />
      <div
        ref={panel}
        style={{ marginBottom: kb, maxHeight: kb ? `calc(100dvh - ${kb}px - 12px)` : undefined }}
        className={cx(
          "animate-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-sheet border border-line bg-surface shadow-float sm:rounded-sheet",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line-strong sm:hidden" aria-hidden />
        <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-2 sm:pt-4">
          <h2 className="text-headline text-ink">{title}</h2>
          <Button data-close variant="ghost" size="icon" onClick={onClose} aria-label="סגירה">
            <X size={18} />
          </Button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-4 pt-1">{children}</div>
        {footer && <div className={cx("flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3", !kb && "pb-[max(0.75rem,env(safe-area-inset-bottom))]")}>{footer}</div>}
      </div>
    </div>
  );
}

// ───────── confirm() ─────────
interface ConfirmReq {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (v: boolean) => void;
}
const useConfirmStore = create<{ req: ConfirmReq | null; set: (r: ConfirmReq | null) => void }>((set) => ({ req: null, set: (req) => set({ req }) }));

export function confirmDialog(opts: Omit<ConfirmReq, "resolve">): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.getState().set({ ...opts, resolve }));
}

export function ConfirmHost() {
  const { req, set } = useConfirmStore();
  const close = (v: boolean) => {
    req?.resolve(v);
    set(null);
  };
  return (
    <Modal
      open={!!req}
      onClose={() => close(false)}
      title={req?.title}
      footer={
        <>
          <Button onClick={() => close(false)}>{req?.cancelLabel ?? "ביטול"}</Button>
          <Button variant={req?.danger ? "danger" : "primary"} onClick={() => close(true)}>
            {req?.confirmLabel ?? "אישור"}
          </Button>
        </>
      }
    >
      <div className="text-body text-ink-2">{req?.message}</div>
    </Modal>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)} aria-hidden />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-field bg-surface-2", className)} />;
}

// ───────── Progressive disclosure ─────────

/**
 * Expandable card section: a one-line header (icon, title, short summary) that opens to the full
 * content. Closed by default so screens show essentials first. Open state is remembered per id.
 */
export function Disclosure({
  id,
  title,
  icon,
  summary,
  defaultOpen = false,
  forceOpen = false,
  action,
  children,
  className,
}: {
  id?: string;
  title: ReactNode;
  icon?: ReactNode;
  summary?: ReactNode;
  defaultOpen?: boolean;
  /** Keep open while true (e.g. in edit mode). */
  forceOpen?: boolean;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const key = id ? `lifeos:open:${id}` : null;
  const [openState, setOpen] = useState(defaultOpen);
  const open = openState || forceOpen;
  useEffect(() => {
    if (!key) return;
    try {
      const v = localStorage.getItem(key);
      if (v != null) setOpen(v === "1");
    } catch {
      /* ignore */
    }
  }, [key]);
  const toggle = () => {
    setOpen((o) => {
      try {
        if (key) localStorage.setItem(key, o ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !o;
    });
  };
  const contentId = useId();
  return (
    <section className={cx("surface overflow-hidden rounded-2xl border", className)}>
      <div className="flex items-center gap-2 pe-3">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-start transition-colors hover:bg-surface-2/60"
        >
          {icon && <span className="shrink-0 text-ink-3">{icon}</span>}
          <span className="shrink-0 text-body font-semibold text-ink">{title}</span>
          {summary != null && <span className="min-w-0 flex-1 truncate text-footnote text-ink-2">{summary}</span>}
          <ChevronDown size={18} className={cx("ms-auto shrink-0 text-ink-3 transition-transform duration-200", open && "rotate-180")} aria-hidden />
        </button>
        {action}
      </div>
      {open && (
        <div id={contentId} className="animate-in border-t hairline px-4 pb-4 pt-3">
          {children}
        </div>
      )}
    </section>
  );
}

/** Inline "more" toggle for an optional explanation — hidden until requested. */
export function Details({ label = "פרטים", children, className }: { label?: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cx("text-xs", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink">
        <Info size={13} /> {open ? "הסתרה" : label}
      </button>
      {open && <div className="animate-in mt-1.5 rounded-field bg-surface-2 p-2.5 leading-relaxed text-ink-2">{children}</div>}
    </div>
  );
}

/** Compact number + label tile. */
export function Stat({ label, value, tone, sub }: { label: string; value: ReactNode; tone?: "pos" | "neg" | "warn"; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-field bg-surface-2 px-3 py-2.5">
      <div className="truncate text-caption text-ink-2">{label}</div>
      <div className={cx("ltr-nums truncate text-start text-base font-semibold", tone === "pos" && "text-accent-ink", tone === "neg" && "text-danger", tone === "warn" && "text-warn")}>{value}</div>
      {sub && <div className="truncate text-caption text-ink-3">{sub}</div>}
    </div>
  );
}

/** Small circular progress (for compact cards). value 0..1 or null (no data). */
export function Ring({ value, size = 44, stroke = 5, colorClass = "text-accent", label }: { value: number | null; size?: number; stroke?: number; colorClass?: string; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value == null ? null : Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={pct == null ? `${label}: אין נתונים` : `${label}: ${pct}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-surface-2" />
        {pct != null && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className={cx("transition-[stroke-dashoffset] duration-500", colorClass)} />}
      </svg>
      <span className="ltr-nums absolute inset-0 flex items-center justify-center text-[11px] font-semibold">{pct == null ? "—" : `${pct}%`}</span>
    </div>
  );
}
