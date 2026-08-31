"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-ink py-32 md:py-44">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(185,138,74,0.14), transparent 65%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl px-6 text-center md:px-10">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="text-4xl font-bold leading-tight text-cream md:text-6xl"
        >
          רוצה לראות מה קורה ברכש שלך?
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="mx-auto mt-6 max-w-lg text-lg text-cream/60"
        >
          העלה לפחות 5 חשבוניות ספקים וגלה מה הנתונים שלך יכולים לספר לך.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            href="/upload"
            className="rounded-full bg-cream px-8 py-4 text-base font-semibold text-ink transition-transform hover:scale-[1.03] hover:bg-gold"
          >
            העלאת חשבוניות
          </Link>
          <a
            href="#how-it-works"
            className="rounded-full border border-cream/30 px-8 py-4 text-base font-medium text-cream/90 transition-colors hover:border-cream hover:bg-cream/5"
          >
            איך זה עובד?
          </a>
        </motion.div>
      </div>
    </section>
  );
}
