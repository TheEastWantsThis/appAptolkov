import { describe, expect, it } from "vitest";

import { normalizeChannelSlug } from "./channel-form";

describe("normalizeChannelSlug", () => {
  it("creates a valid address from a Russian channel name", () => {
    expect(normalizeChannelSlug("Мой канал 2026")).toBe("moi-kanal-2026");
  });

  it("normalizes separators and unsafe characters", () => {
    expect(normalizeChannelSlug("  My / New --- Channel!  ")).toBe("my-new-channel");
  });
});
