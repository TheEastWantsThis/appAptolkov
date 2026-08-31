import { describe, expect, it } from "vitest";

import { CreateRoomSchema, createTelegramRoomLinks, resolveRoomCapabilities } from "./rooms.js";

describe("room contracts", () => {
  it("requires a password only for private rooms", () => {
    const base = {
      channelId: "868844cc-5c73-4b7d-985e-b14aaf555be1",
      name: "Кино вечером",
      sourceProvider: "YOUTUBE",
      sourceKind: "VIDEO",
      sourceId: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    } as const;
    expect(CreateRoomSchema.safeParse({ ...base, visibility: "PRIVATE" }).success).toBe(false);
    expect(
      CreateRoomSchema.safeParse({ ...base, visibility: "PRIVATE", password: "secret-123" })
        .success,
    ).toBe(true);
    expect(
      CreateRoomSchema.safeParse({ ...base, visibility: "PUBLIC", password: "secret-123" }).success,
    ).toBe(false);
  });
});

describe("room permission matrix", () => {
  it("keeps administrative capabilities owner-only", () => {
    const everyone = resolveRoomCapabilities("VIEWER", "EVERYONE", "VOD");
    expect(everyone).toEqual(["play", "pause", "seek"]);
    expect(everyone).not.toContain("manage_members");
    expect(everyone).not.toContain("delete_chat_message");
  });

  it("allows moderators to moderate chat but not change source", () => {
    const moderator = resolveRoomCapabilities("MODERATOR", "MODERATORS", "VOD");
    expect(moderator).toEqual(["play", "pause", "seek", "delete_chat_message", "mute_chat_member"]);
    expect(moderator).not.toContain("change_source");
    expect(moderator).not.toContain("end_room");
  });

  it("never grants seek for live sources", () => {
    expect(resolveRoomCapabilities("OWNER", "OWNER_ONLY", "LIVE")).not.toContain("seek");
    expect(resolveRoomCapabilities("VIEWER", "EVERYONE", "LIVE")).toEqual(["play", "pause"]);
  });
});

describe("Telegram room deep links", () => {
  it("builds normal and compact links without password data", () => {
    const links = createTelegramRoomLinks("@watchroom_bot", "watch", "AbCdEf0123456789_-xyZA");
    expect(links).toEqual({
      canonical: "https://t.me/watchroom_bot/watch?startapp=room_AbCdEf0123456789_-xyZA",
      compact: "https://t.me/watchroom_bot/watch?startapp=room_AbCdEf0123456789_-xyZA&mode=compact",
    });
    expect(JSON.stringify(links)).not.toContain("password");
  });
});
