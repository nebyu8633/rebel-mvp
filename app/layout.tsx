import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Restaurant Purchasing Intelligence | לא לנחש. לראות את המספרים.",
  description:
    "העלה לפחות 5 חשבוניות ספקים וגלה איפה קיימים פערי מחיר ופוטנציאל לחיסכון ברכש המסעדה שלך.",
};

export const viewport: Viewport = {
  themeColor: "#0b0a08",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="font-heebo bg-ink text-cream antialiased">
        {children}
      </body>
    </html>
  );
}
