import { FileQuestion } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";
import { getDictionary } from "@/lib/i18n";

const dict = getDictionary();

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <FileQuestion className="size-10 text-content-subtle" aria-hidden="true" />
      <h1 className="mt-5 text-xl font-semibold">{dict.errors.notFound}</h1>

      <div className="mt-7">
        <ButtonLink href="/">{dict.common.appName}</ButtonLink>
      </div>
    </main>
  );
}
