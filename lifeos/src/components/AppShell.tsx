"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Sun, CalendarDays, Target, ListChecks, Repeat, UtensilsCrossed, TrendingUp, Settings as Cog, Plus, Sparkles, MoreHorizontal, X, HardDrive, Cloud } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { cx, ConfirmHost } from "./ui";
import { TaskEditorHost } from "./TaskEditor";
import { RescheduleHost } from "./TaskRow";
import { ReminderEngine } from "./ReminderEngine";

export const NAV = [
  { href: "/", label: "היום שלי", icon: Sun },
  { href: "/calendar", label: "לוח שנה", icon: CalendarDays },
  { href: "/goals", label: "המטרות שלי", icon: Target },
  { href: "/tasks", label: "משימות", icon: ListChecks },
  { href: "/habits", label: "הרגלים", icon: Repeat },
  { href: "/meals", label: "אוכל וקניות", icon: UtensilsCrossed },
  { href: "/progress", label: "התקדמות", icon: TrendingUp },
  { href: "/settings", label: "הגדרות", icon: Cog },
];
const MOBILE_MAIN = ["/", "/calendar", "/tasks", "/goals"];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={cx(
            "animate-in pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-lg",
            t.kind === "error" ? "bg-rose-600 text-white" : "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900",
          )}
        >
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              className="font-semibold underline-offset-2 hover:underline"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button aria-label="סגירה" onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/";
  const mode = useStore((s) => s.mode);
  const saving = useStore((s) => s.saving);
  const openEditor = useUI((s) => s.openEditor);
  const moreOpen = useUI((s) => s.moreOpen);
  const setMoreOpen = useUI((s) => s.setMoreOpen);
  if (path.startsWith("/login")) return <>{children}</>;

  return (
    <div className="min-h-dvh lg:flex">
      {/* desktop sidebar (right side in RTL) */}
      <aside className="surface sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e lg:flex">
        <div className="px-5 pb-4 pt-6">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Life<span className="text-accent-600">OS</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="ניווט ראשי">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(path, href) ? "page" : undefined}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors",
                isActive(path, href) ? "bg-accent-50 font-semibold text-accent-800 dark:bg-accent-800/25 dark:text-accent-100" : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/5",
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
          <Link
            href="/assistant"
            aria-current={isActive(path, "/assistant") ? "page" : undefined}
            className={cx(
              "mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors",
              isActive(path, "/assistant") ? "bg-accent-50 font-semibold text-accent-800 dark:bg-accent-800/25" : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/5",
            )}
          >
            <Sparkles size={18} />
            עוזר תכנון
          </Link>
        </nav>
        <div className="space-y-3 p-4">
          <button onClick={() => openEditor()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 py-2.5 text-sm font-medium text-white hover:bg-accent-700">
            <Plus size={16} /> משימה חדשה
          </button>
          <ModeBadge mode={mode} saving={saving} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* mobile header */}
        <header className="surface sticky top-0 z-30 flex items-center justify-between border-b px-4 py-2.5 lg:hidden">
          <Link href="/" className="text-lg font-bold">
            Life<span className="text-accent-600">OS</span>
          </Link>
          <div className="flex items-center gap-1">
            {saving > 0 && <span className="text-xs text-stone-400">שומר…</span>}
            <Link href="/assistant" className="rounded-xl p-2 text-stone-600 hover:bg-stone-100 dark:text-stone-300" aria-label="עוזר תכנון">
              <Sparkles size={20} />
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-5 sm:px-6 lg:pb-12 lg:pt-8">{children}</main>
      </div>

      {/* mobile quick add */}
      <button
        onClick={() => openEditor()}
        aria-label="הוספת משימה"
        className="fixed bottom-20 start-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent-600 text-white shadow-lg shadow-accent-600/30 active:scale-95 lg:hidden"
      >
        <Plus size={26} />
      </button>

      {/* mobile bottom nav */}
      <nav className="surface pb-safe fixed inset-x-0 bottom-0 z-40 border-t lg:hidden" aria-label="ניווט ראשי">
        <div className="grid grid-cols-5">
          {NAV.filter((n) => MOBILE_MAIN.includes(n.href)).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(path, href) ? "page" : undefined}
              className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px]", isActive(path, href) ? "font-semibold text-accent-700 dark:text-accent-200" : "text-stone-500")}
            >
              <Icon size={22} />
              {label}
            </Link>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className={cx(
              "flex flex-col items-center gap-0.5 py-2 text-[11px]",
              NAV.some((n) => !MOBILE_MAIN.includes(n.href) && isActive(path, n.href)) ? "font-semibold text-accent-700" : "text-stone-500",
            )}
            aria-haspopup="dialog"
          >
            <MoreHorizontal size={22} />
            עוד
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="עוד">
          <div className="absolute inset-0 bg-stone-900/40" onClick={() => setMoreOpen(false)} />
          <div className="surface animate-sheet pb-safe absolute inset-x-0 bottom-0 rounded-t-3xl border-t p-4">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300" />
            <div className="grid grid-cols-3 gap-2">
              {[...NAV.filter((n) => !MOBILE_MAIN.includes(n.href)), { href: "/assistant", label: "עוזר תכנון", icon: Sparkles }].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={cx("flex flex-col items-center gap-1.5 rounded-2xl p-3 text-sm", isActive(path, href) ? "bg-accent-50 text-accent-800" : "bg-stone-50 dark:bg-white/5")}
                >
                  <Icon size={22} />
                  {label}
                </Link>
              ))}
            </div>
            <div className="mt-3">
              <ModeBadge mode={mode} saving={saving} />
            </div>
          </div>
        </div>
      )}

      <Toasts />
      <TaskEditorHost />
      <RescheduleHost />
      <ConfirmHost />
      <ReminderEngine />
    </div>
  );
}

function ModeBadge({ mode, saving }: { mode: string | null; saving: number }) {
  return (
    <Link href="/settings#data" className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs text-stone-500 hover:bg-stone-100 dark:hover:bg-white/5">
      {mode === "supabase" ? <Cloud size={14} /> : <HardDrive size={14} />}
      {mode === "supabase" ? "מסונכרן לענן" : "מצב מקומי — שמור בדפדפן זה"}
      {saving > 0 && <span className="ms-auto">שומר…</span>}
    </Link>
  );
}
