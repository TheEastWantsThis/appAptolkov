import { describe, expect, it } from "vitest";

import { shouldReloadTwitchLiveEdge } from "./live-edge";

const playback = {
  sourceProvider: "TWITCH" as const,
  sourceKind: "LIVE" as const,
  sourceId: "watchroom",
  state: "PLAYING" as const,
  positionSeconds: 0,
  changedAtServerMs: 1,
  playbackRate: 1 as const,
  version: 4,
  actorUserId: null,
  liveEdge: true,
};

describe("Twitch live edge", () => {
  it("reloads a live channel once per authoritative version", () => {
    const room = {
      sourceProvider: "TWITCH" as const,
      sourceKind: "LIVE" as const,
      sourceId: "watchroom",
    };
    expect(shouldReloadTwitchLiveEdge(playback, room, null)).toBe(true);
    expect(shouldReloadTwitchLiveEdge(playback, room, 4)).toBe(false);
  });

  it("never reloads Twitch VOD or YouTube", () => {
    expect(shouldReloadTwitchLiveEdge(playback, { ...playback, sourceKind: "VOD" }, null)).toBe(
      false,
    );
    expect(
      shouldReloadTwitchLiveEdge(
        { ...playback, sourceProvider: "YOUTUBE" },
        { sourceProvider: "YOUTUBE", sourceKind: "LIVE", sourceId: "watchroom" },
        null,
      ),
    ).toBe(false);
  });
});
