"use client";

import { ArrowLeft, TrendingUp } from "lucide-react";

import { CardBody, CardContainer, CardItem } from "@/components/ui/3d-card";
import { ButtonLink } from "@/components/ui/Button";
import { getDictionary } from "@/lib/i18n";

const dict = getDictionary();
const copy = dict.home.card3d;

/**
 * The home screen's signature element.
 *
 * The illustration is the product's own subject — a supplier invoice with one
 * line picked out — rather than a stock image or a gradient. It carries no
 * prices: a plausible-looking number on a marketing page is a fabricated
 * figure, which is the exact failure this product exists to catch. The shape
 * of the finding is the point, and the shape needs no digits.
 */
export function ThreeDCardDemo() {
  return (
    <CardContainer containerClassName="w-full py-4">
      <CardBody className="group w-full max-w-md rounded-2xl border border-border bg-surface p-6 sm:max-w-lg sm:p-8">
        <CardItem translateZ={40} className="text-xs font-medium text-content-subtle">
          {copy.eyebrow}
        </CardItem>

        <CardItem
          as="h2"
          translateZ={60}
          className="mt-3 text-balance text-2xl font-bold leading-snug tracking-tight text-content sm:text-3xl"
        >
          {copy.title}
        </CardItem>

        <CardItem
          as="p"
          translateZ={45}
          className="mt-4 text-pretty text-sm leading-relaxed text-content-muted"
        >
          {copy.body}
        </CardItem>

        <CardItem translateZ={80} className="mt-6">
          <InvoiceIllustration />
        </CardItem>

        {/*
         * The actions sit outside CardItem's transform on purpose. A control
         * that moves under the pointer is harder to hit, and these are the
         * only two things on the card anyone needs to reach.
         */}
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/analyze" size="lg" className="w-full sm:w-auto">
            {copy.primaryCta}
            {/* The page is RTL, so "forward" points left. */}
            <ArrowLeft className="size-4" aria-hidden="true" />
          </ButtonLink>

          <ButtonLink
            href="/analyze"
            variant="secondary"
            size="lg"
            className="w-full sm:w-auto"
          >
            {copy.secondaryCta}
          </ButtonLink>
        </div>
      </CardBody>
    </CardContainer>
  );
}

/**
 * A supplier invoice reduced to its structure: rows of the same width, and one
 * of them flagged.
 *
 * The bars are hidden from the accessibility tree because they carry no
 * information of their own — everything they illustrate is written in the two
 * visible labels, which a screen reader reads as ordinary text. Describing the
 * bars as well would say the same thing twice.
 */
function InvoiceIllustration() {
  return (
    <div className="rounded-xl border border-border bg-ground/60 p-4">
      <div className="space-y-2.5">
        <PlainRow width="w-4/5" />
        <PlainRow width="w-3/5" />

        <div className="flex items-center gap-2 rounded-lg bg-accent/10 px-2.5 py-2 ring-1 ring-accent/30">
          <TrendingUp className="size-4 shrink-0 text-accent" aria-hidden="true" />
          <span className="h-2 w-2/5 rounded-full bg-accent/70" aria-hidden="true" />
          <span className="ms-auto text-[0.6875rem] font-semibold text-accent">
            {copy.lineFlagged}
          </span>
        </div>

        <PlainRow width="w-2/3" />
        <PlainRow width="w-1/2" />
      </div>

      <p className="mt-3 text-[0.6875rem] text-content-subtle">{copy.lineOther}</p>
    </div>
  );
}

/** An unremarkable invoice line: present, but not what the eye should land on. */
function PlainRow({ width }: { width: string }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-2" aria-hidden="true">
      <span className="size-1.5 shrink-0 rounded-full bg-border-strong" />
      <span className={`h-2 rounded-full bg-border-strong/70 ${width}`} />
    </div>
  );
}
