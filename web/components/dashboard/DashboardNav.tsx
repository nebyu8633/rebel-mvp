"use client";

import {
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { signOut } from "@/lib/auth/actions";
import { getDictionary } from "@/lib/i18n";

const dict = getDictionary();

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: dict.dashboard.nav.overview,
    icon: <LayoutDashboard className="size-4" aria-hidden="true" />,
  },
  {
    href: "/dashboard/invoices",
    label: dict.dashboard.nav.invoices,
    icon: <FileText className="size-4" aria-hidden="true" />,
  },
  {
    href: "/dashboard/products",
    label: dict.dashboard.nav.products,
    icon: <Package className="size-4" aria-hidden="true" />,
  },
  {
    href: "/dashboard/savings",
    label: dict.dashboard.nav.savings,
    icon: <TrendingDown className="size-4" aria-hidden="true" />,
  },
  {
    href: "/dashboard/settings",
    label: dict.dashboard.nav.settings,
    icon: <Settings className="size-4" aria-hidden="true" />,
  },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

/**
 * Desktop sidebar.
 *
 * `border-s` not `border-r`: in RTL the sidebar sits on the right, and its
 * divider must be on its inner (start) edge. Logical properties get this
 * right in both directions without a second rule.
 */
export function Sidebar() {
  const isActive = useIsActive();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-s border-border bg-surface/50 p-4 lg:flex">
      <Link href="/" className="px-3 py-2 text-sm font-semibold text-content">
        {dict.common.appName}
      </Link>

      <nav className="mt-6 flex-1 space-y-1" aria-label={dict.dashboard.nav.overview}>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive(item.href)
                ? "bg-accent/10 font-medium text-accent"
                : "text-content-muted hover:bg-surface-2 hover:text-content",
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        onClick={handleSignOut}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
      >
        <LogOut className="size-4" aria-hidden="true" />
        {dict.auth.logout}
      </button>
    </aside>
  );
}

/**
 * Mobile bottom navigation.
 *
 * Settings is dropped here to keep the bar to four comfortable touch targets;
 * it stays reachable from the overview screen.
 */
export function MobileNav() {
  const isActive = useIsActive();
  const items = NAV_ITEMS.slice(0, 4);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 backdrop-blur lg:hidden"
      aria-label={dict.dashboard.nav.overview}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
            isActive(item.href) ? "text-accent" : "text-content-muted",
          )}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
