import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { MobileNav, Sidebar } from "@/components/dashboard/DashboardNav";
import { SetupNotice } from "@/components/ui/SetupNotice";
import { getCurrentUser, isAnonymous } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/config/env";

/**
 * Dashboard shell.
 *
 * Guards again here even though proxy.ts already redirects: a layout is the
 * last place a request passes through before a page reads data, and relying
 * on a single check outside the component tree is how a new route ends up
 * unprotected.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Checked before touching auth: without a project there is no session to
  // read, and the redirect below would send the user to a login page that
  // cannot work either.
  if (!isSupabaseConfigured()) {
    // The notice is the only heading on this screen, so it carries the h1 and
    // the page keeps a valid document outline.
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <SetupNotice headingLevel="h1" />
      </main>
    );
  }

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
