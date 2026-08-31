// @vitest-environment jsdom

import type { PlayerCapabilities, PlayerEvent, PlayerSource, PlayerState } from "@watchroom/shared";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlayerAdapter, PlayerEventDetail, PlayerEventHandler } from "../player/types";
import { OfficialPlayer } from "./official-player";

class FakeAdapter implements PlayerAdapter {
  readonly capabilities: PlayerCapabilities;
  readonly loadSource = vi.fn(async () => undefined);
  readonly play = vi.fn();
  readonly pause = vi.fn();
  readonly seek = vi.fn();
  readonly getCurrentTime = vi.fn(() => 0);
  readonly getDuration = vi.fn(() => 100);
  readonly setMuted = vi.fn();
  readonly destroy = vi.fn();
  private readonly handlers = new Map<PlayerEvent, Set<PlayerEventHandler>>();

  constructor(capabilities: PlayerCapabilities) {
    this.capabilities = capabilities;
  }

  getState(): PlayerState {
    return "READY";
  }

  on(event: PlayerEvent, handler: PlayerEventHandler): () => void {
    const current = this.handlers.get(event) ?? new Set<PlayerEventHandler>();
    current.add(handler);
    this.handlers.set(event, current);
    return () => current.delete(handler);
  }

  emit(detail: PlayerEventDetail): void {
    for (const handler of this.handlers.get(detail.event) ?? []) handler(detail);
  }
}

const youtubeSource: PlayerSource = {
  provider: "YOUTUBE",
  kind: "VIDEO",
  sourceId: "dQw4w9WgXcQ",
  canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
};

afterEach(cleanup);

describe("OfficialPlayer", () => {
  it("never autoplays and starts unmuted only from a user click", async () => {
    const adapter = new FakeAdapter({ seek: true, currentTime: true, duration: true });
    render(<OfficialPlayer adapterFactory={() => adapter} source={youtubeSource} />);
    await waitFor(() => expect(adapter.loadSource).toHaveBeenCalledWith(youtubeSource));
    expect(adapter.play).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Начать просмотр" }));
    expect(adapter.setMuted).toHaveBeenCalledWith(false);
    expect(adapter.play).toHaveBeenCalledOnce();
  });

  it("shows an original-link fallback for provider errors", async () => {
    const adapter = new FakeAdapter({ seek: true, currentTime: true, duration: true });
    render(<OfficialPlayer adapterFactory={() => adapter} source={youtubeSource} />);
    await waitFor(() => expect(adapter.loadSource).toHaveBeenCalled());
    act(() => {
      adapter.emit({
        event: "ERROR",
        error: {
          code: "YOUTUBE_101",
          message: "Автор запретил встраивание этого видео.",
          originalUrl: youtubeSource.canonicalUrl,
        },
      });
    });
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Автор запретил встраивание этого видео.",
    );
    expect(screen.getByRole("link", { name: "Открыть оригинал" }).getAttribute("href")).toBe(
      youtubeSource.canonicalUrl,
    );
  });

  it("does not render seek for Twitch live", () => {
    const source: PlayerSource = {
      provider: "TWITCH",
      kind: "LIVE",
      sourceId: "twitchdev",
      canonicalUrl: "https://www.twitch.tv/twitchdev",
    };
    const adapter = new FakeAdapter({ seek: false, currentTime: false, duration: false });
    render(<OfficialPlayer adapterFactory={() => adapter} source={source} />);
    expect(screen.queryByRole("button", { name: "Перейти" })).toBeNull();
  });

  it("does not expose local seek without the server permission", () => {
    const adapter = new FakeAdapter({ seek: true, currentTime: true, duration: true });
    const { rerender } = render(
      <OfficialPlayer adapterFactory={() => adapter} source={youtubeSource} />,
    );
    expect(screen.queryByRole("button", { name: "Перейти" })).toBeNull();
    rerender(
      <OfficialPlayer allowLocalSeek adapterFactory={() => adapter} source={youtubeSource} />,
    );
    expect(screen.getByRole("button", { name: "Перейти" })).toBeTruthy();
  });

  it("reports autoplay blocking to the room UI", async () => {
    const adapter = new FakeAdapter({ seek: true, currentTime: true, duration: true });
    const onStateChange = vi.fn();
    render(
      <OfficialPlayer
        adapterFactory={() => adapter}
        onStateChange={onStateChange}
        source={youtubeSource}
      />,
    );
    await waitFor(() => expect(adapter.loadSource).toHaveBeenCalled());
    act(() => adapter.emit({ event: "AUTOPLAY_BLOCKED" }));
    expect(onStateChange).toHaveBeenCalledWith("AUTOPLAY_BLOCKED");
    expect(screen.getByText(/Telegram или браузер заблокировал/)).toBeTruthy();
  });

  it("hides system PiP for an official cross-origin iframe", async () => {
    Object.defineProperty(document, "pictureInPictureEnabled", {
      configurable: true,
      value: true,
    });
    const adapter = new FakeAdapter({ seek: true, currentTime: true, duration: true });
    render(
      <OfficialPlayer
        adapterFactory={(container) => {
          container.append(document.createElement("iframe"));
          return adapter;
        }}
        source={youtubeSource}
      />,
    );
    await waitFor(() => expect(adapter.loadSource).toHaveBeenCalled());
    expect(
      screen.queryByRole("button", { name: "Открыть системный режим картинка в картинке" }),
    ).toBeNull();
  });
});
