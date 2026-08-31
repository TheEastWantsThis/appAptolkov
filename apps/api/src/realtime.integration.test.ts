import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";
import { io as createClient, type Socket } from "socket.io-client";

import { createApi, type ApiRuntime } from "./app.js";
import { loadApiConfig } from "./config.js";
import type { DatabaseHealth } from "./database.js";
import { MemoryWatchRoomStore } from "./store.js";

const botToken = "123456789:abcdefghijklmnopqrstuvwxyzABCDEFG";
const config = loadApiConfig({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://watchroom:watchroom@localhost:5432/watchroom_test",
  WEB_ORIGIN: "http://localhost:3000",
  LOG_LEVEL: "silent",
  MOCK_TELEGRAM_AUTH: "false",
  TELEGRAM_BOT_TOKEN: botToken,
  REALTIME_PRESENCE_GRACE_MS: "1000",
});
const database: DatabaseHealth = {
  ping: vi.fn(async () => undefined),
  close: vi.fn(async () => undefined),
};

function sign(userId: number): string {
  const fields = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1_000)),
    query_id: `realtime-${userId}-${crypto.randomUUID()}`,
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

async function connected(url: string, cookie: string): Promise<Socket> {
  const socket = createClient(url, {
    extraHeaders: { cookie, origin: config.WEB_ORIGIN },
    forceNew: true,
    reconnection: false,
    transports: ["websocket"],
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return socket;
}

async function emitAck(
  socket: Socket,
  event: string,
  payload: unknown,
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

let runtime: ApiRuntime | undefined;
const clients: Socket[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await runtime?.close();
  runtime = undefined;
});

describe("Socket.IO realtime integration", () => {
  it("rejects a WebSocket handshake from an untrusted Origin", async () => {
    runtime = createApi(config, { database, store: new MemoryWatchRoomStore() });
    const auth = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: sign(700) },
    });
    await runtime.app.listen({ host: "127.0.0.1", port: 0 });
    const address = runtime.app.server.address();
    if (!address || typeof address === "string") throw new Error("TEST_SERVER_ADDRESS_MISSING");
    const socket = createClient(`http://127.0.0.1:${address.port}`, {
      extraHeaders: { cookie: cookieOf(auth), origin: "https://attacker.example" },
      forceNew: true,
      reconnection: false,
      transports: ["websocket"],
    });
    clients.push(socket);
    const error = await new Promise<Error>((resolve) => socket.once("connect_error", resolve));
    expect(error).toBeInstanceOf(Error);
    expect(socket.connected).toBe(false);
  });

  it("rejects a private join without a grant and accepts reconnect with the grant", async () => {
    runtime = createApi(config, { database, store: new MemoryWatchRoomStore() });
    const ownerAuth = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: sign(701) },
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
      payload: { name: "Realtime", slug: "realtime-private" },
    });
    const created = await runtime.app.inject({
      method: "POST",
      url: "/v1/rooms",
      headers: ownerHeaders,
      payload: {
        channelId: channel.json().channel.id,
        name: "Private realtime",
        visibility: "PRIVATE",
        password: "private-realtime-2026",
        sourceProvider: "YOUTUBE",
        sourceKind: "VIDEO",
        sourceId: "dQw4w9WgXcQ",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    });
    const viewerAuth = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: sign(702) },
    });
    const viewerHeaders = {
      cookie: cookieOf(viewerAuth),
      origin: config.WEB_ORIGIN,
      "x-csrf-token": viewerAuth.json().csrfToken as string,
    };
    await runtime.app.listen({ host: "127.0.0.1", port: 0 });
    const address = runtime.app.server.address();
    if (!address || typeof address === "string") throw new Error("TEST_SERVER_ADDRESS_MISSING");
    const socket = await connected(`http://127.0.0.1:${address.port}`, cookieOf(viewerAuth));
    clients.push(socket);
    const publicId = created.json().room.publicId as string;
    expect(await emitAck(socket, "room:join", { publicId, grantToken: null })).toMatchObject({
      ok: false,
    });
    const unlocked = await runtime.app.inject({
      method: "POST",
      url: `/v1/rooms/${publicId}/unlock`,
      headers: viewerHeaders,
      payload: { password: "private-realtime-2026" },
    });
    expect(
      await emitAck(socket, "room:join", { publicId, grantToken: unlocked.json().grantToken }),
    ).toMatchObject({ ok: true, viewerCount: 1 });
    socket.disconnect();
    const reconnected = await connected(`http://127.0.0.1:${address.port}`, cookieOf(viewerAuth));
    clients.push(reconnected);
    expect(
      await emitAck(reconnected, "room:join", { publicId, grantToken: unlocked.json().grantToken }),
    ).toMatchObject({ ok: true, viewerCount: 1 });
  });

  it("accepts 100 simultaneous socket connections without video traffic", async () => {
    runtime = createApi(config, { database, store: new MemoryWatchRoomStore() });
    const auth = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: sign(801) },
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
      payload: { name: "Load", slug: "load-room" },
    });
    const created = await runtime.app.inject({
      method: "POST",
      url: "/v1/rooms",
      headers,
      payload: {
        channelId: channel.json().channel.id,
        name: "Socket load",
        sourceProvider: "YOUTUBE",
        sourceKind: "VIDEO",
        sourceId: "dQw4w9WgXcQ",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    });
    await runtime.app.listen({ host: "127.0.0.1", port: 0 });
    const address = runtime.app.server.address();
    if (!address || typeof address === "string") throw new Error("TEST_SERVER_ADDRESS_MISSING");
    const startedAt = performance.now();
    const batch = await Promise.all(
      Array.from({ length: 100 }, () =>
        connected(`http://127.0.0.1:${address.port}`, cookieOf(auth)),
      ),
    );
    clients.push(...batch);
    const acknowledgements = await Promise.all(
      batch.map((socket) =>
        emitAck(socket, "room:join", { publicId: created.json().room.publicId, grantToken: null }),
      ),
    );
    const elapsedMs = performance.now() - startedAt;
    process.stdout.write(
      `[load-smoke] 100 Socket.IO connections joined in ${elapsedMs.toFixed(1)} ms (informational, no machine-specific threshold)\n`,
    );
    expect(acknowledgements).toHaveLength(100);
    expect(acknowledgements.every((value) => value.ok === true && value.viewerCount === 1)).toBe(
      true,
    );
    expect(elapsedMs).toBeGreaterThanOrEqual(0);
  }, 30_000);
});
