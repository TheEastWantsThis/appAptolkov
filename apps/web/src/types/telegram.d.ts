interface TelegramThemeParams {
  accent_text_color?: string;
  bg_color?: string;
  button_color?: string;
  button_text_color?: string;
  destructive_text_color?: string;
  header_bg_color?: string;
  hint_color?: string;
  link_color?: string;
  secondary_bg_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  text_color?: string;
}

interface TelegramSafeAreaInset {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface TelegramWebApp {
  initData: string;
  colorScheme: "light" | "dark";
  contentSafeAreaInset?: TelegramSafeAreaInset;
  isActive?: boolean;
  isExpanded?: boolean;
  isFullscreen?: boolean;
  isVersionAtLeast?(version: string): boolean;
  BackButton?: {
    hide(): void;
    offClick(callback: () => void): void;
    onClick(callback: () => void): void;
    show(): void;
  };
  MainButton?: {
    hide(): void;
    offClick(callback: () => void): void;
    onClick(callback: () => void): void;
    setParams(params: { is_active?: boolean; is_visible?: boolean; text?: string }): void;
    show(): void;
  };
  SecondaryButton?: {
    hide(): void;
    offClick(callback: () => void): void;
    onClick(callback: () => void): void;
    setParams(params: { is_active?: boolean; is_visible?: boolean; text?: string }): void;
    show(): void;
  };
  offEvent(eventType: string, eventHandler: (...args: unknown[]) => void): void;
  onEvent(eventType: string, eventHandler: (...args: unknown[]) => void): void;
  ready(): void;
  expand?(): void;
  requestFullscreen?(): void;
  exitFullscreen?(): void;
  openTelegramLink?(url: string): void;
  shareMessage?(messageId: string, callback?: (success: boolean) => void): void;
  switchInlineQuery?(query: string, chooseChatTypes?: string[]): void;
  requestChat?(requestId: string, callback?: (success: boolean) => void): void;
  safeAreaInset?: TelegramSafeAreaInset;
  themeParams: TelegramThemeParams;
  viewportStableHeight: number;
}

interface WindowEventMap {
  "watchroom:telegram-activated": CustomEvent;
  "watchroom:telegram-deactivated": CustomEvent;
  "watchroom:telegram-viewport": CustomEvent;
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}
