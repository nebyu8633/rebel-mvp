import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-cream/10 bg-ink py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 text-center md:flex-row md:justify-between md:px-10 md:text-right">
        <span className="text-sm font-semibold text-cream/70">
          רכש<span className="text-gold">.</span>אינטליגנציה
        </span>
        <p className="max-w-md text-xs leading-relaxed text-cream/35">
          כל הנתונים המוצגים באתר זה לצורכי הדגמה בלבד, אלא אם צוין אחרת. פוטנציאל לחיסכון מוצג
          בהתאם לנתונים הזמינים בלבד ואינו מהווה הבטחה לחיסכון בפועל.
        </p>
        <Link href="/upload" className="text-sm text-cream/60 transition-colors hover:text-gold">
          בדיקת החיסכון שלי
        </Link>
      </div>
    </footer>
  );
}
