import { ArrowLeft, FileText, LineChart, ScanLine, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { ThreeDCardDemo } from "@/components/3d-card-demo";
import { SceneStage } from "@/components/3d/SceneStage";
import { Reveal, RevealItem } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { getDictionary } from "@/lib/i18n";

/**
 * The home screen: an entry point into the product, not a marketing page.
 *
 * A Server Component. Only the pieces that actually move — the 3D scene, the
 * reveal wrappers, the card — are client islands, so the copy itself is in the
 * initial HTML and readable before any JavaScript arrives.
 */
export default function HomePage() {
  const dict = getDictionary();

  return (
    <main>
      <section className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-20">
        <SceneStage />

        <Reveal className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
          <RevealItem>
            <h1 className="text-balance text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl md:text-6xl">
              {dict.home.title}
            </h1>
          </RevealItem>

          <RevealItem>
            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-content-muted sm:text-lg">
              {dict.home.subtitle}
            </p>
          </RevealItem>

          <RevealItem className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
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
          </RevealItem>
        </Reveal>
      </section>

      {/*
       * The signature element. It sits on its own band between the hero and
       * the explanation: the hero states the claim, this shows the shape of
       * the finding, and the steps below say how it is reached.
       */}
      <section className="relative border-t border-border px-6 py-20 sm:py-24">
        <div className="mx-auto flex max-w-5xl justify-center">
          <ThreeDCardDemo />
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

          <Reveal className="mt-12">
            <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {dict.home.steps.map((step, index) => (
                <RevealItem as="li" key={step.title}>
                  <Step
                    index={index + 1}
                    icon={STEP_ICONS[index]}
                    title={step.title}
                    body={step.body}
                  />
                </RevealItem>
              ))}
            </ol>
          </Reveal>
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
    <div className="h-full rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
          {icon}
        </span>
        {/*
         * The steps are a genuine sequence — you cannot compare prices before
         * the invoices are read — so the number carries information rather
         * than decorating the card.
         */}
        <span className="text-xs font-medium text-content-subtle">{index}</span>
      </div>
      <h3 className="mt-4 font-semibold text-content">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-content-muted">{body}</p>
    </div>
  );
}
