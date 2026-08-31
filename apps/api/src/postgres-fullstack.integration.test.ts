import { createHmac, randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { io as createClient, type Socket } from "socket.io-client";

import { createApi, type ApiRuntime } from "./app.js";
import { loadApiConfig } from "./config.js";
import { createPostgresDatabase, type DatabaseRuntime } from "./database.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const postgresDescribe = testDatabaseUrl ? describe : describe.skip;
const botToken = "123456789:abcdefghijklmnopqrstuvwxyzABCDEFG";
const webOrigin = "http://localhost:3000";

function sign(userId: number, username: string): string {
  const fields = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1_000)),
    query_id: `postgres-${userId}-${randomUUID()}`,
    user: JSON.stringify({ id: userId, first_name: `User ${userId}`, username }),
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
  if (!cookie) throw new Error("TEST_SESSION_COOKIE_MISSING");
  return `${cookie.name}=${cookie.value}`;
}

async function connected(url: string, cookie: string): Promise<Socket> {
  const socket = createClient(url, {
    extraHeaders: { cookie, origin: webOrigin },
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

async function emitAck(socket: Socket, event: string, payload: unknown) {
  return new Promise<Record<string, unknown>>((resolve) => socket.emit(event, payload, resolve));
}

async function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise<T>((resolve) => socket.once(event, resolve));
}

let runtime: ApiRuntime | undefined;
let database: DatabaseRuntime | undefined;
const clients: Socket[] = [];

beforeEach(async () => {
  if (!testDatabaseUrl) return;
  if (!new URL(testDatabaseUrl).pathname.toLowerCase().includes("test"))
    throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'");
  database = createPostgresDatabase(testDatabaseUrl);
  await database.prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AbuseReport", "RoomUserBlock", "TelegramChatBindingRequest",
      "RoomModerationAudit", "RoomChatRestriction", "RoomMessage",
      "RoomAccessGrant", "RoomMember", "Room", "ChannelMember",
      "Channel", "Session", "AuthReplay", "User"
    RESTART IDENTITY CASCADE
  `);
  const config = loadApiConfig({
    NODE_ENV: "test",
    DATABASE_URL: testDatabaseUrl,
    WEB_ORIGIN: webOrigin,
    LOG_LEVEL: "silent",
    TELEGRAM_BOT_TOKEN: botToken,
    OPERATIONS_BEARER_TOKEN: "o".repeat(32),
    CHAT_RATE_LIMIT_PER_MINUTE: "120",
    CREATE_ROOM_RATE_LIMIT_PER_HOUR: "20",
    REALTIME_PRESENCE_GRACE_MS: "0",
  });
  runtime = createApi(config, { database });
});

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await runtime?.close();
  runtime = undefined;
  database = undefined;
});

postgresDescribe("PostgreSQL + API + Socket.IO release gate", () => {
  it("runs public/private journeys, authoritative sync and concurrent chat retention", async () => {
    if (!runtime || !database) throw new Error("POSTGRES_TEST_RUNTIME_MISSING");
    const ownerAuth = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: webOrigin },
      payload: { initData: sign(9101, "postgres_owner") },
    });
    const viewerAuth = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: webOrigin },
      payload: { initData: sign(9102, "postgres_viewer") },
    });
    const ownerHeaders = {
      cookie: cookieOf(ownerAuth),
      origin: webOrigin,
      "x-csrf-token": ownerAuth.json().csrfToken as string,
    };
    const viewerHeaders = {
      cookie: cookieOf(viewerAuth),
      origin: webOrigin,
      "x-csrf-token": viewerAuth.json().csrfToken as string,
    };
    const channel = await runtime.app.inject({
      method: "POST",
      url: "/v1/channels",
      headers: ownerHeaders,
      payload: { name: "PostgreSQL channel", slug: "postgres-channel" },
    });
    const created = await runtime.app.inject({
      method: "POST",
      url: "/v1/rooms",
      headers: ownerHeaders,
      payload: {
        channelId: channel.json().channel.id,
        name: "Real public room",
        visibility: "PUBLIC",
        controlPolicy: "OWNER_ONLY",
        sourceProvider: "YOUTUBE",
        sourceKind: "VIDEO",
        sourceId: "dQw4w9WgXcQ",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    });
    const room = created.json().room;
    await runtime.app.inject({
      method: "PATCH",
      url: `/v1/rooms/${room.id as string}`,
      headers: ownerHeaders,
      payload: { status: "WAITING" },
    });

    await runtime.app.listen({ host: "127.0.0.1", port: 0 });
    const address = runtime.app.server.address();
    if (!address || typeof address === "string") throw new Error("TEST_SERVER_ADDRESS_MISSING");
    const url = `http://127.0.0.1:${address.port}`;
    const ownerSocket = await connected(url, cookieOf(ownerAuth));
    const viewerSocket = await connected(url, cookieOf(viewerAuth));
    clients.push(ownerSocket, viewerSocket);
    expect(
      await emitAck(ownerSocket, "room:join", { publicId: room.publicId, grantToken: null }),
    ).toMatchObject({ ok: true });
    expect(
      await emitAck(viewerSocket, "room:join", { publicId: room.publicId, grantToken: null }),
    ).toMatchObject({ ok: true, viewerCount: 2 });

    const denied = once<{ code: string }>(viewerSocket, "playback:denied");
    viewerSocket.emit("playback:play", {
      publicId: room.publicId,
      commandId: randomUUID(),
      expectedVersion: 0,
      positionSeconds: 0,
    });
    expect(await denied).toMatchObject({ code: "ROOM_CONTROL_FORBIDDEN" });

    const ownerCommand = once<{ playback: { version: number; state: string } }>(
      ownerSocket,
      "playback:command",
    );
    const viewerCommand = once<{ playback: { version: number; state: string } }>(
      viewerSocket,
      "playback:command",
    );
    ownerSocket.emit("playback:play", {
      publicId: room.publicId,
      commandId: randomUUID(),
      expectedVersion: 0,
      positionSeconds: 7,
    });
    expect(await ownerCommand).toMatchObject({ playback: { version: 1, state: "PLAYING" } });
    expect(await viewerCommand).toMatchObject({ playback: { version: 1, state: "PLAYING" } });

    const writes = await Promise.all(
      Array.from({ length: 45 }, (_, index) =>
        runtime!.app.inject({
          method: "POST",
          url: `/v1/rooms/${room.publicId as string}/messages`,
          headers: viewerHeaders,
          payload: { text: `Postgres concurrent ${index}` },
        }),
      ),
    );
    expect(writes.every((response) => response.statusCode === 201)).toBe(true);
    expect(await database.prisma.roomMessage.count({ where: { roomId: room.id } })).toBe(40);

    const submittedReport = await runtime.app.inject({
      method: "POST",
      url: `/v1/rooms/${room.publicId as string}/abuse-reports`,
      headers: viewerHeaders,
      payload: { category: "OTHER", details: "Release-gate report" },
    });
    expect(submittedReport.statusCode, submittedReport.body).toBe(201);
    const reportId = submittedReport.json().report.id as string;
    const reports = await runtime.app.inject({
      method: "GET",
      url: "/internal/abuse-reports",
      headers: { authorization: `Bearer ${"o".repeat(32)}` },
    });
    expect(reports.statusCode, reports.body).toBe(200);
    expect(reports.json().reports).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: reportId, status: "OPEN" })]),
    );
    const reviewed = await runtime.app.inject({
      method: "PATCH",
      url: `/internal/abuse-reports/${reportId}`,
      headers: {
        authorization: `Bearer ${"o".repeat(32)}`,
        "content-type": "application/json",
      },
      payload: { status: "RESOLVED", resolution: "Reviewed in release gate" },
    });
    expect(reviewed.statusCode, reviewed.body).toBe(200);
    expect(reviewed.json().report).toMatchObject({ id: reportId, status: "RESOLVED" });

    const privateRoom = await runtime.app.inject({
      method: "POST",
      url: "/v1/rooms",
      headers: ownerHeaders,
      payload: {
        channelId: channel.json().channel.id,
        name: "Real private room",
        visibility: "PRIVATE",
        password: "postgres-private-2026",
        sourceProvider: "TWITCH",
        sourceKind: "VOD",
        sourceId: "123456",
        canonicalUrl: "https://www.twitch.tv/videos/123456",
      },
    });
    const privatePublicId = privateRoom.json().room.publicId as string;
    expect(
      await emitAck(viewerSocket, "room:join", { publicId: privatePublicId, grantToken: null }),
    ).toMatchObject({ ok: false });
    const unlocked = await runtime.app.inject({
      method: "POST",
      url: `/v1/rooms/${privatePublicId}/unlock`,
      headers: viewerHeaders,
      payload: { password: "postgres-private-2026" },
    });
    expect(unlocked.statusCode, unlocked.body).toBe(200);
    expect(
      await emitAck(viewerSocket, "room:join", {
        publicId: privatePublicId,
        grantToken: unlocked.json().grantToken,
      }),
    ).toMatchObject({ ok: true });
  }, 30_000);
});
