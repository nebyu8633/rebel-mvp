import { ArrowLeft, FileText, LineChart, ScanLine, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { SceneStage } from "@/components/3d/SceneStage";
import { ButtonLink } from "@/components/ui/Button";
import { getDictionary } from "@/lib/i18n";

/**
 * The home screen: an entry point into the product, not a marketing page.
 *
 * The 3D scene sits behind the content and is decorative — the headline, the
 * subtitle and the primary action are plain DOM, so the page works identically
 * with WebGL unavailable or reduced motion on.
 */
export default function HomePage() {
  const dict = getDictionary();

  return (
    <main>
      <section className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-20">
        <SceneStage />

        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
          <h1 className="text-balance text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl md:text-6xl">
            {dict.home.title}
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-content-muted sm:text-lg">
            {dict.home.subtitle}
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <ButtonLink href="/analyze" size="lg" className="w-full sm:w-auto">
              {dict.home.primaryCta}
              {/* The page is RTL, so "forward" points left. */}
              <ArrowLeft className="size-4" aria-hidden="true" />
            </ButtonLink>

            <ButtonLink
              href="#how-it-works"
              variant="ghost"
              size="lg"
              className="w-full sm:w-auto"
            >
              {dict.home.secondaryCta}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="relative border-t border-border bg-surface/30 px-6 py-20 sm:py-24"
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            {dict.home.howItWorksTitle}
          </h2>

          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {dict.home.steps.map((step, index) => (
              <Step
                key={step.title}
                index={index + 1}
                icon={STEP_ICONS[index]}
                title={step.title}
                body={step.body}
              />
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}

const STEP_ICONS: readonly ReactNode[] = [
  <FileText key="upload" className="size-5" aria-hidden="true" />,
  <ScanLine key="read" className="size-5" aria-hidden="true" />,
  <LineChart key="compare" className="size-5" aria-hidden="true" />,
  <Sparkles key="savings" className="size-5" aria-hidden="true" />,
];

function Step({
  index,
  icon,
  title,
  body,
}: {
  index: number;
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
          {icon}
        </span>
        <span className="text-xs font-medium text-content-subtle">{index}</span>
      </div>
      <h3 className="mt-4 font-semibold text-content">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-content-muted">{body}</p>
    </li>
  );
}
