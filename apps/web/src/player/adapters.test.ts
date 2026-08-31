// @vitest-environment jsdom

import type { PlayerSource } from "@watchroom/shared";
import { describe, expect, it, vi } from "vitest";

import { TwitchPlayerAdapter, validateTwitchParents } from "./twitch-adapter";
import type {
  TwitchNamespace,
  TwitchPlayerInstance,
  YouTubeNamespace,
  YouTubePlayerInstance,
} from "./vendor-types";
import { YouTubePlayerAdapter } from "./youtube-adapter";

describe("YouTubePlayerAdapter", () => {
  it("uses the official SDK operations and forwards autoplay blocking", async () => {
    let callbacks:
      | {
          onReady: () => void;
          onStateChange: (event: { data: number }) => void;
          onError: (event: { data: number }) => void;
          onAutoplayBlocked: () => void;
        }
      | undefined;
    const instance: YouTubePlayerInstance = {
      cueVideoById: vi.fn(),
      destroy: vi.fn(),
      getCurrentTime: vi.fn(() => 12),
      getDuration: vi.fn(() => 120),
      getPlayerState: vi.fn(() => 1),
      mute: vi.fn(),
      pauseVideo: vi.fn(),
      playVideo: vi.fn(),
      seekTo: vi.fn(),
      unMute: vi.fn(),
    };
    function Player(_element: HTMLElement, options: { events: NonNullable<typeof callbacks> }) {
      callbacks = options.events;
      queueMicrotask(options.events.onReady);
      return instance;
    }
    const sdk: YouTubeNamespace = {
      Player: Player as unknown as YouTubeNamespace["Player"],
    };
    const source: PlayerSource = {
      provider: "YOUTUBE",
      kind: "VIDEO",
      sourceId: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    };
    const adapter = new YouTubePlayerAdapter(document.createElement("div"), async () => sdk);
    const blocked = vi.fn();
    adapter.on("AUTOPLAY_BLOCKED", blocked);
    await adapter.loadSource(source);
    adapter.play();
    adapter.seek(42);
    callbacks?.onAutoplayBlocked();
    expect(instance.playVideo).toHaveBeenCalledOnce();
    expect(instance.seekTo).toHaveBeenCalledWith(42, true);
    expect(blocked).toHaveBeenCalledOnce();
  });
});

describe("TwitchPlayerAdapter", () => {
  it("passes only configured parent values and blocks live seek/time", async () => {
    let optionsSeen: Record<string, unknown> | undefined;
    const instance: TwitchPlayerInstance = {
      addEventListener(event, handler) {
        if (event === "READY") queueMicrotask(handler);
      },
      getCurrentTime: vi.fn(() => 12),
      getDuration: vi.fn(() => 120),
      isPaused: vi.fn(() => false),
      pause: vi.fn(),
      play: vi.fn(),
      seek: vi.fn(),
      setChannel: vi.fn(),
      setMuted: vi.fn(),
      setVideo: vi.fn(),
    };
    function FakePlayer(_id: string, options: Record<string, unknown>) {
      optionsSeen = options;
      return instance;
    }
    const sdk = {
      Player: Object.assign(FakePlayer, {
        READY: "READY",
        PLAY: "PLAY",
        PLAYING: "PLAYING",
        PAUSE: "PAUSE",
        ENDED: "ENDED",
        PLAYBACK_BLOCKED: "PLAYBACK_BLOCKED",
        OFFLINE: "OFFLINE",
      }),
    } as unknown as TwitchNamespace;
    const source: PlayerSource = {
      provider: "TWITCH",
      kind: "LIVE",
      sourceId: "twitchdev",
      canonicalUrl: "https://www.twitch.tv/twitchdev",
    };
    const container = document.createElement("div");
    const adapter = new TwitchPlayerAdapter(
      container,
      ["localhost", "app.example.com"],
      async () => sdk,
    );
    await adapter.loadSource(source);
    expect(optionsSeen).toMatchObject({
      channel: "twitchdev",
      parent: ["localhost", "app.example.com"],
      autoplay: false,
      muted: true,
    });
    expect(adapter.getCurrentTime()).toBeNull();
    expect(adapter.getDuration()).toBeNull();
    expect(() => adapter.seek(10)).toThrow("Операция seek недоступна");
    expect(instance.seek).not.toHaveBeenCalled();
  });

  it("rejects schemes, ports and wildcards in parent configuration", () => {
    expect(() => validateTwitchParents(["https://app.example.com"])).toThrow();
    expect(() => validateTwitchParents(["*.example.com"])).toThrow();
    expect(() => validateTwitchParents(["localhost:3000"])).toThrow();
  });
});
