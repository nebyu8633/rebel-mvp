"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getDictionary } from "@/lib/i18n";
import type { BusinessRow } from "@/types/database";

const dict = getDictionary();

/**
 * Business settings (spec §43). No billing in V1.
 *
 * Currency and language are fixed to ILS and Hebrew and shown as read-only:
 * offering a choice the product does not yet honour would be a lie in the UI.
 */
export function SettingsForm({
  business,
  email,
}: {
  business: BusinessRow;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(business.name);
  const [ownerName, setOwnerName] = useState(business.owner_name);
  const [country, setCountry] = useState(business.country);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    setSaved(false);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const { error: updateError } = await supabase
      .from("businesses")
      .update({ name, owner_name: ownerName, country })
      .eq("id", business.id);

    setIsSaving(false);

    if (updateError !== null) {
      setError(dict.settings.saveFailed);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
      <Field
        id="businessName"
        label={dict.settings.businessName}
        value={name}
        onChange={setName}
        placeholder={dict.auth.businessNamePlaceholder}
      />
      <Field
        id="ownerName"
        label={dict.settings.ownerName}
        value={ownerName}
        onChange={setOwnerName}
      />
      <Field id="email" label={dict.settings.email} value={email} readOnly dir="ltr" />
      <Field
        id="country"
        label={dict.settings.country}
        value={country}
        onChange={setCountry}
        dir="ltr"
      />
      <Field id="currency" label={dict.settings.currency} value="ILS" readOnly dir="ltr" />
      <Field id="language" label={dict.settings.language} value="עברית" readOnly />

      {error !== null && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            dict.common.save
          )}
        </Button>

        {saved && (
          // <output> carries an implicit role="status", so assistive tech
          // announces the confirmation without a redundant role attribute.
          <output className="flex items-center gap-1.5 text-sm text-accent">
            <Check className="size-4" aria-hidden="true" />
            {dict.settings.saved}
          </output>
        )}
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  readOnly = false,
  dir,
}: {
  id: string;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-content">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={onChange !== undefined ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        readOnly={readOnly}
        dir={dir}
        className={`mt-1.5 w-full rounded-lg border border-border px-4 py-2.5 text-start text-sm text-content placeholder:text-content-subtle focus:outline-none ${
          readOnly
            ? "cursor-not-allowed bg-surface-2/40 text-content-muted"
            : "bg-surface focus:border-border-strong"
        }`}
      />
    </div>
  );
}
