import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "כניסה | Restaurant Purchasing Intelligence",
};

export default function LoginPage() {
  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-ink px-6 text-cream">
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="text-sm text-cream/50 transition-colors hover:text-cream">
          → חזרה לדף הבית
        </Link>
        <h1 className="mt-6 text-2xl font-bold">כניסה למערכת</h1>
        <p className="mt-3 text-sm text-cream/55">
          מסך הכניסה למשתמשים רשומים בפיתוח. בינתיים ניתן להתחיל בדיקה ללא הרשמה.
        </p>
        <Link
          href="/upload"
          className="mt-8 inline-block rounded-full bg-cream px-7 py-3.5 text-base font-semibold text-ink transition-transform hover:scale-[1.03] hover:bg-gold"
        >
          בדיקת החיסכון שלי
        </Link>
      </div>
    </main>
  );
}
