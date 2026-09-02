import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createApi, type ApiRuntime } from "./app.js";
import { loadApiConfig } from "./config.js";
import type { DatabaseHealth } from "./database.js";
import { MemoryWatchRoomStore } from "./store.js";

const botToken = "123456789:abcdefghijklmnopqrstuvwxyzABCDEFG";
const fixedNow = new Date();
const config = loadApiConfig({
  NODE_ENV: "test",
  API_HOST: "127.0.0.1",
  API_PORT: "4000",
  DATABASE_URL: "postgresql://watchroom:watchroom@localhost:5432/watchroom_test",
  WEB_ORIGIN: "http://localhost:3000",
  LOG_LEVEL: "silent",
  SHUTDOWN_TIMEOUT_MS: "5000",
  MOCK_TELEGRAM_AUTH: "false",
  TELEGRAM_BOT_TOKEN: botToken,
});
const database: DatabaseHealth = {
  ping: vi.fn(async () => undefined),
  close: vi.fn(async () => undefined),
};

function sign(userId: number, nonce: string, username?: string): string {
  const fields = new URLSearchParams({
    auth_date: String(Math.floor(fixedNow.getTime() / 1_000)),
    query_id: nonce,
    user: JSON.stringify({ id: userId, first_name: `User ${userId}`, username }),
  });
  const check = [...fields.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  fields.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
  return fields.toString();
}

function cookieOf(response: {
  cookies?: Array<{ name: string; value: string }>;
  headers: Record<string, string | string[] | undefined>;
}): string {
  const parsed = response.cookies?.find((cookie) => cookie.name === "watchroom_session");
  if (parsed) return `${parsed.name}=${parsed.value}`;
  const header = response.headers["set-cookie"];
  const serialized = Array.isArray(header) ? header.join(",") : (header ?? "");
  const session = /(?:^|,)\s*(watchroom_session=[^;,\s]+)/.exec(serialized)?.[1];
  return session ?? "";
}

let runtime: ApiRuntime | undefined;
afterEach(async () => {
  await runtime?.close();
  runtime = undefined;
});

describe("identity and channel authorization", () => {
  it("rejects login CSRF and revokes the current session on logout", async () => {
    runtime = createApi(config, {
      database,
      store: new MemoryWatchRoomStore(),
      now: () => fixedNow,
    });
    const wrongOrigin = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: "https://attacker.example" },
      payload: { initData: sign(40, "wrong-origin") },
    });
    expect(wrongOrigin.statusCode).toBe(403);

    const auth = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: sign(40, "logout") },
    });
    const cookie = cookieOf(auth);
    expect(auth.json().accessToken).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    const session = await runtime.app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { cookie },
    });
    expect(session.statusCode).toBe(200);
    expect(session.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(session.headers["cache-control"]).toBe("no-store");
    const bearerSession = await runtime.app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { authorization: `Bearer ${auth.json().accessToken as string}` },
    });
    expect(bearerSession.statusCode).toBe(200);

    const withoutCsrf = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: { cookie, origin: config.WEB_ORIGIN },
      payload: {},
    });
    expect(withoutCsrf.json().error.code).toBe("INVALID_CSRF");
    const logout = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: {
        cookie,
        origin: config.WEB_ORIGIN,
        "x-csrf-token": auth.json().csrfToken as string,
      },
      payload: {},
    });
    expect(logout.statusCode).toBe(204);
    expect(
      (
        await runtime.app.inject({
          method: "GET",
          url: "/v1/auth/session",
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(401);

    const bearerAuth = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: sign(41, "bearer") },
    });
    const bearer = bearerAuth.json().accessToken as string;
    const bearerMutation = await runtime.app.inject({
      method: "POST",
      url: "/v1/channels",
      headers: {
        authorization: `Bearer ${bearer}`,
        origin: config.WEB_ORIGIN,
      },
      payload: { name: "Мобильный канал", slug: "mobile-channel", visibility: "PUBLIC" },
    });
    expect(bearerMutation.statusCode, bearerMutation.body).toBe(201);
    const bearerLogout = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: {
        authorization: `Bearer ${bearer}`,
        origin: config.WEB_ORIGIN,
      },
      payload: {},
    });
    expect(bearerLogout.statusCode).toBe(204);
  });

  it("upserts one user for repeated telegram user id and blocks initData replay", async () => {
    runtime = createApi(config, {
      database,
      store: new MemoryWatchRoomStore(),
      now: () => fixedNow,
    });
    const first = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: sign(42, "one") },
    });
    const second = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: sign(42, "two") },
    });
    const replay = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: sign(42, "one") },
    });
    expect(first.statusCode).toBe(200);
    expect(second.json().user.id).toBe(first.json().user.id);
    expect(replay.statusCode).toBe(409);
  });

  it("prevents another user from editing the owner's channel", async () => {
    runtime = createApi(config, {
      database,
      store: new MemoryWatchRoomStore(),
      now: () => fixedNow,
    });
    const ownerAuth = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: sign(101, "owner") },
    });
    const owner = ownerAuth.json();
    expect(ownerAuth.cookies.map((cookie) => cookie.name)).toContain("watchroom_session");
    expect(cookieOf(ownerAuth).startsWith("watchroom_session=")).toBe(true);
    const created = await runtime.app.inject({
      method: "POST",
      url: "/v1/channels",
      headers: {
        cookie: cookieOf(ownerAuth),
        origin: config.WEB_ORIGIN,
        "x-csrf-token": owner.csrfToken,
      },
      payload: {
        name: "Канал автора",
        slug: "author-channel",
        description: "",
        visibility: "PUBLIC",
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    const withoutCsrf = await runtime.app.inject({
      method: "PATCH",
      url: `/v1/channels/${created.json().channel.id}`,
      headers: { cookie: cookieOf(ownerAuth), origin: config.WEB_ORIGIN },
      payload: { name: "Без CSRF" },
    });
    const intruderAuth = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: sign(202, "intruder") },
    });
    const intruder = intruderAuth.json();
    const publicCatalog = await runtime.app.inject({
      method: "GET",
      url: "/v1/channels/public",
      headers: { cookie: cookieOf(intruderAuth), origin: config.WEB_ORIGIN },
    });
    const edited = await runtime.app.inject({
      method: "PATCH",
      url: `/v1/channels/${created.json().channel.id}`,
      headers: {
        cookie: cookieOf(intruderAuth),
        origin: config.WEB_ORIGIN,
        "x-csrf-token": intruder.csrfToken,
      },
      payload: { name: "Чужое имя" },
    });
    expect(withoutCsrf.statusCode).toBe(403);
    expect(withoutCsrf.json().error.code).toBe("INVALID_CSRF");
    expect(publicCatalog.statusCode).toBe(200);
    expect(publicCatalog.json().channels).toEqual([
      expect.objectContaining({ slug: "author-channel", role: null, visibility: "PUBLIC" }),
    ]);
    expect(edited.statusCode).toBe(403);
    expect(edited.json().error.code).toBe("CHANNEL_FORBIDDEN");
  });

  it("lets only the owner manage channel members and protects the owner role", async () => {
    runtime = createApi(config, {
      database,
      store: new MemoryWatchRoomStore(),
      now: () => fixedNow,
    });
    const ownerAuth = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: sign(301, "member-owner", "owner_301") },
    });
    const memberAuth = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: sign(302, "member-target", "member_302") },
    });
    const ownerHeaders = {
      cookie: cookieOf(ownerAuth),
      origin: config.WEB_ORIGIN,
      "x-csrf-token": ownerAuth.json().csrfToken as string,
    };
    const memberHeaders = {
      cookie: cookieOf(memberAuth),
      origin: config.WEB_ORIGIN,
      "x-csrf-token": memberAuth.json().csrfToken as string,
    };
    const created = await runtime.app.inject({
      method: "POST",
      url: "/v1/channels",
      headers: ownerHeaders,
      payload: { name: "Команда", slug: "channel-team" },
    });
    const channelId = created.json().channel.id as string;
    const added = await runtime.app.inject({
      method: "POST",
      url: `/v1/channels/${channelId}/members`,
      headers: ownerHeaders,
      payload: { username: "@MEMBER_302", role: "MEMBER" },
    });
    expect(added.statusCode, added.body).toBe(201);
    expect(added.json().member.role).toBe("MEMBER");

    const memberChannels = await runtime.app.inject({
      method: "GET",
      url: "/v1/channels",
      headers: { cookie: cookieOf(memberAuth) },
    });
    expect(memberChannels.json().channels[0].role).toBe("MEMBER");

    const forbidden = await runtime.app.inject({
      method: "PATCH",
      url: `/v1/channels/${channelId}/members/${ownerAuth.json().user.id as string}`,
      headers: memberHeaders,
      payload: { role: "MEMBER" },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error.code).toBe("CHANNEL_FORBIDDEN");

    const promoted = await runtime.app.inject({
      method: "PATCH",
      url: `/v1/channels/${channelId}/members/${memberAuth.json().user.id as string}`,
      headers: ownerHeaders,
      payload: { role: "MODERATOR" },
    });
    expect(promoted.json().member.role).toBe("MODERATOR");

    const ownerProtected = await runtime.app.inject({
      method: "DELETE",
      url: `/v1/channels/${channelId}/members/${ownerAuth.json().user.id as string}`,
      headers: ownerHeaders,
    });
    expect(ownerProtected.statusCode).toBe(409);
    expect(ownerProtected.json().error.code).toBe("CHANNEL_OWNER_IMMUTABLE");
  });
});
