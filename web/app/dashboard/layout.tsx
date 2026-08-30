import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { MobileNav, Sidebar } from "@/components/dashboard/DashboardNav";
import { getCurrentUser, isAnonymous } from "@/lib/auth/session";

/**
 * Dashboard shell.
 *
 * Guards again here even though proxy.ts already redirects: a layout is the
 * last place a request passes through before a page reads data, and relying
 * on a single check outside the component tree is how a new route ends up
 * unprotected.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (user === null) redirect("/login?redirect=/dashboard");
  // An anonymous visitor has data but no account yet, so they are sent to sign
  // up rather than to log in.
  if (isAnonymous(user)) redirect("/signup?redirect=/dashboard");

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      {/* Bottom padding clears the mobile nav bar. */}
      <div className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</div>
      <MobileNav />
    </div>
  );
}
