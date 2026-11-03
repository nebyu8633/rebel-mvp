import { FileUp, Upload } from "lucide-react";
import type { Metadata } from "next";

import { InvoiceList } from "@/components/dashboard/InvoiceList";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAllInvoices } from "@/lib/dashboard/queries";
import { getDictionary } from "@/lib/i18n";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const dict = getDictionary();

export const metadata: Metadata = {
  title: `${dict.invoices.title} · ${dict.common.appName}`,
};

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const supabase = await getSupabaseServerClient();
  const invoices = await getAllInvoices(supabase);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{dict.invoices.title}</h1>
        <ButtonLink href="/analyze">
          <Upload className="size-4" aria-hidden="true" />
          {dict.dashboard.uploadCta}
        </ButtonLink>
      </header>

      <div className="mt-8">
        {invoices.length === 0 ? (
          <EmptyState
            icon={<FileUp className="size-8" aria-hidden="true" />}
            title={dict.invoices.emptyTitle}
            body={dict.invoices.emptyBody}
            action={<ButtonLink href="/analyze">{dict.dashboard.emptyCta}</ButtonLink>}
          />
        ) : (
          <InvoiceList invoices={invoices} />
        )}
      </div>
    </main>
  );
}
