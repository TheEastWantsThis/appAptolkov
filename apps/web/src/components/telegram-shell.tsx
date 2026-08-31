"use client";

import { useEffect, type ReactNode } from "react";

import { WatchRoomProvider } from "./watchroom-provider";

const themeVariableMap = {
  accent_text_color: "--tg-theme-accent-text-color",
  bg_color: "--tg-theme-bg-color",
  button_color: "--tg-theme-button-color",
  button_text_color: "--tg-theme-button-text-color",
  destructive_text_color: "--tg-theme-destructive-text-color",
  header_bg_color: "--tg-theme-header-bg-color",
  hint_color: "--tg-theme-hint-color",
  link_color: "--tg-theme-link-color",
  secondary_bg_color: "--tg-theme-secondary-bg-color",
  section_bg_color: "--tg-theme-section-bg-color",
  section_header_text_color: "--tg-theme-section-header-text-color",
  subtitle_text_color: "--tg-theme-subtitle-text-color",
  text_color: "--tg-theme-text-color",
} satisfies Record<keyof TelegramThemeParams, string>;

const telegramColorPattern = /^#[0-9a-f]{6}$/i;

function setInsetVariables(prefix: string, inset: TelegramSafeAreaInset | undefined): void {
  if (!inset) return;

  const root = document.documentElement;
  root.style.setProperty(`${prefix}-top`, `${Math.max(0, inset.top)}px`);
  root.style.setProperty(`${prefix}-right`, `${Math.max(0, inset.right)}px`);
  root.style.setProperty(`${prefix}-bottom`, `${Math.max(0, inset.bottom)}px`);
  root.style.setProperty(`${prefix}-left`, `${Math.max(0, inset.left)}px`);
}

function synchronizeTelegramViewport(): void {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return;

  const root = document.documentElement;
  root.dataset.theme = webApp.colorScheme;

  if (Number.isFinite(webApp.viewportStableHeight) && webApp.viewportStableHeight > 0) {
    root.style.setProperty("--tg-viewport-stable-height", `${webApp.viewportStableHeight}px`);
  }

  for (const [key, cssVariable] of Object.entries(themeVariableMap)) {
    const color = webApp.themeParams[key as keyof TelegramThemeParams];
    if (color && telegramColorPattern.test(color)) {
      root.style.setProperty(cssVariable, color);
    }
  }

  setInsetVariables("--tg-safe-area-inset", webApp.safeAreaInset);
  setInsetVariables("--tg-content-safe-area-inset", webApp.contentSafeAreaInset);
  window.dispatchEvent(new CustomEvent("watchroom:telegram-viewport"));
}

export function TelegramShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    synchronizeTelegramViewport();
    webApp?.ready();

    const activated = () => {
      document.documentElement.dataset.telegramActive = "true";
      window.dispatchEvent(new CustomEvent("watchroom:telegram-activated"));
    };
    const deactivated = () => {
      document.documentElement.dataset.telegramActive = "false";
      window.dispatchEvent(new CustomEvent("watchroom:telegram-deactivated"));
    };

    const eventNames = [
      "themeChanged",
      "viewportChanged",
      "safeAreaChanged",
      "contentSafeAreaChanged",
    ] as const;

    for (const eventName of eventNames) {
      webApp?.onEvent(eventName, synchronizeTelegramViewport);
    }
    webApp?.onEvent("activated", activated);
    webApp?.onEvent("deactivated", deactivated);

    return () => {
      for (const eventName of eventNames) {
        webApp?.offEvent(eventName, synchronizeTelegramViewport);
      }
      webApp?.offEvent("activated", activated);
      webApp?.offEvent("deactivated", deactivated);
    };
  }, []);

  return <WatchRoomProvider>{children}</WatchRoomProvider>;
}
