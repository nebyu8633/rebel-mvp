"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const QA = [
  {
    q: "אני חייב להעלות בדיוק 5 חשבוניות?",
    a: "זה המינימום. ככל שיש יותר חשבוניות, כך ההשוואה יכולה להיות מדויקת יותר. מתחת ל-5 חשבוניות אין מספיק נתונים כדי להציג פוטנציאל לחיסכון אמין.",
  },
  {
    q: "האם אתם מחליפים את מערכת ה-POS או הספקים שלי?",
    a: "לא. המערכת לא נוגעת בתפעול השוטף שלך. אתה ממשיך לעבוד מול אותם ספקים, באותה מערכת. אנחנו רק עוזרים לך להבין את החשבוניות שכבר יש לך.",
  },
  {
    q: "מאיפה מגיע מחיר ההשוואה?",
    a: "מחיר ההשוואה מבוסס על נתוני רכש דומים שקיימים במאגר, בהתאם למוצר, לתקופה ולהיקף הרכישה. כשאין מספיק נתונים דומים, המערכת לא מציגה השוואה.",
  },
  {
    q: "האם החיסכון מובטח?",
    a: "לא. אנחנו מציגים פוטנציאל לחיסכון בהתאם לנתונים הזמינים — לא הבטחה. ההחלטה אם ואיך לפעול לפי הנתונים נשארת אצלך.",
  },
];

export default function Faq() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-ink py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-6 md:px-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center text-3xl font-bold leading-tight text-cream md:text-4xl"
        >
          שאלות נפוצות
        </motion.h2>

        <div className="mt-12 divide-y divide-cream/10 border-y border-cream/10">
          {QA.map((item, i) => {
            const isOpen = openIdx === i;
            return (
              <div key={item.q}>
                <button
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 py-5 text-right"
                >
                  <span className="text-base font-medium text-cream/90 md:text-lg">{item.q}</span>
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.25 }}
                    className="shrink-0 text-2xl font-light text-cream/40"
                  >
                    +
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-6 leading-relaxed text-cream/55">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
