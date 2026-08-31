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
  MOCK_TELEGRAM_AUTH: "false",
  TELEGRAM_BOT_TOKEN: botToken,
  TELEGRAM_BOT_USERNAME: "watchroom_bot",
  TELEGRAM_APP_SHORT_NAME: "watchroom",
  SESSION_TTL_SECONDS: "86400",
  CHAT_RATE_LIMIT_PER_MINUTE: "120",
});
const database: DatabaseHealth = {
  ping: vi.fn(async () => undefined),
  close: vi.fn(async () => undefined),
};

function sign(userId: number, nonce: string): string {
  const fields = new URLSearchParams({
    auth_date: String(Math.floor(fixedNow.getTime() / 1_000)),
    query_id: nonce,
    user: JSON.stringify({ id: userId, first_name: `User ${userId}` }),
  });
  const dataCheckString = [...fields.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  fields.set("hash", createHmac("sha256", secret).update(dataCheckString).digest("hex"));
  return fields.toString();
}

function cookieOf(response: { cookies: Array<{ name: string; value: string }> }): string {
  const cookie = response.cookies.find((item) => item.name === "watchroom_session");
  return cookie ? `${cookie.name}=${cookie.value}` : "";
}

let runtime: ApiRuntime | undefined;
afterEach(async () => {
  await runtime?.close();
  runtime = undefined;
  vi.unstubAllGlobals();
});

describe("room access and authorization", () => {
  it("does not publish a source that the provider marks as non-embeddable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              items: [
                {
                  snippet: { title: "Embedding disabled", channelTitle: "Owner" },
                  status: { embeddable: false },
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );
    runtime = createApi(
      { ...config, YOUTUBE_API_KEY: "safe-test-key" },
      {
        database,
        store: new MemoryWatchRoomStore(),
        now: () => fixedNow,
        unlockDelay: async () => undefined,
      },
    );
    const auth = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: sign(500, "non-embeddable-owner") },
    });
    const headers = {
      cookie: cookieOf(auth),
      origin: config.WEB_ORIGIN,
      "x-csrf-token": auth.json().csrfToken as string,
    };
    const channel = await runtime.app.inject({
      method: "POST",
      url: "/v1/channels",
      headers,
      payload: { name: "Embed policy", slug: "embed-policy" },
    });
    const created = await runtime.app.inject({
      method: "POST",
      url: "/v1/rooms",
      headers,
      payload: {
        channelId: channel.json().channel.id,
        name: "Unavailable source",
        visibility: "PUBLIC",
        sourceProvider: "YOUTUBE",
        sourceKind: "VIDEO",
        sourceId: "dQw4w9WgXcQ",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json().room.cachedEmbeddable).toBe(false);

    const publish = await runtime.app.inject({
      method: "PATCH",
      url: `/v1/rooms/${created.json().room.id as string}`,
      headers,
      payload: { status: "WAITING" },
    });
    expect(publish.statusCode).toBe(409);
    expect(publish.json().error.code).toBe("SOURCE_EMBEDDING_DISABLED");
  });

  it("keeps private metadata and password secret, then accepts a limited grant", async () => {
    runtime = createApi(config, {
      database,
      store: new MemoryWatchRoomStore(),
      now: () => fixedNow,
      unlockDelay: async () => undefined,
    });
    const auth = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: sign(501, "room-owner") },
    });
    const sessionHeaders = {
      cookie: cookieOf(auth),
      origin: config.WEB_ORIGIN,
      "x-csrf-token": auth.json().csrfToken as string,
    };
    const channel = await runtime.app.inject({
      method: "POST",
      url: "/v1/channels",
      headers: sessionHeaders,
      payload: { name: "Private channel", slug: "private-room-channel" },
    });
    expect(channel.statusCode, channel.body).toBe(201);
    const password = "secret-room-2026";
    const created = await runtime.app.inject({
      method: "POST",
      url: "/v1/rooms",
      headers: sessionHeaders,
      payload: {
        channelId: channel.json().channel.id,
        name: "Закрытая премьера",
        visibility: "PRIVATE",
        password,
        sourceProvider: "YOUTUBE",
        sourceKind: "VIDEO",
        sourceId: "dQw4w9WgXcQ",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    expect(created.body).not.toContain(password);
    expect(created.body).not.toContain("passwordHash");
    const publicId = created.json().room.publicId as string;
    const opened = await runtime.app.inject({
      method: "PATCH",
      url: `/v1/rooms/${created.json().room.id as string}`,
      headers: sessionHeaders,
      payload: { status: "WAITING" },
    });
    expect(opened.statusCode, opened.body).toBe(200);

    const anonymous = await runtime.app.inject({ method: "GET", url: `/v1/rooms/${publicId}` });
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json().error.code).toBe("AUTH_REQUIRED");
    expect(anonymous.body).not.toContain("Закрытая премьера");

    const viewerAuth = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: sign(502, "private-viewer") },
    });
    const viewerHeaders = {
      cookie: cookieOf(viewerAuth),
      origin: config.WEB_ORIGIN,
      "x-csrf-token": viewerAuth.json().csrfToken as string,
    };

    const preview = await runtime.app.inject({
      method: "GET",
      url: `/v1/rooms/${publicId}/preview`,
      headers: { cookie: cookieOf(viewerAuth) },
    });
    expect(preview.statusCode, preview.body).toBe(200);
    expect(preview.json().preview).toMatchObject({
      publicId,
      name: "Закрытая премьера",
      visibility: "PRIVATE",
      sourceProvider: "YOUTUBE",
      sourceKind: "VIDEO",
      viewerCount: 0,
      viewerNames: [],
    });
    expect(preview.body).not.toContain("sourceId");
    expect(preview.body).not.toContain("canonicalUrl");
    expect(preview.body).not.toContain("ownerId");

    const wrong = await runtime.app.inject({
      method: "POST",
      url: `/v1/rooms/${publicId}/unlock`,
      headers: viewerHeaders,
      payload: { password: "wrong-password" },
    });
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json().error.code).toBe("ROOM_UNLOCK_FAILED");

    const unlocked = await runtime.app.inject({
      method: "POST",
      url: `/v1/rooms/${publicId}/unlock`,
      headers: viewerHeaders,
      payload: { password },
    });
    expect(unlocked.statusCode, unlocked.body).toBe(200);
    expect(unlocked.json().grantToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(unlocked.body).not.toContain(password);

    const joined = await runtime.app.inject({
      method: "POST",
      url: `/v1/rooms/${publicId}/join`,
      headers: {
        cookie: cookieOf(viewerAuth),
        origin: config.WEB_ORIGIN,
        "x-csrf-token": viewerAuth.json().csrfToken as string,
        "x-room-grant": unlocked.json().grantToken as string,
      },
      payload: {},
    });
    expect(joined.statusCode, joined.body).toBe(200);
    const withGrant = await runtime.app.inject({
      method: "GET",
      url: `/v1/rooms/${publicId}`,
      headers: {
        cookie: cookieOf(viewerAuth),
        "x-room-grant": unlocked.json().grantToken as string,
      },
    });
    expect(withGrant.json().locked).toBe(false);

    const rotated = await runtime.app.inject({
      method: "PATCH",
      url: `/v1/rooms/${created.json().room.id as string}`,
      headers: sessionHeaders,
      payload: { password: "new-secret-room-2026" },
    });
    expect(rotated.statusCode, rotated.body).toBe(200);
    const staleGrant = await runtime.app.inject({
      method: "GET",
      url: `/v1/rooms/${publicId}`,
      headers: {
        cookie: cookieOf(viewerAuth),
        "x-room-grant": unlocked.json().grantToken as string,
      },
    });
    expect(staleGrant.json()).toEqual({ locked: true, publicId, visibility: "PRIVATE" });

    const invite = await runtime.app.inject({
      method: "GET",
      url: `/v1/rooms/${publicId}/invite`,
      headers: { cookie: cookieOf(auth) },
    });
    expect(invite.json()).toEqual({
      canonical: `https://t.me/watchroom_bot/watchroom?startapp=room_${publicId}`,
      compact: `https://t.me/watchroom_bot/watchroom?startapp=room_${publicId}&mode=compact`,
    });
    expect(invite.body).not.toContain(password);
  });

  it("lets EVERYONE control playback but not administrative room settings", async () => {
    let currentNow = fixedNow;
    runtime = createApi(config, {
      database,
      store: new MemoryWatchRoomStore(),
      now: () => currentNow,
      unlockDelay: async () => undefined,
    });
    const ownerAuth = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: sign(601, "owner") },
    });
    const ownerHeaders = {
      cookie: cookieOf(ownerAuth),
      origin: config.WEB_ORIGIN,
      "x-csrf-token": ownerAuth.json().csrfToken as string,
    };
    const channel = await runtime.app.inject({
      method: "POST",
      url: "/v1/channels",
      headers: ownerHeaders,
      payload: { name: "Open channel", slug: "everyone-controls" },
    });
    expect(channel.statusCode, channel.body).toBe(201);
    const created = await runtime.app.inject({
      method: "POST",
      url: "/v1/rooms",
      headers: ownerHeaders,
      payload: {
        channelId: channel.json().channel.id,
        name: "Общий пульт",
        visibility: "PUBLIC",
        controlPolicy: "EVERYONE",
        sourceProvider: "TWITCH",
        sourceKind: "VOD",
        sourceId: "v123456",
        canonicalUrl: "https://www.twitch.tv/videos/123456",
      },
    });
    const room = created.json().room;
    const opened = await runtime.app.inject({
      method: "PATCH",
      url: `/v1/rooms/${room.id}`,
      headers: ownerHeaders,
      payload: { status: "WAITING" },
    });
    expect(opened.statusCode, opened.body).toBe(200);

    const sourceBypass = await runtime.app.inject({
      method: "PATCH",
      url: `/v1/rooms/${room.id}`,
      headers: ownerHeaders,
      payload: {
        sourceProvider: "YOUTUBE",
        sourceKind: "VIDEO",
        sourceId: "dQw4w9WgXcQ",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    });
    expect(sourceBypass.statusCode).toBe(400);
    expect(sourceBypass.json().error.code).toBe("SOURCE_CHANGE_REQUIRES_VERSION");

    for (const url of [
      "/v1/rooms/catalog",
      `/v1/channels/${channel.json().channel.slug as string}`,
      `/v1/channels/${channel.json().channel.id as string}/rooms`,
      `/v1/rooms/${room.publicId}`,
    ]) {
      const anonymous = await runtime.app.inject({ method: "GET", url });
      expect(anonymous.statusCode, url).toBe(401);
      expect(anonymous.json().error.code).toBe("AUTH_REQUIRED");
    }

    const viewerAuth = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: sign(602, "viewer") },
    });
    const viewerHeaders = {
      cookie: cookieOf(viewerAuth),
      origin: config.WEB_ORIGIN,
      "x-csrf-token": viewerAuth.json().csrfToken as string,
    };
    const playbackBeforeJoin = await runtime.app.inject({
      method: "POST",
      url: `/v1/rooms/${room.publicId}/playback`,
      headers: viewerHeaders,
      payload: { action: "play", positionSeconds: 42 },
    });
    expect(playbackBeforeJoin.statusCode).toBe(403);
    expect(playbackBeforeJoin.json().error.code).toBe("ROOM_CONTROL_FORBIDDEN");
    const detailBeforeJoin = await runtime.app.inject({
      method: "GET",
      url: `/v1/rooms/${room.publicId}`,
      headers: { cookie: cookieOf(viewerAuth) },
    });
    expect(detailBeforeJoin.statusCode).toBe(403);
    expect(detailBeforeJoin.json().error.code).toBe("ROOM_JOIN_REQUIRED");
    const previewBeforeJoin = await runtime.app.inject({
      method: "GET",
      url: `/v1/rooms/${room.publicId}/preview`,
      headers: { cookie: cookieOf(viewerAuth) },
    });
    expect(previewBeforeJoin.statusCode).toBe(200);
    expect(previewBeforeJoin.body).not.toContain("ownerId");
    await runtime.app.inject({
      method: "POST",
      url: `/v1/rooms/${room.publicId}/join`,
      headers: viewerHeaders,
      payload: {},
    });
    const playback = await runtime.app.inject({
      method: "POST",
      url: `/v1/rooms/${room.publicId}/playback`,
      headers: viewerHeaders,
      payload: { action: "play", positionSeconds: 42 },
    });
    const expectedVersion = playback.json().room.playback.version as number;
    const racingCommands = await Promise.all([
      runtime.app.inject({
        method: "POST",
        url: `/v1/rooms/${room.publicId}/playback`,
        headers: viewerHeaders,
        payload: { action: "pause", positionSeconds: 43, expectedVersion },
      }),
      runtime.app.inject({
        method: "POST",
        url: `/v1/rooms/${room.publicId}/playback`,
        headers: viewerHeaders,
        payload: { action: "seek", positionSeconds: 50, expectedVersion },
      }),
    ]);
    const administrative = await runtime.app.inject({
      method: "PATCH",
      url: `/v1/rooms/${room.id}`,
      headers: viewerHeaders,
      payload: { status: "ENDED" },
    });
    for (let index = 0; index < 41; index += 1) {
      currentNow = new Date(fixedNow.getTime() + index * 1_000);
      const message = await runtime.app.inject({
        method: "POST",
        url: `/v1/rooms/${room.publicId}/messages`,
        headers: viewerHeaders,
        payload: { text: `Сообщение ${index}` },
      });
      expect(message.statusCode).toBe(201);
    }
    const messages = await runtime.app.inject({
      method: "GET",
      url: `/v1/rooms/${room.publicId}/messages`,
      headers: { cookie: cookieOf(viewerAuth) },
    });
    const muted = await runtime.app.inject({
      method: "POST",
      url: `/v1/rooms/${room.id}/chat-restrictions`,
      headers: ownerHeaders,
      payload: { userId: viewerAuth.json().user.id, durationMinutes: 15 },
    });
    const afterMute = await runtime.app.inject({
      method: "POST",
      url: `/v1/rooms/${room.publicId}/messages`,
      headers: viewerHeaders,
      payload: { text: "Не должно пройти" },
    });
    expect(playback.statusCode, playback.body).toBe(200);
    expect(playback.json().room.playback).toMatchObject({ paused: false, positionSeconds: 0 });
    expect(racingCommands.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    expect(racingCommands.find((response) => response.statusCode === 409)?.json().error.code).toBe(
      "STALE_PLAYBACK_VERSION",
    );
    expect(administrative.statusCode).toBe(403);
    expect(administrative.json().error.code).toBe("ROOM_FORBIDDEN");
    expect(messages.json().messages).toHaveLength(40);
    expect(messages.body).not.toContain("Сообщение 0");
    expect(messages.body).toContain("Сообщение 40");
    expect(
      new Set(messages.json().messages.map((message: { text: string }) => message.text)).size,
    ).toBe(40);
    expect(messages.json().messages.map((message: { text: string }) => message.text)).toEqual(
      Array.from({ length: 40 }, (_, index) => `Сообщение ${index + 1}`),
    );
    expect(muted.statusCode).toBe(201);
    expect(afterMute.statusCode).toBe(403);
    expect(afterMute.json().error.code).toBe("ROOM_CHAT_MUTED");

    const activated = await runtime.app.inject({
      method: "PATCH",
      url: `/v1/rooms/${room.id}`,
      headers: ownerHeaders,
      payload: { status: "WAITING" },
    });
    expect(activated.statusCode).toBe(200);
    const channelDeletion = await runtime.app.inject({
      method: "DELETE",
      url: `/v1/channels/${channel.json().channel.id as string}`,
      headers: ownerHeaders,
    });
    expect(channelDeletion.statusCode).toBe(409);
    expect(channelDeletion.json().error.code).toBe("CHANNEL_HAS_ACTIVE_ROOMS");

    const extraRooms = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        runtime!.app.inject({
          method: "POST",
          url: "/v1/rooms",
          headers: ownerHeaders,
          payload: {
            channelId: channel.json().channel.id,
            name: `Лимит ${index}`,
            sourceProvider: "YOUTUBE",
            sourceKind: "VIDEO",
            sourceId: "dQw4w9WgXcQ",
            canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
        }),
      ),
    );
    expect(extraRooms.at(-1)?.statusCode).toBe(429);
    expect(extraRooms.at(-1)?.json().error.code).toBe("ROOM_CREATE_RATE_LIMITED");

    const ended = await runtime.app.inject({
      method: "PATCH",
      url: `/v1/rooms/${room.id}`,
      headers: ownerHeaders,
      payload: { status: "ENDED" },
    });
    expect(ended.statusCode).toBe(200);
    expect(ended.json().room.status).toBe("ENDED");
    const resurrected = await runtime.app.inject({
      method: "PATCH",
      url: `/v1/rooms/${room.id}`,
      headers: ownerHeaders,
      payload: { status: "WAITING" },
    });
    expect(resurrected.statusCode).toBe(409);
    expect(resurrected.json().error.code).toBe("INVALID_ROOM_STATUS_TRANSITION");
    const playbackAfterEnd = await runtime.app.inject({
      method: "POST",
      url: `/v1/rooms/${room.publicId}/playback`,
      headers: viewerHeaders,
      payload: { action: "play", positionSeconds: 0 },
    });
    expect(playbackAfterEnd.statusCode).toBe(409);
    expect(playbackAfterEnd.json().error.code).toBe("ROOM_ENDED");
    const chatAfterEnd = await runtime.app.inject({
      method: "POST",
      url: `/v1/rooms/${room.publicId}/messages`,
      headers: viewerHeaders,
      payload: { text: "Позднее сообщение" },
    });
    expect(chatAfterEnd.statusCode).toBe(409);
    expect(chatAfterEnd.json().error.code).toBe("ROOM_ENDED");
  });
});
