"use client";
import { forwardRef, useEffect, useId, useRef, type ReactNode } from "react";
import { create } from "zustand";
import { X } from "lucide-react";
import { twMerge } from "tailwind-merge";

/** Join class names; later Tailwind classes override conflicting earlier ones (e.g. w-20 beats w-full). */
export function cx(...c: Array<string | false | null | undefined>) {
  return twMerge(c.filter(Boolean).join(" "));
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:opacity-50 disabled:pointer-events-none select-none";
const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-800",
  secondary: "surface border text-stone-800 hover:bg-stone-50 dark:text-stone-100 dark:hover:bg-white/5",
  ghost: "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/5",
  subtle: "bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-white/5 dark:text-stone-200 dark:hover:bg-white/10",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
};
const btnSizes = { sm: "h-8 px-2.5 text-sm", md: "h-10 px-4 text-sm", lg: "h-12 px-5 text-base", icon: "h-9 w-9" };

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: keyof typeof btnSizes }
>(function Button({ variant = "secondary", size = "md", className, type = "button", ...p }, ref) {
  return <button ref={ref} type={type} className={cx(btnBase, btnVariants[variant], btnSizes[size], className)} {...p} />;
});

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("surface rounded-2xl border p-4 sm:p-5", className)} {...p}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action, hint }: { children: ReactNode; action?: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2">
      <div>
        <h2 className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">{children}</h2>
        {hint && <p className="text-xs text-stone-500 dark:text-stone-400">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

const inputCls =
  "w-full rounded-xl border hairline bg-white px-3 py-2 text-[15px] text-stone-900 placeholder:text-stone-400 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:bg-stone-900 dark:text-stone-100 disabled:opacity-60";

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
      <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-xs text-rose-600">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-stone-500">{hint}</span>
      ) : null}
    </label>
  );
}

export function Badge({ children, tone = "stone", className }: { children: ReactNode; tone?: "stone" | "accent" | "amber" | "rose" | "indigo" | "sky"; className?: string }) {
  const tones = {
    stone: "bg-stone-100 text-stone-600 dark:bg-white/5 dark:text-stone-300",
    accent: "bg-accent-50 text-accent-700 dark:bg-accent-800/30 dark:text-accent-200",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", tones[tone], className)}>{children}</span>;
}

export function ProgressBar({ value, className, barClass = "bg-accent-600", label }: { value: number | null; className?: string; barClass?: string; label?: string }) {
  const pct = value == null ? 0 : Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={value == null ? undefined : pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cx("h-2 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-white/10", className)}
    >
      {value != null && <div className={cx("h-full rounded-full transition-[width] duration-500", barClass)} style={{ width: `${pct}%` }} />}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed hairline px-4 py-8 text-center">
      {icon && <div className="text-stone-400">{icon}</div>}
      <p className="font-medium text-stone-700 dark:text-stone-200">{title}</p>
      {children && <div className="max-w-sm text-sm text-stone-500">{children}</div>}
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
    <div role="radiogroup" className={cx("inline-flex rounded-xl bg-stone-100 p-1 dark:bg-white/5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-lg font-medium transition-colors",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            value === o.value ? "surface text-stone-900 shadow-sm dark:text-stone-50" : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-200",
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
      <span className="text-sm text-stone-700 dark:text-stone-300">{label}</span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-accent-600" : "bg-stone-300 dark:bg-stone-600")}
      >
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "start-[22px]" : "start-0.5")} />
      </button>
    </label>
  );
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
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        className={cx(
          "surface animate-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border shadow-xl sm:rounded-3xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b hairline px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button data-close variant="ghost" size="icon" onClick={onClose} aria-label="סגירה">
            <X size={18} />
          </Button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t hairline px-5 py-3 pb-safe">{footer}</div>}
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
      <div className="text-sm text-stone-600 dark:text-stone-300">{req?.message}</div>
    </Modal>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)} aria-hidden />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-xl bg-stone-200/70 dark:bg-white/5", className)} />;
}
