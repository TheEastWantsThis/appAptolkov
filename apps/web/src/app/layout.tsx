import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

import { TelegramShell } from "../components/telegram-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "WatchRoom",
  description: "Совместный просмотр YouTube и Twitch в Telegram",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
  width: "device-width",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js?63" strategy="beforeInteractive" />
        <TelegramShell>{children}</TelegramShell>
      </body>
    </html>
  );
}
