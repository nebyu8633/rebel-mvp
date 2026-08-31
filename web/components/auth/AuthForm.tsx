"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics/track";
import { signInWithEmail, signUpWithEmail, type AuthResult } from "@/lib/auth/actions";
import { getDictionary } from "@/lib/i18n";

const dict = getDictionary();

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<AuthResult["errorKey"] | null>(null);

  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorKey(null);
    if (isSignup) track("signup_started");

    try {
      const result = isSignup
        ? await signUpWithEmail(email, password, businessName)
        : await signInWithEmail(email, password);

      if (!result.ok) {
        setErrorKey(result.errorKey ?? "generic");
        return;
      }

      if (isSignup) track("signup_completed");

      // `redirect` comes from the guard in proxy.ts. Only same-origin relative
      // paths are honoured — an absolute URL here would be an open redirect.
      const redirect = searchParams.get("redirect");
      const target = redirect !== null && redirect.startsWith("/") && !redirect.startsWith("//")
        ? redirect
        : "/dashboard";

      router.push(target);
      router.refresh();
    } catch {
      setErrorKey("generic");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {isSignup && (
        <Field
          id="businessName"
          label={dict.auth.businessName}
          placeholder={dict.auth.businessNamePlaceholder}
          value={businessName}
          onChange={setBusinessName}
          autoComplete="organization"
        />
      )}

      <Field
        id="email"
        type="email"
        label={dict.auth.email}
        placeholder={dict.auth.emailPlaceholder}
        value={email}
        onChange={setEmail}
        autoComplete="email"
        required
        // Email addresses are Latin and must not reorder inside the RTL form.
        dir="ltr"
      />

      <Field
        id="password"
        type="password"
        label={dict.auth.password}
        value={password}
        onChange={setPassword}
        autoComplete={isSignup ? "new-password" : "current-password"}
        required
        dir="ltr"
        {...(isSignup ? { hint: dict.auth.passwordHint } : {})}
      />

      {errorKey !== null && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {dict.auth.errors[errorKey ?? "generic"]}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : isSignup ? (
          dict.auth.signup
        ) : (
          dict.auth.login
        )}
      </Button>

      <p className="text-center text-sm text-content-muted">
        {isSignup ? dict.auth.hasAccount : dict.auth.noAccount}{" "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-medium text-accent hover:underline"
        >
          {isSignup ? dict.auth.goToLogin : dict.auth.goToSignup}
        </Link>
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  required = false,
  dir,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  dir?: "ltr" | "rtl";
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-content">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        dir={dir}
        // `text-start` keeps the caret and text on the reading edge even when
        // the field itself is forced LTR for an email or password.
        className="mt-1.5 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-start text-sm text-content placeholder:text-content-subtle focus:border-border-strong focus:outline-none"
      />
      {hint !== undefined && (
        <p className="mt-1.5 text-xs text-content-subtle">{hint}</p>
      )}
    </div>
  );
}
