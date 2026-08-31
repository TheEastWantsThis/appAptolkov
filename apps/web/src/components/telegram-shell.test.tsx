// @vitest-environment jsdom

import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

import { TelegramShell } from "./telegram-shell";

describe("Telegram lifecycle recovery", () => {
  beforeEach(() => {
    delete window.Telegram;
  });

  it("forwards deactivated and activated so room state can persist and reconnect", () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    window.Telegram = {
      WebApp: {
        initData: "",
        colorScheme: "light",
        themeParams: {},
        viewportStableHeight: 640,
        onEvent: (name, handler) => handlers.set(name, handler),
        offEvent: vi.fn(),
        ready: vi.fn(),
      },
    };
    const deactivated = vi.fn();
    const activated = vi.fn();
    window.addEventListener("watchroom:telegram-deactivated", deactivated);
    window.addEventListener("watchroom:telegram-activated", activated);
    const view = render(<TelegramShell>room</TelegramShell>);

    act(() => handlers.get("deactivated")?.());
    act(() => handlers.get("activated")?.());

    expect(deactivated).toHaveBeenCalledOnce();
    expect(activated).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.telegramActive).toBe("true");
    view.unmount();
    window.removeEventListener("watchroom:telegram-deactivated", deactivated);
    window.removeEventListener("watchroom:telegram-activated", activated);
  });
});
