import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/AuthForm";
import { getDictionary } from "@/lib/i18n";

const dict = getDictionary();

export const metadata: Metadata = {
  title: `${dict.auth.loginTitle} · ${dict.common.appName}`,
};

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <h1 className="mb-8 text-center text-2xl font-bold">{dict.auth.loginTitle}</h1>
      {/* AuthForm reads search params, which requires a Suspense boundary. */}
      <Suspense fallback={null}>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
}
