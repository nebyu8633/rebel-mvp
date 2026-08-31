import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";

import { MotionProvider } from "@/components/motion/MotionProvider";
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
      <body>
        {/*
         * The provider only supplies Motion's feature bundle through context;
         * it renders no DOM of its own, so the body stays a direct parent of
         * the page and nothing about the layout changes.
         */}
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
