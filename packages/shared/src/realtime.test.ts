import { describe, expect, it } from "vitest";

import {
  chooseDriftCorrection,
  expectedPlaybackPosition,
  type PlaybackSnapshot,
} from "./realtime.js";

const snapshot: PlaybackSnapshot = {
  sourceProvider: "YOUTUBE",
  sourceKind: "VIDEO",
  sourceId: "dQw4w9WgXcQ",
  state: "PLAYING",
  positionSeconds: 10,
  changedAtServerMs: 1_000,
  playbackRate: 1,
  version: 3,
  actorUserId: null,
  liveEdge: false,
};

describe("realtime playback math", () => {
  it("advances a playing VOD from server time only", () => {
    expect(expectedPlaybackPosition(snapshot, 4_500)).toBe(13.5);
  });

  it("uses none, soft and hard correction thresholds", () => {
    expect(chooseDriftCorrection(12.2, snapshot, 4_000, true)).toEqual({ kind: "NONE" });
    expect(chooseDriftCorrection(10, snapshot, 4_000, true)).toEqual({
      kind: "SOFT",
      targetSeconds: 13,
    });
    expect(chooseDriftCorrection(1, snapshot, 7_000, true)).toEqual({
      kind: "HARD",
      targetSeconds: 16,
    });
  });

  it("never seeks live or a player without seek capability", () => {
    expect(chooseDriftCorrection(0, { ...snapshot, sourceKind: "LIVE" }, 20_000, true)).toEqual({
      kind: "NONE",
    });
    expect(chooseDriftCorrection(0, snapshot, 20_000, false)).toEqual({ kind: "NONE" });
  });
});
