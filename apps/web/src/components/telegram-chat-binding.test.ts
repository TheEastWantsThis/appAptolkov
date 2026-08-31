// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { supportsTelegramChatRequest } from "./telegram-chat-binding";

describe("Telegram chat request support", () => {
  it("uses the explicit requestChat feature check", () => {
    expect(supportsTelegramChatRequest(undefined)).toBe(false);
    expect(supportsTelegramChatRequest({})).toBe(false);
    expect(supportsTelegramChatRequest({ requestChat: () => undefined })).toBe(true);
  });
});
