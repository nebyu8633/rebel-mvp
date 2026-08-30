import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { ensureBusiness, getCurrentUser } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const dict = getDictionary();

export const metadata: Metadata = {
  title: `${dict.settings.title} · ${dict.common.appName}`,
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await getSupabaseServerClient();
  const user = await getCurrentUser();
  if (user === null) redirect("/login?redirect=/dashboard/settings");

  const business = await ensureBusiness(supabase);
  if (business === null) redirect("/login");

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight">{dict.settings.title}</h1>

      <section className="mt-8">
        <h2 className="mb-5 text-base font-semibold">{dict.settings.business}</h2>
        <SettingsForm business={business} email={user.email ?? ""} />
      </section>
    </main>
  );
}
