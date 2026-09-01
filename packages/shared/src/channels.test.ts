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

  it("accepts an omitted description and returns a concrete field message", () => {
    expect(CreateChannelSchema.parse({ name: "Канал", slug: "safe-room" }).description).toBe("");
    const invalid = CreateChannelSchema.safeParse({ name: "К", slug: "ab" });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          "Название должно содержать минимум 2 символа",
          "Адрес должен содержать минимум 3 символа",
        ]),
      );
    }
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
