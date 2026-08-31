import { describe, expect, it } from "vitest";

import { AddChannelMemberSchema, CreateChannelSchema } from "./channels.js";

describe("CreateChannelSchema", () => {
  it("normalizes safe channel input", () => {
    const channel = CreateChannelSchema.parse({ name: "  Авторский канал  ", slug: "  MY-ROOM  " });
    expect(channel).toMatchObject({
      name: "Авторский канал",
      slug: "my-room",
      description: "",
      visibility: "PUBLIC",
    });
  });

  it("rejects unsafe slugs and non-HTTPS avatars", () => {
    expect(() => CreateChannelSchema.parse({ name: "Канал", slug: "../admin" })).toThrow();
    expect(() =>
      CreateChannelSchema.parse({
        name: "Канал",
        slug: "safe-room",
        avatarUrl: "http://example.com/a.png",
      }),
    ).toThrow();
    expect(() =>
      CreateChannelSchema.parse({
        name: "Канал",
        slug: "safe-room",
        avatarUrl: "https://images.attacker.example/tracker.png",
      }),
    ).toThrow();
    expect(
      CreateChannelSchema.parse({
        name: "Канал",
        slug: "safe-room",
        avatarUrl: "https://i.ytimg.com/vi/example/hqdefault.jpg",
      }).avatarUrl,
    ).toContain("i.ytimg.com");
  });

  it("normalizes Telegram usernames for channel membership", () => {
    expect(AddChannelMemberSchema.parse({ username: " @Member_2026 " })).toEqual({
      username: "member_2026",
      role: "MEMBER",
    });
    expect(() => AddChannelMemberSchema.parse({ username: "bad-name" })).toThrow();
  });
});
