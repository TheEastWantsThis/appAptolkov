import { describe, expect, it, vi } from "vitest";

import { PresenceRegistry } from "./presence.js";

describe("PresenceRegistry", () => {
  it("deduplicates devices and keeps a reconnect grace period", () => {
    vi.useFakeTimers();
    const registry = new PresenceRegistry(30_000, 5_000, () => Date.now());
    registry.connect("room", "user", "socket-a");
    registry.connect("room", "user", "socket-b");
    expect(registry.snapshot("room").viewerCount).toBe(1);
    registry.disconnect("room", "user", "socket-a");
    registry.disconnect("room", "user", "socket-b");
    expect(registry.snapshot("room").viewerCount).toBe(1);
    vi.advanceTimersByTime(4_000);
    registry.connect("room", "user", "socket-c");
    vi.advanceTimersByTime(2_000);
    expect(registry.snapshot("room").viewerCount).toBe(1);
    registry.close();
    vi.useRealTimers();
  });

  it("handles 100 simulated connections without retaining them", () => {
    vi.useFakeTimers();
    const registry = new PresenceRegistry(30_000, 1_000, () => Date.now());
    for (let index = 0; index < 100; index += 1)
      registry.connect("load-room", `user-${index}`, `socket-${index}`);
    expect(registry.snapshot("load-room").viewerCount).toBe(100);
    for (let index = 0; index < 100; index += 1)
      registry.disconnect("load-room", `user-${index}`, `socket-${index}`);
    vi.advanceTimersByTime(1_001);
    expect(registry.snapshot("load-room")).toEqual({ viewerCount: 0, userIds: [] });
    registry.close();
    vi.useRealTimers();
  });
});
