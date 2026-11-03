"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Sun, CalendarDays, Target, ListChecks, Repeat, UtensilsCrossed, TrendingUp, Settings as Cog, Plus, Sparkles, MoreHorizontal, X, HardDrive, Cloud, Globe2, Map as MapIcon, UserRound, Swords, Gift, Landmark } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { cx, ConfirmHost } from "./ui";
import { TaskEditorHost } from "./TaskEditor";
import { RescheduleHost } from "./TaskRow";
import { ReminderEngine, ReminderCards } from "./ReminderEngine";
import { GameSync, CelebrationLayer } from "./game/GameSync";
import { FocusHost } from "./game/FocusMode";
import { EvidenceHost } from "./game/EvidenceModal";
import { GameMasterHost, DailyIntro } from "./game/GameMaster";

/** The game: six persistent screens. */
export const GAME_NAV = [
  { href: "/", label: "העולם שלי", icon: Globe2 },
  { href: "/quests", label: "מפת המסעות", icon: MapIcon },
  { href: "/character", label: "הדמות", icon: UserRound },
  { href: "/challenges", label: "אתגרים", icon: Swords },
  { href: "/rewards", label: "פרסים", icon: Gift },
  { href: "/legacy", label: "מורשת", icon: Landmark },
];
/** Everyday tools (the real plan the game is built on). */
export const NAV = [
  { href: "/today", label: "היום שלי", icon: Sun },
  { href: "/calendar", label: "לוח שנה", icon: CalendarDays },
  { href: "/goals", label: "המטרות שלי", icon: Target },
  { href: "/tasks", label: "משימות", icon: ListChecks },
  { href: "/habits", label: "הרגלים", icon: Repeat },
  { href: "/meals", label: "אוכל וקניות", icon: UtensilsCrossed },
  { href: "/progress", label: "התקדמות", icon: TrendingUp },
  { href: "/settings", label: "הגדרות", icon: Cog },
];
const ALL_NAV = [...GAME_NAV, ...NAV];
const MOBILE_MAIN = ["/", "/today", "/quests", "/challenges"];
const GAME_PATHS = GAME_NAV.map((n) => n.href);

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
          {t.secondary && (
            <button
              className="font-semibold underline-offset-2 opacity-80 hover:underline"
              onClick={() => {
                t.secondary!.run();
                dismiss(t.id);
              }}
            >
              {t.secondary.label}
            </button>
          )}
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

function NavLink({ href, label, icon: Icon, path, dark }: { href: string; label: string; icon: typeof Sun; path: string; dark: boolean }) {
  const on = isActive(path, href);
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={cx(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] transition-colors",
        dark
          ? on
            ? "bg-amber-300/12 font-semibold text-amber-100"
            : "text-slate-300 hover:bg-white/5"
          : on
            ? "bg-accent-50 font-semibold text-accent-800 dark:bg-accent-800/25 dark:text-accent-100"
            : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/5",
      )}
    >
      <Icon size={18} />
      {label}
    </Link>
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
  const isWorld = path === "/";
  const dark = GAME_PATHS.some((h) => isActive(path, h));
  const mobileMain = MOBILE_MAIN.map((h) => ALL_NAV.find((n) => n.href === h)!);

  return (
    <div className={cx("min-h-dvh lg:flex", dark && "game-bg")}>
      {/* desktop sidebar (right side in RTL) */}
      <aside className={cx("sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-e lg:flex", dark ? "border-white/10 bg-[#0a0f1c]" : "surface")}>
        <div className="px-5 pb-3 pt-6">
          <Link href="/" className={cx("text-xl font-bold tracking-tight", dark && "text-white")}>
            Life<span className={dark ? "gold-text" : "text-accent-600"}>OS</span>
          </Link>
        </div>
        <nav className="flex-1 px-3" aria-label="ניווט ראשי">
          <div className={cx("px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider", dark ? "text-amber-200/70" : "text-stone-400")}>המשחק</div>
          <div className="space-y-0.5">
            {GAME_NAV.map((n) => (
              <NavLink key={n.href} {...n} path={path} dark={dark} />
            ))}
          </div>
          <div className={cx("mt-4 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider", dark ? "text-slate-500" : "text-stone-400")}>כלים</div>
          <div className="space-y-0.5">
            {NAV.map((n) => (
              <NavLink key={n.href} {...n} path={path} dark={dark} />
            ))}
            <NavLink href="/assistant" label="עוזר תכנון" icon={Sparkles} path={path} dark={dark} />
          </div>
        </nav>
        <div className="space-y-3 p-4">
          <button onClick={() => openEditor()} className={cx("flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium", dark ? "gold-btn" : "bg-accent-600 text-white hover:bg-accent-700")}>
            <Plus size={16} /> משימה חדשה
          </button>
          <ModeBadge mode={mode} saving={saving} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* mobile header */}
        <header className={cx("sticky top-0 z-30 flex h-[3.4rem] items-center justify-between border-b px-4 lg:hidden", dark ? "border-white/10 bg-[#0a0f1c]/95 text-white backdrop-blur" : "surface")}>
          <Link href="/" className="text-lg font-bold">
            Life<span className={dark ? "gold-text" : "text-accent-600"}>OS</span>
          </Link>
          <div className="flex items-center gap-1">
            {saving > 0 && <span className="text-xs text-stone-400">שומר…</span>}
            <button onClick={() => openEditor()} className={cx("rounded-xl p-2", dark ? "text-slate-300 hover:bg-white/10" : "text-stone-600 hover:bg-stone-100 dark:text-stone-300")} aria-label="משימה חדשה">
              <Plus size={20} />
            </button>
            <Link href="/assistant" className={cx("rounded-xl p-2", dark ? "text-slate-300 hover:bg-white/10" : "text-stone-600 hover:bg-stone-100 dark:text-stone-300")} aria-label="עוזר תכנון">
              <Sparkles size={20} />
            </Link>
          </div>
        </header>
        {isWorld ? <main>{children}</main> : <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-5 sm:px-6 lg:pb-12 lg:pt-8">{children}</main>}
      </div>

      {/* mobile quick add (hidden where a page has its own action bar, and in the game screens) */}
      {!dark && !/^\/goals\/(new|[^/]+\/(plan|chat))/.test(path) && (
        <button
          onClick={() => openEditor()}
          aria-label="הוספת משימה"
          className="fixed bottom-20 start-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent-600 text-white shadow-lg shadow-accent-600/30 active:scale-95 lg:hidden"
        >
          <Plus size={26} />
        </button>
      )}

      {/* mobile bottom nav */}
      <nav className={cx("pb-safe fixed inset-x-0 bottom-0 z-40 border-t lg:hidden", dark ? "border-white/10 bg-[#0a0f1c]/95 backdrop-blur" : "surface")} aria-label="ניווט ראשי">
        <div className="grid h-[4.1rem] grid-cols-5">
          {mobileMain.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(path, href) ? "page" : undefined}
              className={cx(
                "flex flex-col items-center justify-center gap-0.5 text-[11px]",
                isActive(path, href) ? (dark ? "font-semibold text-amber-200" : "font-semibold text-accent-700 dark:text-accent-200") : dark ? "text-slate-400" : "text-stone-500",
              )}
            >
              <Icon size={22} />
              {label === "העולם שלי" ? "עולם" : label === "מפת המסעות" ? "מסעות" : label === "היום שלי" ? "היום" : label}
            </Link>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className={cx(
              "flex flex-col items-center justify-center gap-0.5 text-[11px]",
              ALL_NAV.some((n) => !MOBILE_MAIN.includes(n.href) && isActive(path, n.href)) ? (dark ? "font-semibold text-amber-200" : "font-semibold text-accent-700") : dark ? "text-slate-400" : "text-stone-500",
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
          <div className="surface animate-sheet pb-safe absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t p-4">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300" />
            {[
              { title: "המשחק", items: GAME_NAV.filter((n) => !MOBILE_MAIN.includes(n.href)) },
              { title: "כלים", items: [...NAV.filter((n) => !MOBILE_MAIN.includes(n.href)), { href: "/assistant", label: "עוזר תכנון", icon: Sparkles }] },
            ].map((g) => (
              <div key={g.title} className="mb-3">
                <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{g.title}</div>
                <div className="grid grid-cols-3 gap-2">
                  {g.items.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMoreOpen(false)}
                      className={cx("flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center text-sm", isActive(path, href) ? "bg-accent-50 text-accent-800" : "bg-stone-50 dark:bg-white/5")}
                    >
                      <Icon size={22} />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <ModeBadge mode={mode} saving={saving} />
          </div>
        </div>
      )}

      <Toasts />
      <TaskEditorHost />
      <RescheduleHost />
      <ConfirmHost />
      <ReminderEngine />
      <ReminderCards />
      <GameSync />
      <FocusHost />
      <EvidenceHost />
      <GameMasterHost />
      {isWorld && <DailyIntro />}
      <CelebrationLayer />
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
