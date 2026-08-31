"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import HeroVisual from "./HeroVisual";

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.3 },
  },
};

const item = {
  hidden: { y: 28, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function Hero() {
  return (
    <section id="top" className="relative h-screen min-h-[720px] w-full overflow-hidden bg-ink">
      <HeroVisual />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/10" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/70 via-transparent to-transparent" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-6 pb-16 md:px-10 md:pb-24"
      >
        <motion.p
          variants={item}
          className="mb-5 text-sm font-medium tracking-[0.25em] text-gold"
        >
          RESTAURANT PURCHASING INTELLIGENCE
        </motion.p>

        <motion.h1
          variants={item}
          className="max-w-4xl text-[2.4rem] font-bold leading-[1.15] text-cream md:text-6xl md:leading-[1.1]"
        >
          אתה יודע כמה אתה באמת משלם על הרכש שלך?
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-6 max-w-xl text-lg leading-relaxed text-cream/70 md:text-xl"
        >
          העלה לפחות 5 חשבוניות ספקים וגלה איפה קיימים פערי מחיר ופוטנציאל לחיסכון.
        </motion.p>

        <motion.div variants={item} className="mt-9 flex flex-wrap items-center gap-4">
          <Link
            href="/upload"
            className="rounded-full bg-cream px-7 py-3.5 text-base font-semibold text-ink transition-transform hover:scale-[1.03] hover:bg-gold"
          >
            בדיקת החיסכון שלי
          </Link>
          <a
            href="#how-it-works"
            className="rounded-full border border-cream/30 px-7 py-3.5 text-base font-medium text-cream/90 transition-colors hover:border-cream hover:bg-cream/5"
          >
            איך זה עובד?
          </a>
        </motion.div>

        <motion.p
          variants={item}
          className="mt-8 hidden max-w-md text-sm leading-relaxed text-cream/50 md:block"
        >
          לא צריך להחליף מערכת. לא צריך להזין נתונים ידנית. מעלים את החשבוניות שכבר יש לך.
        </motion.p>
        <motion.p
          variants={item}
          className="mt-6 max-w-md text-sm leading-relaxed text-cream/50 md:hidden"
        >
          העלה את החשבוניות שכבר יש לך.
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 1 }}
        className="pointer-events-none absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex"
      >
        <span className="text-[11px] tracking-[0.2em] text-cream/40">גלול למטה</span>
        <span className="h-9 w-px animate-pulse bg-cream/30" />
      </motion.div>
    </section>
  );
}
