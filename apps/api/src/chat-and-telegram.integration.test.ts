import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createApi, type ApiRuntime } from "./app.js";
import { loadApiConfig } from "./config.js";
import type { DatabaseHealth } from "./database.js";
import { MemoryRoomStore } from "./room-store.js";
import { MemoryWatchRoomStore } from "./store.js";

const botToken = "123456789:abcdefghijklmnopqrstuvwxyzABCDEFG";
const webhookSecret = "watchroom-test-webhook-secret-1234567890";
const origin = "http://localhost:3000";
const database: DatabaseHealth = {
  ping: vi.fn(async () => undefined),
  close: vi.fn(async () => undefined),
};

function makeConfig(extra: Record<string, string> = {}) {
  return loadApiConfig({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://watchroom:watchroom@localhost:5432/watchroom_test",
    WEB_ORIGIN: origin,
    LOG_LEVEL: "silent",
    MOCK_TELEGRAM_AUTH: "false",
    TELEGRAM_BOT_TOKEN: botToken,
    TELEGRAM_WEBHOOK_SECRET: webhookSecret,
    TELEGRAM_BOT_USERNAME: "watchroom_bot",
    TELEGRAM_APP_SHORT_NAME: "watchroom",
    SESSION_TTL_SECONDS: "86400",
    ...extra,
  });
}

function sign(userId: number, nonce: string, current: Date): string {
  const fields = new URLSearchParams({
    auth_date: String(Math.floor(current.getTime() / 1_000)),
    query_id: nonce,
    user: JSON.stringify({ id: userId, first_name: `User ${userId}` }),
  });
  const check = [...fields.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  fields.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
  return fields.toString();
}

function cookieOf(response: { cookies: Array<{ name: string; value: string }> }): string {
  const cookie = response.cookies.find((item) => item.name === "watchroom_session");
  return cookie ? `${cookie.name}=${cookie.value}` : "";
}

async function authenticate(runtime: ApiRuntime, userId: number, nonce: string, current: Date) {
  const response = await runtime.app.inject({
    method: "POST",
    url: "/v1/auth/telegram",
    headers: { origin },
    payload: { initData: sign(userId, nonce, current) },
  });
  expect(response.statusCode, response.body).toBe(200);
  return {
    id: response.json().user.id as string,
    cookie: cookieOf(response),
    headers: {
      cookie: cookieOf(response),
      origin,
      "x-csrf-token": response.json().csrfToken as string,
    },
  };
}

async function createRoom(runtime: ApiRuntime, headers: Record<string, string>) {
  const channel = await runtime.app.inject({
    method: "POST",
    url: "/v1/channels",
    headers,
    payload: { name: "Chat tests", slug: `chat-tests-${crypto.randomUUID().slice(0, 8)}` },
  });
  const created = await runtime.app.inject({
    method: "POST",
    url: "/v1/rooms",
    headers,
    payload: {
      channelId: channel.json().channel.id,
      name: "Комната общения",
      visibility: "PUBLIC",
      controlPolicy: "MODERATORS",
      sourceProvider: "YOUTUBE",
      sourceKind: "VIDEO",
      sourceId: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  return created.json().room as { id: string; publicId: string };
}

let runtime: ApiRuntime | undefined;
afterEach(async () => {
  await runtime?.close();
  runtime = undefined;
  vi.useRealTimers();
});

describe("bounded room chat and moderation", () => {
  it("answers the switchInlineQuery fallback with a safe room invitation", async () => {
    const current = new Date();
    const telegramFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, result: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    runtime = createApi(makeConfig(), {
      database,
      store: new MemoryWatchRoomStore(),
      now: () => current,
      telegramFetch,
    });
    const owner = await authenticate(runtime, 7001, "inline-owner", current);
    const room = await createRoom(runtime, owner.headers);
    await runtime.app.inject({
      method: "PATCH",
      url: `/v1/rooms/${room.id}`,
      headers: owner.headers,
      payload: { status: "WAITING" },
    });
    const webhook = await runtime.app.inject({
      method: "POST",
      url: "/v1/telegram/webhook",
      headers: { "x-telegram-bot-api-secret-token": webhookSecret },
      payload: {
        inline_query: {
          id: "inline-query-1",
          from: { id: 7001 },
          query: `room_${room.publicId}`,
        },
      },
    });
    expect(webhook.statusCode, webhook.body).toBe(200);
    const answerCall = telegramFetch.mock.calls.find((call) =>
      String(call[0]).endsWith("/answerInlineQuery"),
    );
    const payload = JSON.parse(String(answerCall?.[1]?.body)) as {
      results: Array<{ input_message_content: { message_text: string } }>;
    };
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0]?.input_message_content.message_text).toContain(
      `startapp=room_${room.publicId}`,
    );
    expect(payload.results[0]?.input_message_content.message_text).not.toContain("password");
  });

  it("allows own deletion, records text-free audit, enforces mute hierarchy and 24h TTL", async () => {
    let current = new Date();
    runtime = createApi(makeConfig({ CHAT_RATE_LIMIT_PER_MINUTE: "120" }), {
      database,
      store: new MemoryWatchRoomStore(),
      now: () => current,
    });
    const owner = await authenticate(runtime, 7101, "owner", current);
    const moderator = await authenticate(runtime, 7102, "moderator", current);
    const viewer = await authenticate(runtime, 7103, "viewer", current);
    const room = await createRoom(runtime, owner.headers);
    for (const member of [moderator, viewer])
      await runtime.app.inject({
        method: "POST",
        url: `/v1/rooms/${room.publicId}/join`,
        headers: member.headers,
        payload: {},
      });
    await runtime.app.inject({
      method: "PUT",
      url: `/v1/rooms/${room.id}/moderators/${moderator.id}`,
      headers: owner.headers,
      payload: {},
    });

    const selfText = "секретный удалённый текст автора";
    const selfMessage = await runtime.app.inject({
      method: "POST",
      url: `/v1/rooms/${room.publicId}/messages`,
      headers: viewer.headers,
      payload: { text: selfText },
    });
    expect(
      Date.parse(selfMessage.json().message.expiresAt as string) -
        Date.parse(selfMessage.json().message.createdAt as string),
    ).toBe(24 * 60 * 60_000);
    const selfDeleted = await runtime.app.inject({
      method: "DELETE",
      url: `/v1/room-messages/${selfMessage.json().message.id as string}`,
      headers: viewer.headers,
    });
    expect(selfDeleted.statusCode).toBe(204);

    const moderatedText = "секретный удалённый текст модератора";
    const moderatedMessage = await runtime.app.inject({
      method: "POST",
      url: `/v1/rooms/${room.publicId}/messages`,
      headers: viewer.headers,
      payload: { text: moderatedText },
    });
    const moderatorDeleted = await runtime.app.inject({
      method: "DELETE",
      url: `/v1/room-messages/${moderatedMessage.json().message.id as string}`,
      headers: moderator.headers,
    });
    expect(moderatorDeleted.statusCode).toBe(204);

    const cannotMuteOwner = await runtime.app.inject({
      method: "POST",
      url: `/v1/rooms/${room.id}/chat-restrictions`,
      headers: moderator.headers,
      payload: { userId: owner.id, durationMinutes: 15 },
    });
    expect(cannotMuteOwner.statusCode).toBe(400);
    expect(cannotMuteOwner.json().error.code).toBe("INVALID_ROOM_MEMBER");

    const muted = await runtime.app.inject({
      method: "POST",
      url: `/v1/rooms/${room.id}/chat-restrictions`,
      headers: owner.headers,
      payload: { userId: viewer.id, durationMinutes: 15, reason: "Флуд" },
    });
    expect(muted.json()).toMatchObject({ muted: true, reason: "Флуд", mutedByRole: "OWNER" });

    const audit = await runtime.app.inject({
      method: "GET",
      url: `/v1/rooms/${room.id}/moderation-audit`,
      headers: { cookie: owner.cookie },
    });
    expect(audit.statusCode, audit.body).toBe(200);
    expect(audit.json().entries.map((entry: { action: string }) => entry.action)).toEqual(
      expect.arrayContaining(["SELF_DELETE_MESSAGE", "MODERATOR_DELETE_MESSAGE", "MUTE_MEMBER"]),
    );
    expect(audit.body).not.toContain(selfText);
    expect(audit.body).not.toContain(moderatedText);

    const report = await runtime.app.inject({
      method: "POST",
      url: `/v1/rooms/${room.publicId}/abuse-reports`,
      headers: viewer.headers,
      payload: { targetUserId: moderator.id, category: "HARASSMENT" },
    });
    expect(report.statusCode, report.body).toBe(201);
    expect(report.body).not.toContain(selfText);

    const blocked = await runtime.app.inject({
      method: "PUT",
      url: `/v1/rooms/${room.id}/blocked-members/${viewer.id}`,
      headers: owner.headers,
      payload: { reason: "Нарушение правил" },
    });
    expect(blocked.statusCode).toBe(204);
    const deniedAfterBlock = await runtime.app.inject({
      method: "GET",
      url: `/v1/rooms/${room.publicId}`,
      headers: { cookie: viewer.cookie },
    });
    expect(deniedAfterBlock.statusCode).toBe(403);
    await runtime.app.inject({
      method: "DELETE",
      url: `/v1/rooms/${room.id}/blocked-members/${viewer.id}`,
      headers: owner.headers,
    });

    const concurrent = await Promise.all(
      Array.from({ length: 80 }, (_, index) =>
        runtime!.app.inject({
          method: "POST",
          url: `/v1/rooms/${room.publicId}/messages`,
          headers: owner.headers,
          payload: { text: `concurrent-${index}` },
        }),
      ),
    );
    expect(concurrent.every((response) => response.statusCode === 201)).toBe(true);
    const bounded = await runtime.app.inject({
      method: "GET",
      url: `/v1/rooms/${room.publicId}/messages`,
      headers: { cookie: owner.cookie },
    });
    expect(bounded.json().messages).toHaveLength(40);

    current = new Date(current.getTime() + 24 * 60 * 60_000 + 1_000);
    const refreshedViewer = await authenticate(runtime, 7103, "viewer-after-ttl", current);
    const expired = await runtime.app.inject({
      method: "GET",
      url: `/v1/rooms/${room.publicId}/messages`,
      headers: { cookie: refreshedViewer.cookie },
    });
    expect(expired.json().messages).toEqual([]);
  });

  it("runs the periodic cleanup job", async () => {
    vi.useFakeTimers();
    const current = new Date();
    const identityStore = new MemoryWatchRoomStore();
    const roomStore = new MemoryRoomStore(identityStore, () => current);
    const cleanup = vi.spyOn(roomStore, "cleanupExpiredMessages");
    runtime = createApi(makeConfig({ CHAT_CLEANUP_INTERVAL_MS: "10000" }), {
      database,
      store: identityStore,
      roomStore,
      now: () => current,
    });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(cleanup).toHaveBeenCalled();
  });
});

describe("verified Telegram discussion binding", () => {
  it("binds only a verified public group with owner admin and bot membership", async () => {
    const current = new Date();
    let requestId = 0;
    let mode: "valid" | "invalid-link" | "not-admin" = "valid";
    const telegramFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const method = String(input).split("/").at(-1);
      const payload = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      let result: unknown;
      if (method === "savePreparedKeyboardButton") {
        const button = payload.button as { request_chat: { request_id: number } };
        requestId = button.request_chat.request_id;
        result = { id: `prepared-${requestId}`, expiration_date: current.getTime() / 1_000 + 600 };
      } else if (method === "getChat") {
        result = {
          id: -1_001_234,
          type: "supergroup",
          username: mode === "invalid-link" ? "evil/name" : "watchroom_discussion",
        };
      } else if (method === "getChatAdministrators") {
        result = mode === "not-admin" ? [] : [{ status: "creator", user: { id: 7201 } }];
      } else if (method === "getMe") result = { id: 999 };
      else if (method === "getChatMember") result = { status: "member" };
      else throw new Error(`Unexpected Telegram method: ${method}`);
      return new Response(JSON.stringify({ ok: true, result }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    runtime = createApi(makeConfig(), {
      database,
      store: new MemoryWatchRoomStore(),
      now: () => current,
      telegramFetch,
    });
    const owner = await authenticate(runtime, 7201, "binding-owner", current);
    const room = await createRoom(runtime, owner.headers);

    const requestBinding = async () => {
      const response = await runtime!.app.inject({
        method: "POST",
        url: `/v1/rooms/${room.id}/telegram-chat/request`,
        headers: owner.headers,
        payload: {},
      });
      expect(response.statusCode, response.body).toBe(201);
      return response.json() as { requestToken: string };
    };
    const deliver = async () =>
      runtime!.app.inject({
        method: "POST",
        url: "/v1/telegram/webhook",
        headers: { "x-telegram-bot-api-secret-token": webhookSecret },
        payload: {
          message: {
            from: { id: 7201 },
            chat_shared: { request_id: requestId, chat_id: -1_001_234 },
          },
        },
      });
    const status = async (token: string) =>
      runtime!.app.inject({
        method: "GET",
        url: `/v1/rooms/${room.id}/telegram-chat/requests/${token}`,
        headers: { cookie: owner.cookie },
      });

    const valid = await requestBinding();
    await deliver();
    expect((await status(valid.requestToken)).json().status).toBe("BOUND");
    const detail = await runtime.app.inject({
      method: "GET",
      url: `/v1/rooms/${room.publicId}`,
      headers: { cookie: owner.cookie },
    });
    expect(detail.json().room.linkedTelegramChatUrl).toBe("https://t.me/watchroom_discussion");

    mode = "invalid-link";
    const invalid = await requestBinding();
    await deliver();
    expect((await status(invalid.requestToken)).json().status).toBe("FAILED");

    mode = "not-admin";
    const unauthorized = await requestBinding();
    await deliver();
    expect((await status(unauthorized.requestToken)).json().status).toBe("FAILED");

    const preparedCall = telegramFetch.mock.calls.find((call) =>
      String(call[0]).endsWith("/savePreparedKeyboardButton"),
    );
    const preparedPayload = JSON.parse(String(preparedCall?.[1]?.body)) as {
      button: { request_chat: Record<string, unknown> };
    };
    expect(preparedPayload.button.request_chat).toMatchObject({
      chat_is_channel: false,
      chat_has_username: true,
      bot_is_member: true,
    });
  });
});
