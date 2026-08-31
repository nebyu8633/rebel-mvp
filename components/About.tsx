"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } },
};

export default function About() {
  return (
    <section id="discover" className="relative bg-cream py-28 text-ink md:py-36">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <motion.p
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="mx-auto max-w-3xl text-center text-2xl font-medium leading-relaxed text-ink/80 md:text-3xl"
        >
          רוב המסעדות בודקות את החשבוניות שלהן כדי לדעת כמה שילמו. אנחנו רוצים לעזור להן להבין מה
          המספרים האלה באמת אומרים.
        </motion.p>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            href="/upload"
            className="rounded-full bg-ink px-7 py-3.5 text-base font-semibold text-cream transition-transform hover:scale-[1.03]"
          >
            בדיקת הרכש שלי
          </Link>
          <a
            href="#how-it-works"
            className="rounded-full border border-ink/25 px-7 py-3.5 text-base font-medium text-ink/80 transition-colors hover:border-ink hover:bg-ink/5"
          >
            איך זה עובד
          </a>
        </motion.div>

        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-24 h-px w-full max-w-4xl origin-center bg-ink/15"
        />

        <div className="mt-16 grid grid-cols-1 gap-10 md:grid-cols-[200px_1fr] md:gap-16">
          <motion.span
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-sm font-medium tracking-[0.2em] text-ink/40"
          >
            רכש / חכם
          </motion.span>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-xl leading-relaxed text-ink/75 md:text-[1.6rem] md:leading-[1.55]"
          >
            החשבוניות כבר קיימות. הנתונים כבר נמצאים שם. הבעיה היא שלרוב אין זמן להפוך אותם לתמונה
            ברורה של מחירי הרכש.
            <br className="hidden md:block" />
            <span className="text-ink">
              {" "}
              Restaurant Purchasing Intelligence הופכת את החשבוניות לנתוני רכש שאפשר להבין, להשוות
              ולפעול לפיהם.
            </span>
          </motion.p>
        </div>
      </div>
    </section>
  );
}
