import { describe, expect, it } from "vitest";

import {
  SourceParseError,
  normalizePlayerSource,
  parsePlayerSource,
  parseTwitchSource,
  parseYouTubeSource,
  playerCapabilities,
} from "./sources.js";

describe("YouTube source parser", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    "dQw4w9WgXcQ",
  ])("normalizes %s", (input) => {
    expect(parseYouTubeSource(input)).toMatchObject({
      provider: "YOUTUBE",
      sourceId: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  it("recognizes the official live path", () => {
    expect(parseYouTubeSource("https://youtube.com/live/dQw4w9WgXcQ").kind).toBe("LIVE");
  });
});

describe("Twitch source parser", () => {
  it("normalizes channels and VODs", () => {
    expect(parseTwitchSource("https://www.twitch.tv/TwitchDev", "LIVE")).toEqual({
      provider: "TWITCH",
      kind: "LIVE",
      sourceId: "twitchdev",
      canonicalUrl: "https://www.twitch.tv/twitchdev",
    });
    expect(parseTwitchSource("https://www.twitch.tv/videos/123456789", "VOD")).toEqual({
      provider: "TWITCH",
      kind: "VOD",
      sourceId: "123456789",
      canonicalUrl: "https://www.twitch.tv/videos/123456789",
    });
  });

  it("never exposes live seek/time capabilities", () => {
    expect(playerCapabilities(parseTwitchSource("twitchdev", "LIVE"))).toEqual({
      seek: false,
      currentTime: false,
      duration: false,
    });
  });
});

describe("malicious and ambiguous sources", () => {
  it("rejects mismatched ids and URLs", () => {
    expect(() =>
      normalizePlayerSource({
        provider: "YOUTUBE",
        kind: "VIDEO",
        sourceId: "dQw4w9WgXcQ",
        canonicalUrl: "https://youtu.be/aqz-KE-bpKQ",
      }),
    ).toThrow(SourceParseError);
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "https://youtube.com@evil.test/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&v=M7lc1UVf-VE",
    "https://youtu.be/dQw4w9WgXcQ/extra",
    "https://www.youtube.com/embed/%2e%2e%2fmalicious",
    "https://www.youtube.com/watch?v=<script>",
  ])("rejects unsafe YouTube input %s", (input) => {
    expect(() => parseYouTubeSource(input)).toThrow(SourceParseError);
  });

  it.each([
    "javascript:alert(1)",
    "https://twitch.tv.evil.test/twitchdev",
    "https://twitch.tv@evil.test/twitchdev",
    "https://player.twitch.tv/?channel=twitchdev&parent=evil.test",
    "https://www.twitch.tv/videos/123/extra",
    "https://www.twitch.tv/directory",
    "https://www.twitch.tv/videos/abc",
  ])("rejects unsafe Twitch input %s", (input) => {
    expect(() => parseTwitchSource(input, input.includes("videos") ? "VOD" : "LIVE")).toThrow(
      SourceParseError,
    );
  });

  it("rejects Twitch VIDEO as an ambiguous kind", () => {
    expect(() =>
      parsePlayerSource({ provider: "TWITCH", kind: "VIDEO", input: "twitchdev" }),
    ).toThrow(SourceParseError);
  });
});
