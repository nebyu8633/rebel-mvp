import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";

import { DEFAULT_LOCALE, LOCALE_DIRECTION, getDictionary } from "@/lib/i18n";

import "./globals.css";

/**
 * Heebo carries both Hebrew and Latin at matching weights, so mixed
 * Hebrew/English content (supplier names next to SKUs) stays visually even.
 */
const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

const dict = getDictionary();

export const metadata: Metadata = {
  title: dict.common.appName,
  description: dict.home.subtitle,
};

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang={DEFAULT_LOCALE}
      dir={LOCALE_DIRECTION[DEFAULT_LOCALE]}
      className={heebo.variable}
    >
      <body>{children}</body>
    </html>
  );
}
