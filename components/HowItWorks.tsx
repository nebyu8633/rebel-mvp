"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import InvoiceToDataVisual from "./visuals/InvoiceToDataVisual";
import NormalizeVisual from "./visuals/NormalizeVisual";
import SavingsVisual from "./visuals/SavingsVisual";

const STEPS = [
  { key: "invoices", label: "חשבוניות" },
  { key: "normalize", label: "נרמול מחירים" },
  { key: "savings", label: "פוטנציאל לחיסכון" },
] as const;

const CARDS = [
  {
    title: "החשבוניות שכבר יש לך הופכות לנתונים",
    description:
      "העלה לפחות 5 חשבוניות ספקים. המערכת מנתחת את המידע שמופיע בהן ומתחילה לבנות תמונה של הרכש שלך.",
    Visual: InvoiceToDataVisual,
  },
  {
    title: "משווים מחירים בצורה שאפשר להבין",
    description:
      'מחירים של מוצרים יכולים להופיע באריזות וביחידות שונות. המערכת מנרמלת את הנתונים כדי לאפשר השוואה עקבית כאשר הנתונים מאפשרים זאת.',
    Visual: NormalizeVisual,
  },
  {
    title: "אתה רואה איפה עשוי להיות כסף על השולחן",
    description:
      "כאשר קיימים מספיק נתונים להשוואה, המערכת מציגה פערי מחיר ופוטנציאל לחיסכון — יחד עם הדרך שבה המספר חושב.",
    Visual: SavingsVisual,
  },
];

export default function HowItWorks() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.idx);
            setActive(idx);
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="how-it-works" className="relative bg-ink py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[380px_1fr] md:gap-20">
          {/* sticky left */}
          <div className="md:sticky md:top-28 md:h-fit">
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-3xl font-bold leading-tight text-cream md:text-[2.6rem] md:leading-[1.15]"
            >
              פחות ניחושים.
              <br />
              יותר שליטה ברכש.
            </motion.h2>

            <div className="mt-10 space-y-1">
              {STEPS.map((s, i) => (
                <div
                  key={s.key}
                  className={`flex items-center gap-3 border-r-2 py-2.5 pr-4 transition-colors duration-300 ${
                    active === i ? "border-gold text-cream" : "border-cream/10 text-cream/35"
                  }`}
                >
                  <span className="numeral text-xs">0{i + 1}</span>
                  <span className="text-sm font-medium">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* scrolling right */}
          <div className="space-y-24 md:space-y-40">
            {CARDS.map((card, i) => (
              <div
                key={card.title}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                data-idx={i}
                className="min-h-[420px]"
              >
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-2xl border border-cream/10 bg-charcoal/50 p-6 md:p-10"
                >
                  <span className="numeral text-xs tracking-widest text-gold/70">
                    0{i + 1} · {STEPS[i].label}
                  </span>
                  <h3 className="mt-3 text-2xl font-bold text-cream md:text-3xl">{card.title}</h3>
                  <p className="mt-4 max-w-xl leading-relaxed text-cream/60">{card.description}</p>

                  <div className="mt-8">
                    <card.Visual />
                  </div>
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
