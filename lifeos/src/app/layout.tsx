import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { AppShell } from "@/components/AppShell";

const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo", display: "swap" });

export const metadata: Metadata = {
  title: "LifeOS — ניהול חיים ומטרות",
  description: "מערכת אישית לניהול מטרות, משימות, הרגלים, אוכל והתקדמות.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#111312" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="font-sans text-stone-800 antialiased dark:text-stone-200">
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
