import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import {
  AddChannelMemberSchema,
  CreateRoomSchema,
  AbuseReportSchema,
  BlockRoomMemberSchema,
  CreateChannelSchema,
  CreateRoomMessageSchema,
  ChatDeleteEventSchema,
  ChatMuteMemberEventSchema,
  ChatSendEventSchema,
  HeartbeatEventSchema,
  MuteRoomMemberSchema,
  PlaybackChangeSourceEventSchema,
  PlaybackCommandSchema,
  PlaybackPauseEventSchema,
  PlaybackPlayEventSchema,
  PlaybackSeekEventSchema,
  ReactionSendEventSchema,
  RoomJoinEventSchema,
  RoomLeaveEventSchema,
  TelegramAuthRequestSchema,
  UnlockRoomSchema,
  UpdateRoomSchema,
  UpdateChannelMemberSchema,
  UpdateChannelSchema,
  createTelegramRoomLinks,
  normalizePlayerSource,
  ParseSourceRequestSchema,
  parsePlayerSource,
  SourceParseError,
  type UserDto,
  type RoomDto,
  type RoomPreviewDto,
  type RoomSystemEvent,
} from "@watchroom/shared";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { Server as SocketIoServer } from "socket.io";
import { z, ZodError } from "zod";

import { validateTelegramInitData, type ValidatedTelegramIdentity } from "./auth/telegram.js";
import { sessionCookieOptions } from "./auth/session-cookie.js";
import type { ApiConfig } from "./config.js";
import { createPostgresDatabase, type DatabaseHealth, type DatabaseRuntime } from "./database.js";
import { AppError } from "./errors.js";
import { createLoggerOptions } from "./logger.js";
import { MemoryRoomStore, PrismaRoomStore, type RoomStore } from "./room-store.js";
import { ProviderMetadataService } from "./providers/metadata.js";
import { PresenceRegistry } from "./realtime/presence.js";
import { hashRoomPassword, roomPasswordNeedsRehash, verifyRoomPassword } from "./rooms/password.js";
import { RoomUnlockGuard } from "./rooms/unlock-guard.js";
import { PrismaWatchRoomStore, type WatchRoomStore } from "./store.js";

const serviceVersion = "0.1.0";
const sessionCookie = "watchroom_session";
const fallbackRoomPasswordHash = hashRoomPassword(
  `invalid-room-${randomBytes(24).toString("base64url")}`,
);

interface ApiOverrides {
  database?: DatabaseHealth;
  store?: WatchRoomStore;
  roomStore?: RoomStore;
  now?: () => Date;
  unlockDelay?: (milliseconds: number) => Promise<void>;
  telegramFetch?: typeof fetch;
}
export interface ApiRuntime {
  app: FastifyInstance;
  close(): Promise<void>;
  setDraining(): void;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function equalSecret(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function healthResponse(
  status: "ok" | "degraded",
  checks: Array<{ name: string; status: "ok" | "error" }>,
) {
  return {
    status,
    service: "watchroom-api",
    version: serviceVersion,
    timestamp: new Date().toISOString(),
    checks,
  };
}

export function createApi(config: ApiConfig, overrides: ApiOverrides = {}): ApiRuntime {
  const app = Fastify({
    bodyLimit: config.HTTP_BODY_LIMIT_BYTES,
    genReqId: () => randomUUID(),
    logger: createLoggerOptions(config),
    trustProxy: config.NODE_ENV === "production",
  });
  const database = overrides.database ?? createPostgresDatabase(config.DATABASE_URL);
  const databaseRuntime = database as Partial<DatabaseRuntime>;
  const store =
    overrides.store ??
    (databaseRuntime.prisma ? new PrismaWatchRoomStore(databaseRuntime.prisma) : undefined);
  if (!store)
    throw new Error("A store override is required when the database has no Prisma client");
  const watchStore: WatchRoomStore = store;
  const now = overrides.now ?? (() => new Date());
  const roomStore =
    overrides.roomStore ??
    (databaseRuntime.prisma
      ? new PrismaRoomStore(databaseRuntime.prisma, watchStore, now)
      : new MemoryRoomStore(watchStore, now));
  const unlockGuard = new RoomUnlockGuard(now, overrides.unlockDelay);
  const metadataService = new ProviderMetadataService(config);
  const telegramFetch = overrides.telegramFetch ?? fetch;
  let draining = false;
  let closed = false;
  const authAttempts = new Map<string, { count: number; resetAt: number }>();
  const chatAttempts = new Map<string, { count: number; resetAt: number }>();
  const metadataAttempts = new Map<string, { count: number; resetAt: number }>();
  const roomCreateAttempts = new Map<string, { count: number; resetAt: number }>();
  const sourceChangeAttempts = new Map<string, { count: number; resetAt: number }>();
  const reportAttempts = new Map<string, { count: number; resetAt: number }>();
  const telemetryAttempts = new Map<string, { count: number; resetAt: number }>();
  const metrics = {
    connectedSockets: 0,
    activeRooms: new Set<string>(),
    errors: 0,
    playerErrors: 0,
    reconnects: 0,
    autoplayBlocked: 0,
  };

  const allowRate = (
    buckets: Map<string, { count: number; resetAt: number }>,
    key: string,
    limit: number,
    windowMs: number,
    code: string,
    message: string,
  ): void => {
    const timestamp = now().getTime();
    if (buckets.size > 5_000)
      for (const [bucketKey, value] of buckets)
        if (value.resetAt <= timestamp) buckets.delete(bucketKey);
    const previous = buckets.get(key);
    const bucket =
      !previous || previous.resetAt <= timestamp
        ? { count: 0, resetAt: timestamp + windowMs }
        : previous;
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > limit)
      throw new AppError(429, code, message, { retryAfterMs: bucket.resetAt - timestamp });
  };

  void app.register(cors, {
    origin: config.WEB_ORIGIN,
    credentials: true,
    allowedHeaders: ["content-type", "x-csrf-token", "x-room-grant"],
  });
  void app.register(cookie);
  const io = new SocketIoServer(app.server, {
    cors: { origin: config.WEB_ORIGIN, credentials: true },
    allowRequest: (request, callback) =>
      callback(null, request.headers.origin === config.WEB_ORIGIN),
    maxHttpBufferSize: 16 * 1024,
    serveClient: false,
    transports: ["websocket", "polling"],
  });
  function broadcastPresence(roomId: string): void {
    const snapshot = presence.snapshot(roomId);
    if (snapshot.viewerCount > 0) metrics.activeRooms.add(roomId);
    else metrics.activeRooms.delete(roomId);
    io.to(`room:${roomId}`).emit("room:presence", snapshot);
  }
  const presence = new PresenceRegistry(
    config.REALTIME_HEARTBEAT_TIMEOUT_MS,
    config.REALTIME_PRESENCE_GRACE_MS,
    () => now().getTime(),
    broadcastPresence,
  );
  const countPresence = (roomId: string): number => presence.snapshot(roomId).viewerCount;
  const realtimeAttempts = new Map<string, { count: number; resetAt: number }>();
  const commandIds = new Map<string, number>();
  const allowRealtime = (key: string, limit: number): void => {
    const timestamp = now().getTime();
    const current = realtimeAttempts.get(key);
    const bucket =
      !current || current.resetAt <= timestamp
        ? { count: 0, resetAt: timestamp + 60_000 }
        : current;
    bucket.count += 1;
    realtimeAttempts.set(key, bucket);
    if (bucket.count > limit)
      throw new AppError(429, "REALTIME_RATE_LIMITED", "Слишком много команд. Подождите минуту.");
  };
  const rememberCommand = (userId: string, commandId: string): void => {
    const timestamp = now().getTime();
    const key = `${userId}:${commandId}`;
    if ((commandIds.get(key) ?? 0) > timestamp)
      throw new AppError(409, "DUPLICATE_COMMAND", "Команда уже обработана.");
    commandIds.set(key, timestamp + 60_000);
    if (commandIds.size > 5_000)
      for (const [id, expiresAt] of commandIds) if (expiresAt <= timestamp) commandIds.delete(id);
  };
  const playbackSnapshot = (room: RoomDto) => ({
    sourceProvider: room.sourceProvider,
    sourceKind: room.sourceKind,
    sourceId: room.sourceId,
    state: room.playback.state,
    positionSeconds: room.playback.positionSeconds,
    changedAtServerMs: room.playback.changedAtServerMs,
    playbackRate: 1 as const,
    version: room.playback.version,
    actorUserId: room.playback.actorUserId,
    liveEdge: room.playback.liveEdge,
  });
  const emitSystemEvent = (
    roomId: string,
    kind: RoomSystemEvent["kind"],
    actorUserId: string,
  ): void => {
    const createdAtServerMs = now().getTime();
    io.to(`room:${roomId}`).emit("system:event", {
      id: randomUUID(),
      kind,
      actorUserId,
      createdAtServerMs,
      expiresAtServerMs: createdAtServerMs + 10 * 60_000,
    } satisfies RoomSystemEvent);
  };
  io.use(async (socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie ?? "";
    const socketAccessToken = socket.handshake.auth?.accessToken;
    const token =
      (typeof socketAccessToken === "string" && socketAccessToken.length <= 256
        ? socketAccessToken
        : null) ??
      cookieHeader
        .split("; ")
        .find((part) => part.startsWith(`${sessionCookie}=`))
        ?.slice(sessionCookie.length + 1);
    const session = token ? await watchStore.findSession(sha256(token)) : null;
    if (!session) return next(new Error("AUTH_REQUIRED"));
    socket.data.userId = session.user.id;
    socket.data.sessionTokenHash = sha256(token ?? "");
    socket.data.rooms = new Map<string, { roomId: string; grantHash: string | null }>();
    return next();
  });
  io.on("connection", (socket) => {
    if (draining) {
      socket.disconnect(true);
      return;
    }
    metrics.connectedSockets += 1;
    const userId = socket.data.userId as string;
    const rooms = socket.data.rooms as Map<string, { roomId: string; grantHash: string | null }>;
    const requireAccess = async (publicId: string) => {
      const session = await watchStore.findSession(socket.data.sessionTokenHash as string);
      if (!session || session.user.id !== userId)
        throw new AppError(401, "AUTH_REQUIRED", "Сессия истекла.");
      const joined = rooms.get(publicId);
      if (!joined) throw new AppError(403, "ROOM_NOT_JOINED", "Сначала войдите в комнату.");
      const detail = await roomStore.getDetail(publicId, userId, joined.grantHash);
      if (!detail || detail.locked || detail.room.id !== joined.roomId)
        throw new AppError(403, "ROOM_ACCESS_DENIED", "Комната недоступна.");
      return { joined, room: detail.room };
    };
    const deny = async (
      event: "playback:denied" | "chat:denied" | "error",
      error: unknown,
      publicId?: string,
    ) => {
      const appError = error instanceof AppError ? error : null;
      let currentVersion: number | undefined;
      if (appError?.code === "STALE_PLAYBACK_VERSION" && publicId) {
        const detail = await roomStore.getDetail(
          publicId,
          userId,
          rooms.get(publicId)?.grantHash ?? null,
        );
        if (detail && !detail.locked) currentVersion = detail.room.playback.version;
      }
      socket.emit(event, {
        code: appError?.code ?? (error instanceof ZodError ? "VALIDATION_ERROR" : "REALTIME_ERROR"),
        message:
          appError?.message ??
          (error instanceof ZodError ? "Проверьте данные команды." : "Команда не выполнена."),
        ...(currentVersion === undefined ? {} : { currentVersion }),
        ...(appError?.details ?? {}),
      });
    };
    socket.emit("system:ready", { protocolVersion: 2, heartbeatIntervalMs: 15_000 });
    socket.on("room:join", async (payload: unknown, callback?: (value: unknown) => void) => {
      try {
        const { publicId, grantToken } = RoomJoinEventSchema.parse(payload);
        allowRealtime(`${userId}:room:join`, 120);
        const session = await watchStore.findSession(socket.data.sessionTokenHash as string);
        if (!session) throw new AppError(401, "AUTH_REQUIRED", "Сессия истекла.");
        const grantHash = grantToken ? sha256(grantToken) : null;
        const detail = await roomStore.getDetail(publicId, userId, grantHash);
        if (!detail || detail.locked)
          throw new AppError(403, "ROOM_ACCESS_DENIED", "Комната недоступна.");
        const joinedRoom = await roomStore.joinRoom(publicId, userId, grantHash);
        const alreadyPresent = presence.snapshot(detail.room.id).userIds.includes(userId);
        if (!rooms.has(publicId)) {
          rooms.set(publicId, { roomId: detail.room.id, grantHash });
          presence.connect(detail.room.id, userId, socket.id);
          await socket.join(`room:${detail.room.id}`);
        }
        const room = { ...joinedRoom, viewerCount: countPresence(detail.room.id) };
        const messages = await roomStore.listMessages(publicId, userId, grantHash);
        const chatRestriction = await roomStore.getActiveChatRestriction(
          publicId,
          userId,
          grantHash,
        );
        socket.emit("room:snapshot", {
          serverNowMs: now().getTime(),
          room,
          playback: playbackSnapshot(room),
          messages,
          chatRestriction,
        });
        socket.emit("chat:snapshot", { messages, chatRestriction });
        if (!alreadyPresent) emitSystemEvent(detail.room.id, "MEMBER_JOINED", userId);
        broadcastPresence(detail.room.id);
        callback?.({ ok: true, viewerCount: room.viewerCount });
      } catch (error: unknown) {
        await deny("error", error);
        callback?.({
          ok: false,
          error: error instanceof AppError ? error.code : "ROOM_ACCESS_DENIED",
        });
      }
    });
    socket.on("room:leave", async (payload: unknown) => {
      try {
        const { publicId } = RoomLeaveEventSchema.parse(payload);
        allowRealtime(`${socket.id}:room:leave`, 30);
        await requireAccess(publicId);
        const joined = rooms.get(publicId);
        if (!joined) return;
        rooms.delete(publicId);
        presence.disconnect(joined.roomId, userId, socket.id, true);
        await socket.leave(`room:${joined.roomId}`);
        broadcastPresence(joined.roomId);
      } catch (error: unknown) {
        await deny("error", error);
      }
    });
    const playbackHandler =
      (action: "play" | "pause" | "seek", schema: typeof PlaybackPlayEventSchema) =>
      async (payload: unknown) => {
        let publicId: string | undefined;
        try {
          const command = schema.parse(payload);
          publicId = command.publicId;
          allowRealtime(`${userId}:playback`, 120);
          rememberCommand(userId, command.commandId);
          const { joined } = await requireAccess(command.publicId);
          const room = await roomStore.applyPlayback(command.publicId, userId, joined.grantHash, {
            action,
            positionSeconds: command.positionSeconds,
            expectedVersion: command.expectedVersion,
          });
          io.to(`room:${room.id}`).emit("playback:command", {
            serverNowMs: now().getTime(),
            playback: playbackSnapshot(room),
          });
          if (action === "play") emitSystemEvent(room.id, "PLAYBACK_STARTED", userId);
          if (action === "pause") emitSystemEvent(room.id, "PLAYBACK_PAUSED", userId);
        } catch (error: unknown) {
          await deny("playback:denied", error, publicId);
        }
      };
    socket.on("playback:play", playbackHandler("play", PlaybackPlayEventSchema));
    socket.on("playback:pause", playbackHandler("pause", PlaybackPauseEventSchema));
    socket.on("playback:seek", playbackHandler("seek", PlaybackSeekEventSchema));
    socket.on("playback:change-source", async (payload: unknown) => {
      let publicId: string | undefined;
      try {
        const command = PlaybackChangeSourceEventSchema.parse(payload);
        publicId = command.publicId;
        allowRate(
          sourceChangeAttempts,
          `${userId}:${command.publicId}`,
          config.SOURCE_CHANGE_RATE_LIMIT_PER_MINUTE,
          60_000,
          "SOURCE_CHANGE_RATE_LIMITED",
          "Слишком много смен источника. Подождите минуту.",
        );
        rememberCommand(userId, command.commandId);
        const { joined } = await requireAccess(command.publicId);
        const source = parsePlayerSource(command.source);
        const metadata = await metadataService.get(source);
        if (metadata.embeddable === false)
          throw new AppError(
            400,
            "SOURCE_EMBEDDING_DISABLED",
            "Автор источника запретил встраивание. Выберите другой источник.",
          );
        const room = await roomStore.changeSource(
          command.publicId,
          userId,
          joined.grantHash,
          source,
          command.expectedVersion,
          metadata,
        );
        io.to(`room:${room.id}`).emit("playback:command", {
          serverNowMs: now().getTime(),
          playback: playbackSnapshot(room),
          source,
          metadata: {
            title: room.cachedTitle,
            creatorName: room.cachedCreatorName,
            thumbnailUrl: room.cachedThumbnailUrl,
            liveStatus: room.cachedLiveStatus,
            embeddable: room.cachedEmbeddable,
          },
        });
        emitSystemEvent(room.id, "SOURCE_CHANGED", userId);
      } catch (error: unknown) {
        await deny("playback:denied", error, publicId);
      }
    });
    socket.on("chat:send", async (payload: unknown) => {
      try {
        const command = ChatSendEventSchema.parse(payload);
        allowRealtime(`${userId}:chat`, config.CHAT_RATE_LIMIT_PER_MINUTE);
        rememberCommand(userId, command.commandId);
        const { joined } = await requireAccess(command.publicId);
        const message = await roomStore.createMessage(
          command.publicId,
          userId,
          joined.grantHash,
          command.text,
        );
        io.to(`room:${message.roomId}`).emit("chat:new-message", { message });
      } catch (error: unknown) {
        await deny("chat:denied", error);
      }
    });
    socket.on("chat:delete", async (payload: unknown) => {
      try {
        const command = ChatDeleteEventSchema.parse(payload);
        allowRealtime(`${userId}:chat-admin`, 60);
        rememberCommand(userId, command.commandId);
        const { joined } = await requireAccess(command.publicId);
        await roomStore.deleteMessage(command.messageId, userId, joined.roomId);
        io.to(`room:${joined.roomId}`).emit("chat:message-deleted", {
          messageId: command.messageId,
        });
      } catch (error: unknown) {
        await deny("chat:denied", error);
      }
    });
    socket.on("chat:mute-member", async (payload: unknown) => {
      try {
        const command = ChatMuteMemberEventSchema.parse(payload);
        allowRealtime(`${userId}:chat-admin`, 60);
        rememberCommand(userId, command.commandId);
        const { joined } = await requireAccess(command.publicId);
        const restriction = await roomStore.muteMember(joined.roomId, userId, command);
        io.to(`room:${joined.roomId}`).emit("chat:member-muted", {
          userId: command.userId,
          mutedById: userId,
          ...restriction,
        });
      } catch (error: unknown) {
        await deny("chat:denied", error);
      }
    });
    socket.on("reaction:send", async (payload: unknown) => {
      try {
        const command = ReactionSendEventSchema.parse(payload);
        allowRealtime(`${userId}:reaction`, config.REACTION_RATE_LIMIT_PER_MINUTE);
        rememberCommand(userId, command.commandId);
        const { joined, room } = await requireAccess(command.publicId);
        if (!room.reactionsEnabled)
          throw new AppError(403, "ROOM_REACTIONS_DISABLED", "Реакции отключены владельцем.");
        const createdAtServerMs = now().getTime();
        io.to(`room:${joined.roomId}`).emit("reaction:new", {
          reaction: command.reaction,
          actorUserId: userId,
          createdAtServerMs,
          expiresAtServerMs: createdAtServerMs + 10_000,
        });
      } catch (error: unknown) {
        await deny("error", error);
      }
    });
    socket.on("heartbeat", async (payload: unknown) => {
      try {
        const { publicId } = HeartbeatEventSchema.parse(payload);
        allowRealtime(`${socket.id}:heartbeat`, 12);
        const { joined } = await requireAccess(publicId);
        if (!presence.heartbeat(joined.roomId, userId, socket.id))
          presence.connect(joined.roomId, userId, socket.id);
      } catch (error: unknown) {
        await deny("error", error);
      }
    });
    socket.on("telemetry:event", (payload: unknown) => {
      try {
        const event = z
          .object({ type: z.enum(["PLAYER_ERROR", "RECONNECT", "AUTOPLAY_BLOCKED"]) })
          .strict()
          .parse(payload);
        allowRate(
          telemetryAttempts,
          userId,
          30,
          60_000,
          "TELEMETRY_RATE_LIMITED",
          "Слишком много событий диагностики.",
        );
        if (event.type === "PLAYER_ERROR") metrics.playerErrors += 1;
        if (event.type === "RECONNECT") metrics.reconnects += 1;
        if (event.type === "AUTOPLAY_BLOCKED") metrics.autoplayBlocked += 1;
      } catch {
        // Telemetry is best-effort and never affects room playback.
      }
    });
    socket.on("disconnect", () => {
      metrics.connectedSockets = Math.max(0, metrics.connectedSockets - 1);
      for (const { roomId } of rooms.values()) {
        presence.disconnect(roomId, userId, socket.id);
        broadcastPresence(roomId);
      }
      rooms.clear();
    });
  });
  const presenceSweep = setInterval(() => {
    for (const roomId of presence.sweep()) broadcastPresence(roomId);
  }, 5_000);
  presenceSweep.unref();
  const chatCleanup = setInterval(() => {
    void roomStore
      .cleanupExpiredMessages()
      .catch((error: unknown) =>
        app.log.warn(
          { errorType: error instanceof Error ? error.name : "UnknownError" },
          "Chat cleanup failed",
        ),
      );
  }, config.CHAT_CLEANUP_INTERVAL_MS);
  chatCleanup.unref();

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("cache-control", "no-store");
    if (config.NODE_ENV === "production")
      reply.header("strict-transport-security", "max-age=31536000; includeSubDomains");
    if (draining && !request.url.startsWith("/health/"))
      await reply.code(503).send({
        error: {
          code: "SERVICE_DRAINING",
          message: "Сервис перезапускается.",
          requestId: request.id,
        },
      });
  });

  async function optionalUser(request: FastifyRequest): Promise<{
    user: UserDto;
    csrfTokenHash: string;
    tokenHash: string;
    credential: "BEARER" | "COOKIE";
  } | null> {
    const authorization = request.headers.authorization;
    const bearerMatch =
      typeof authorization === "string"
        ? /^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(authorization)
        : null;
    const token = bearerMatch?.[1] ?? request.cookies[sessionCookie];
    if (!token) return null;
    const tokenHash = sha256(token);
    const session = await watchStore.findSession(tokenHash);
    return session
      ? {
          user: session.user,
          csrfTokenHash: session.csrfTokenHash,
          tokenHash,
          credential: bearerMatch ? "BEARER" : "COOKIE",
        }
      : null;
  }
  async function requireUser(
    request: FastifyRequest,
    mutation = false,
  ): Promise<{
    user: UserDto;
    csrfTokenHash: string;
    tokenHash: string;
    credential: "BEARER" | "COOKIE";
  }> {
    const session = await optionalUser(request);
    if (!session)
      throw new AppError(
        401,
        "AUTH_REQUIRED",
        "Откройте WatchRoom через Telegram и войдите снова.",
      );
    if (mutation) {
      if (request.headers.origin !== config.WEB_ORIGIN)
        throw new AppError(403, "INVALID_ORIGIN", "Источник запроса не разрешён.");
      if (session.credential === "COOKIE") {
        const csrf = request.headers["x-csrf-token"];
        if (typeof csrf !== "string" || !equalSecret(sha256(csrf), session.csrfTokenHash))
          throw new AppError(403, "INVALID_CSRF", "Защитный токен запроса недействителен.");
      }
    }
    return session;
  }

  function roomGrantHash(request: FastifyRequest): string | null {
    const token = request.headers["x-room-grant"];
    return typeof token === "string" && token.length >= 20 ? sha256(token) : null;
  }

  const PageQuerySchema = z.object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  });

  function withPresence<T extends { id: string; viewerCount: number }>(room: T): T {
    return { ...room, viewerCount: countPresence(room.id) };
  }

  async function telegramApi<T>(method: string, payload: Record<string, unknown>): Promise<T> {
    if (!config.TELEGRAM_BOT_TOKEN)
      throw new AppError(503, "TELEGRAM_API_UNAVAILABLE", "Интеграция с Telegram не настроена.");
    const response = await telegramFetch(
      `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/${method}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const body = (await response.json()) as { ok?: boolean; result?: T };
    if (!response.ok || !body.ok || body.result === undefined)
      throw new AppError(502, "TELEGRAM_API_FAILED", "Telegram не подтвердил операцию.");
    return body.result;
  }

  const TelegramUpdateSchema = z
    .object({
      message: z
        .object({
          from: z.object({ id: z.number().int().safe().positive() }),
          chat_shared: z.object({
            request_id: z.number().int().min(-2_147_483_648).max(2_147_483_647),
            chat_id: z.number().int().safe(),
          }),
        })
        .optional(),
      inline_query: z
        .object({
          id: z.string().min(1).max(256),
          from: z.object({ id: z.number().int().safe().positive() }),
          query: z.string().max(256),
        })
        .optional(),
    })
    .passthrough();

  app.get("/health/live", async () => healthResponse("ok", [{ name: "process", status: "ok" }]));
  app.get("/health/ready", async (_request, reply) => {
    try {
      await database.ping();
      return healthResponse("ok", [
        { name: "process", status: "ok" },
        { name: "database", status: "ok" },
      ]);
    } catch (error: unknown) {
      app.log.warn(
        { errorType: error instanceof Error ? error.name : "UnknownError" },
        "Database readiness check failed",
      );
      return reply.code(503).send(
        healthResponse("degraded", [
          { name: "process", status: "ok" },
          { name: "database", status: "error" },
        ]),
      );
    }
  });

  app.get("/metrics", async (request, reply) => {
    if (!config.METRICS_BEARER_TOKEN) throw new AppError(404, "NOT_FOUND", "Маршрут не найден.");
    const authorization = request.headers.authorization;
    const expected = `Bearer ${config.METRICS_BEARER_TOKEN}`;
    if (typeof authorization !== "string" || !equalSecret(authorization, expected))
      throw new AppError(401, "METRICS_AUTH_REQUIRED", "Доступ к метрикам запрещён.");
    reply.type("text/plain; version=0.0.4; charset=utf-8");
    return [
      "# HELP watchroom_active_rooms Rooms with at least one connected user.",
      "# TYPE watchroom_active_rooms gauge",
      `watchroom_active_rooms ${metrics.activeRooms.size}`,
      "# HELP watchroom_websocket_connections Current Socket.IO connections.",
      "# TYPE watchroom_websocket_connections gauge",
      `watchroom_websocket_connections ${metrics.connectedSockets}`,
      "# TYPE watchroom_errors_total counter",
      `watchroom_errors_total ${metrics.errors}`,
      "# TYPE watchroom_player_errors_total counter",
      `watchroom_player_errors_total ${metrics.playerErrors}`,
      "# TYPE watchroom_reconnects_total counter",
      `watchroom_reconnects_total ${metrics.reconnects}`,
      "# TYPE watchroom_autoplay_blocked_total counter",
      `watchroom_autoplay_blocked_total ${metrics.autoplayBlocked}`,
      "",
    ].join("\n");
  });

  const requireOperations = (
    request: FastifyRequest,
  ): NonNullable<typeof databaseRuntime.prisma> => {
    if (!config.OPERATIONS_BEARER_TOKEN || !databaseRuntime.prisma)
      throw new AppError(404, "NOT_FOUND", "Маршрут не найден.");
    const authorization = request.headers.authorization;
    const expected = `Bearer ${config.OPERATIONS_BEARER_TOKEN}`;
    if (typeof authorization !== "string" || !equalSecret(authorization, expected))
      throw new AppError(401, "OPERATIONS_AUTH_REQUIRED", "Доступ к операциям запрещён.");
    return databaseRuntime.prisma;
  };
  app.get("/internal/abuse-reports", async (request) => {
    const prisma = requireOperations(request);
    const query = z
      .object({
        cursor: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]).default("OPEN"),
      })
      .parse(request.query);
    const reports = await prisma.abuseReport.findMany({
      where: { status: query.status },
      include: { room: { select: { publicId: true, name: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: query.limit,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    return {
      reports: reports.map((report) => ({
        id: report.id,
        roomPublicId: report.room.publicId,
        roomName: report.room.name,
        reporterId: report.reporterId,
        targetUserId: report.targetUserId,
        category: report.category,
        details: report.details,
        status: report.status,
        resolution: report.resolution,
        createdAt: report.createdAt.toISOString(),
        reviewedAt: report.reviewedAt?.toISOString() ?? null,
        expiresAt: report.expiresAt.toISOString(),
      })),
      nextCursor: reports.length === query.limit ? (reports.at(-1)?.id ?? null) : null,
    };
  });
  app.patch<{ Params: { id: string } }>("/internal/abuse-reports/:id", async (request) => {
    const prisma = requireOperations(request);
    const id = z.string().uuid().parse(request.params.id);
    const input = z
      .object({
        status: z.enum(["RESOLVED", "DISMISSED"]),
        resolution: z.string().trim().min(1).max(240),
      })
      .parse(request.body);
    const updated = await prisma.abuseReport.updateMany({
      where: { id, status: "OPEN" },
      data: { status: input.status, resolution: input.resolution, reviewedAt: now() },
    });
    if (updated.count !== 1)
      throw new AppError(409, "ABUSE_REPORT_ALREADY_REVIEWED", "Жалоба уже обработана.");
    return { report: await prisma.abuseReport.findUniqueOrThrow({ where: { id } }) };
  });

  app.post("/v1/auth/telegram", async (request, reply) => {
    if (request.headers.origin !== config.WEB_ORIGIN)
      throw new AppError(403, "INVALID_ORIGIN", "Источник запроса не разрешён.");
    const key = request.ip;
    const currentAttempt = authAttempts.get(key);
    const currentTime = now().getTime();
    if (authAttempts.size > 1_000) {
      for (const [address, value] of authAttempts) {
        if (value.resetAt <= currentTime) authAttempts.delete(address);
      }
    }
    const attempt =
      !currentAttempt || currentAttempt.resetAt <= currentTime
        ? { count: 0, resetAt: currentTime + 60_000 }
        : currentAttempt;
    attempt.count += 1;
    authAttempts.set(key, attempt);
    if (attempt.count > 10)
      throw new AppError(
        429,
        "AUTH_RATE_LIMITED",
        "Слишком много попыток входа. Повторите через минуту.",
      );
    const body = TelegramAuthRequestSchema.parse(request.body);
    let identity: ValidatedTelegramIdentity;
    if (config.MOCK_TELEGRAM_AUTH && body.initData === "") {
      const { createMockTelegramIdentity } = await import("./dev-auth.js");
      identity = createMockTelegramIdentity(config, now());
    } else {
      identity = validateTelegramInitData(body.initData, config.TELEGRAM_BOT_TOKEN ?? "", {
        now: now(),
        maxAgeSeconds: config.TELEGRAM_AUTH_MAX_AGE_SECONDS,
        futureSkewSeconds: config.TELEGRAM_AUTH_FUTURE_SKEW_SECONDS,
      });
    }
    const token = randomBytes(32).toString("base64url");
    const csrfToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now().getTime() + config.SESSION_TTL_SECONDS * 1_000);
    const user = await watchStore.authenticate({
      ...identity,
      tokenHash: sha256(token),
      csrfTokenHash: sha256(csrfToken),
      expiresAt,
    });
    reply.setCookie(sessionCookie, token, {
      ...sessionCookieOptions(config.NODE_ENV),
      maxAge: config.SESSION_TTL_SECONDS,
    });
    return { accessToken: token, csrfToken, user };
  });

  app.get("/v1/auth/session", async (request) => ({ user: (await requireUser(request)).user }));
  app.post("/v1/auth/logout", async (request, reply) => {
    const session = await requireUser(request, true);
    await watchStore.revokeSession(session.tokenHash);
    const sockets = await io.fetchSockets();
    for (const socket of sockets)
      if (socket.data.sessionTokenHash === session.tokenHash) socket.disconnect(true);
    reply.clearCookie(sessionCookie, sessionCookieOptions(config.NODE_ENV));
    return reply.code(204).send();
  });
  app.get("/v1/channels", async (request) => {
    const { user } = await requireUser(request);
    return { channels: await watchStore.listChannels(user.id) };
  });
  app.get("/v1/channels/public", async (request) => {
    const { user } = await requireUser(request);
    return { channels: await watchStore.listPublicChannels(user.id) };
  });
  app.post("/v1/channels", async (request, reply) => {
    const { user } = await requireUser(request, true);
    const channel = await watchStore.createChannel(
      user.id,
      CreateChannelSchema.parse(request.body),
    );
    return reply.code(201).send({ channel });
  });
  app.get<{ Params: { slug: string } }>("/v1/channels/:slug", async (request) => {
    const { user } = await requireUser(request);
    const channel = await watchStore.getChannel(request.params.slug, user.id);
    if (!channel) throw new AppError(404, "CHANNEL_NOT_FOUND", "Канал не найден или недоступен.");
    return { channel };
  });
  app.patch<{ Params: { id: string } }>("/v1/channels/:id", async (request) => {
    const { user } = await requireUser(request, true);
    return {
      channel: await watchStore.updateChannel(
        user.id,
        request.params.id,
        UpdateChannelSchema.parse(request.body),
      ),
    };
  });
  app.delete<{ Params: { id: string } }>("/v1/channels/:id", async (request, reply) => {
    const { user } = await requireUser(request, true);
    const channelId = z.string().uuid().parse(request.params.id);
    if (await roomStore.hasActiveRoomsForChannel(channelId))
      throw new AppError(
        409,
        "CHANNEL_HAS_ACTIVE_ROOMS",
        "Сначала завершите активные комнаты канала.",
      );
    await watchStore.deleteChannel(user.id, channelId);
    return reply.code(204).send();
  });
  app.get<{ Params: { id: string } }>("/v1/channels/:id/members", async (request) => {
    const { user } = await requireUser(request);
    const channelId = z.string().uuid().parse(request.params.id);
    return { members: await watchStore.listChannelMembers(user.id, channelId) };
  });
  app.post<{ Params: { id: string } }>("/v1/channels/:id/members", async (request, reply) => {
    const { user } = await requireUser(request, true);
    const channelId = z.string().uuid().parse(request.params.id);
    const member = await watchStore.addChannelMember(
      user.id,
      channelId,
      AddChannelMemberSchema.parse(request.body),
    );
    return reply.code(201).send({ member });
  });
  app.patch<{ Params: { id: string; userId: string } }>(
    "/v1/channels/:id/members/:userId",
    async (request) => {
      const { user } = await requireUser(request, true);
      return {
        member: await watchStore.updateChannelMember(
          user.id,
          z.string().uuid().parse(request.params.id),
          z.string().uuid().parse(request.params.userId),
          UpdateChannelMemberSchema.parse(request.body),
        ),
      };
    },
  );
  app.delete<{ Params: { id: string; userId: string } }>(
    "/v1/channels/:id/members/:userId",
    async (request, reply) => {
      const { user } = await requireUser(request, true);
      await watchStore.removeChannelMember(
        user.id,
        z.string().uuid().parse(request.params.id),
        z.string().uuid().parse(request.params.userId),
      );
      return reply.code(204).send();
    },
  );

  app.get("/v1/rooms/catalog", async (request) => {
    const { user } = await requireUser(request);
    const query = PageQuerySchema.parse(request.query);
    const rooms = await roomStore.listCatalog(user.id, query.cursor ?? null, query.limit);
    return {
      rooms: rooms.map(withPresence),
      nextCursor: rooms.length === query.limit ? (rooms.at(-1)?.id ?? null) : null,
    };
  });

  app.get<{ Params: { channelId: string } }>("/v1/channels/:channelId/rooms", async (request) => {
    const { user } = await requireUser(request);
    const channelId = z.string().uuid().parse(request.params.channelId);
    const query = PageQuerySchema.parse(request.query);
    const rooms = await roomStore.listChannelRooms(
      channelId,
      user.id,
      query.cursor ?? null,
      query.limit,
    );
    return {
      rooms: rooms.map(withPresence),
      nextCursor: rooms.length === query.limit ? (rooms.at(-1)?.id ?? null) : null,
    };
  });

  app.post("/v1/rooms", async (request, reply) => {
    const { user } = await requireUser(request, true);
    allowRate(
      roomCreateAttempts,
      user.id,
      config.CREATE_ROOM_RATE_LIMIT_PER_HOUR,
      60 * 60_000,
      "ROOM_CREATE_RATE_LIMITED",
      "Достигнут лимит создания комнат. Повторите позже.",
    );
    const parsedInput = CreateRoomSchema.parse(request.body);
    const source = normalizePlayerSource({
      provider: parsedInput.sourceProvider,
      kind: parsedInput.sourceKind,
      sourceId: parsedInput.sourceId,
      canonicalUrl: parsedInput.canonicalUrl,
    });
    const metadata = await metadataService.get(source);
    const input = {
      ...parsedInput,
      sourceProvider: source.provider,
      sourceKind: source.kind,
      sourceId: source.sourceId,
      canonicalUrl: source.canonicalUrl,
    };
    const passwordHash = input.password ? await hashRoomPassword(input.password) : null;
    const room = await roomStore.createRoom(user.id, input, passwordHash, metadata);
    return reply.code(201).send({ room: withPresence(room) });
  });

  app.post("/v1/sources/metadata", async (request) => {
    const { user } = await requireUser(request, true);
    const current = now().getTime();
    const attempt = metadataAttempts.get(user.id);
    if (!attempt || attempt.resetAt <= current) {
      metadataAttempts.set(user.id, { count: 1, resetAt: current + 60_000 });
    } else {
      attempt.count += 1;
      if (attempt.count > config.PROVIDER_METADATA_RATE_LIMIT_PER_MINUTE)
        throw new AppError(429, "METADATA_RATE_LIMITED", "Слишком много запросов метаданных.");
    }
    const source = parsePlayerSource(ParseSourceRequestSchema.parse(request.body));
    return { metadata: await metadataService.get(source) };
  });

  app.get<{ Params: { publicId: string } }>("/v1/rooms/:publicId/preview", async (request) => {
    const { user } = await requireUser(request);
    const publicId = z.string().min(20).max(24).parse(request.params.publicId);
    const access = await roomStore.getDetail(publicId, user.id, null);
    const secret = await roomStore.getSecret(publicId);
    if (!access || !secret || (secret.status === "DRAFT" && secret.ownerId !== user.id))
      throw new AppError(404, "ROOM_NOT_FOUND", "Комната не найдена или недоступна.");
    const snapshot = presence.snapshot(secret.id);
    const summaries = await Promise.all(
      snapshot.userIds.slice(0, 3).map((userId) => watchStore.getUserSummary(userId)),
    );
    const preview = {
      publicId: secret.publicId,
      name: secret.name,
      description: secret.description,
      visibility: secret.visibility,
      status: secret.status,
      sourceProvider: secret.sourceProvider,
      sourceKind: secret.sourceKind,
      cachedTitle: secret.cachedTitle,
      cachedThumbnailUrl: secret.cachedThumbnailUrl,
      cachedCreatorName: secret.cachedCreatorName,
      cachedLiveStatus: secret.cachedLiveStatus,
      nowWatchingText: secret.nowWatchingText,
      viewerCount: snapshot.viewerCount,
      viewerNames: summaries
        .filter((summary): summary is NonNullable<typeof summary> => summary !== null)
        .map((summary) => summary.firstName),
    } satisfies RoomPreviewDto;
    return { preview };
  });

  app.get<{ Params: { publicId: string } }>("/v1/rooms/:publicId", async (request) => {
    const { user } = await requireUser(request);
    const publicId = z.string().min(20).max(24).parse(request.params.publicId);
    const detail = await roomStore.getDetail(publicId, user.id, roomGrantHash(request));
    if (!detail) throw new AppError(404, "ROOM_NOT_FOUND", "Комната не найдена или недоступна.");
    if (!detail.locked && !detail.room.role)
      throw new AppError(403, "ROOM_JOIN_REQUIRED", "Сначала присоединитесь к комнате.");
    return detail.locked ? detail : { locked: false, room: withPresence(detail.room) };
  });

  app.post<{ Params: { publicId: string } }>("/v1/rooms/:publicId/unlock", async (request) => {
    const { user } = await requireUser(request, true);
    const publicId = z.string().min(20).max(24).parse(request.params.publicId);
    const { password } = UnlockRoomSchema.parse(request.body);
    const key = `${user.id}:${publicId}`;
    unlockGuard.assertAllowed(key);
    const secret = await roomStore.getSecret(publicId);
    const candidateHash = secret?.passwordHash ?? (await fallbackRoomPasswordHash);
    const passwordMatches = await verifyRoomPassword(candidateHash, password);
    const valid = Boolean(
      secret?.visibility === "PRIVATE" && secret.passwordHash && passwordMatches,
    );
    if (!secret || !valid) return unlockGuard.registerFailure(key);
    if (secret.passwordHash && roomPasswordNeedsRehash(secret.passwordHash)) {
      const replacementHash = await hashRoomPassword(password);
      await roomStore.rehashPassword(secret.id, secret.passwordHash, replacementHash);
    }
    const grantToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now().getTime() + config.ROOM_GRANT_TTL_SECONDS * 1_000);
    await roomStore.createGrant(
      secret.id,
      user.id,
      sha256(grantToken),
      secret.passwordRevision,
      expiresAt,
    );
    unlockGuard.reset(key);
    return { grantToken, expiresAt: expiresAt.toISOString() };
  });

  app.post<{ Params: { publicId: string } }>("/v1/rooms/:publicId/join", async (request) => {
    const { user } = await requireUser(request, true);
    const room = await roomStore.joinRoom(
      z.string().min(20).max(24).parse(request.params.publicId),
      user.id,
      roomGrantHash(request),
    );
    return { room: withPresence(room) };
  });

  app.patch<{ Params: { id: string } }>("/v1/rooms/:id", async (request) => {
    const { user } = await requireUser(request, true);
    const roomId = z.string().uuid().parse(request.params.id);
    const input = UpdateRoomSchema.parse(request.body);
    if (
      input.sourceProvider !== undefined ||
      input.sourceKind !== undefined ||
      input.sourceId !== undefined ||
      input.canonicalUrl !== undefined
    )
      throw new AppError(
        400,
        "SOURCE_CHANGE_REQUIRES_VERSION",
        "Меняйте источник через версионированную realtime-команду.",
      );
    const existing = await roomStore.getSecretById(roomId);
    if (!existing || existing.ownerId !== user.id)
      throw new AppError(403, "ROOM_FORBIDDEN", "Изменять комнату может только владелец.");
    if (
      (input.status === "WAITING" || input.status === "LIVE") &&
      existing.cachedEmbeddable === false
    )
      throw new AppError(
        409,
        "SOURCE_EMBEDDING_DISABLED",
        "Нельзя открыть комнату: автор источника запретил встраивание.",
      );
    let passwordHash: string | null | undefined;
    const targetVisibility = input.visibility ?? existing?.visibility;
    if (targetVisibility === "PUBLIC") {
      if (input.password)
        throw new AppError(
          400,
          "ROOM_PASSWORD_NOT_ALLOWED",
          "Пароль допустим только для закрытой комнаты.",
        );
      if (existing?.visibility === "PRIVATE") passwordHash = null;
    } else if (input.password) passwordHash = await hashRoomPassword(input.password);
    else if (existing?.visibility !== "PRIVATE" || !existing.passwordHash)
      throw new AppError(400, "ROOM_PASSWORD_REQUIRED", "Для закрытой комнаты нужен пароль.");
    const room = await roomStore.updateRoom(roomId, user.id, input, passwordHash);
    io.to(`room:${room.id}`).emit("room:updated", { room: withPresence(room) });
    if (input.status === "ENDED") {
      io.to(`room:${room.id}`).emit("room:ended", {
        serverNowMs: now().getTime(),
        playback: playbackSnapshot(room),
      });
      emitSystemEvent(room.id, "ROOM_ENDED", user.id);
    }
    if (passwordHash !== undefined) io.in(`room:${room.id}`).disconnectSockets(true);
    return { room: withPresence(room) };
  });

  app.delete<{ Params: { id: string } }>("/v1/rooms/:id", async (request, reply) => {
    const { user } = await requireUser(request, true);
    const roomId = z.string().uuid().parse(request.params.id);
    emitSystemEvent(roomId, "ROOM_ENDED", user.id);
    await roomStore.deleteRoom(roomId, user.id);
    io.to(`room:${roomId}`).emit("room:ended", {});
    return reply.code(204).send();
  });

  app.put<{ Params: { id: string; userId: string } }>(
    "/v1/rooms/:id/moderators/:userId",
    async (request, reply) => {
      const { user } = await requireUser(request, true);
      await roomStore.setModerator(
        z.string().uuid().parse(request.params.id),
        user.id,
        z.string().uuid().parse(request.params.userId),
        true,
      );
      return reply.code(204).send();
    },
  );

  app.delete<{ Params: { id: string; userId: string } }>(
    "/v1/rooms/:id/moderators/:userId",
    async (request, reply) => {
      const { user } = await requireUser(request, true);
      await roomStore.setModerator(
        z.string().uuid().parse(request.params.id),
        user.id,
        z.string().uuid().parse(request.params.userId),
        false,
      );
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { id: string } }>("/v1/rooms/:id/members", async (request) => {
    const { user } = await requireUser(request);
    const query = PageQuerySchema.parse(request.query);
    const members = await roomStore.listMembers(
      z.string().uuid().parse(request.params.id),
      user.id,
      query.cursor ?? null,
      query.limit,
    );
    return {
      members,
      nextCursor: members.length === query.limit ? (members.at(-1)?.userId ?? null) : null,
    };
  });

  app.get<{ Params: { id: string } }>("/v1/rooms/:id/moderation-audit", async (request) => {
    const { user } = await requireUser(request);
    return {
      entries: await roomStore.listModerationAudit(
        z.string().uuid().parse(request.params.id),
        user.id,
      ),
    };
  });

  app.post<{ Params: { id: string } }>(
    "/v1/rooms/:id/telegram-chat/request",
    async (request, reply) => {
      const { user } = await requireUser(request, true);
      const roomId = z.string().uuid().parse(request.params.id);
      const secret = await roomStore.getSecretById(roomId);
      if (!secret || secret.ownerId !== user.id)
        throw new AppError(403, "ROOM_FORBIDDEN", "Привязать обсуждение может только владелец.");
      if (!config.TELEGRAM_WEBHOOK_SECRET)
        throw new AppError(
          503,
          "TELEGRAM_CHAT_BINDING_UNAVAILABLE",
          "Выбор Telegram-чата пока не настроен на сервере.",
        );
      let requestId = randomInt(1, 2_147_483_647);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (!(await roomStore.findTelegramBindingByRequestId(requestId))) break;
        requestId = randomInt(1, 2_147_483_647);
      }
      const prepared = await telegramApi<{ id: string; expiration_date?: number }>(
        "savePreparedKeyboardButton",
        {
          user_id: Number(user.telegramId),
          button: {
            text: "Выбрать обсуждение",
            request_chat: {
              request_id: requestId,
              chat_is_channel: false,
              chat_has_username: true,
              bot_is_member: true,
              request_title: true,
              request_username: true,
            },
          },
        },
      );
      const providerExpiry = prepared.expiration_date
        ? new Date(prepared.expiration_date * 1_000)
        : new Date(now().getTime() + 10 * 60_000);
      const expiresAt = new Date(Math.min(providerExpiry.getTime(), now().getTime() + 10 * 60_000));
      const binding = await roomStore.createTelegramBindingRequest({
        roomId,
        ownerId: user.id,
        telegramUserId: user.telegramId,
        requestId,
        preparedButtonId: prepared.id,
        expiresAt,
      });
      return reply.code(201).send({
        requestToken: binding.id,
        preparedButtonId: binding.preparedButtonId,
        expiresAt: binding.expiresAt.toISOString(),
      });
    },
  );

  app.get<{ Params: { id: string; requestToken: string } }>(
    "/v1/rooms/:id/telegram-chat/requests/:requestToken",
    async (request) => {
      const { user } = await requireUser(request);
      const roomId = z.string().uuid().parse(request.params.id);
      const requestToken = z.string().uuid().parse(request.params.requestToken);
      const binding = await roomStore.getTelegramBindingRequest(requestToken, user.id);
      if (!binding || binding.roomId !== roomId)
        throw new AppError(404, "TELEGRAM_BINDING_NOT_FOUND", "Запрос выбора чата не найден.");
      if (binding.status === "PENDING" && binding.expiresAt <= now()) {
        await roomStore.failTelegramBindingRequest(requestToken, "Срок выбора чата истёк.");
        return { status: "EXPIRED", message: "Срок выбора чата истёк." };
      }
      return { status: binding.status, message: binding.message };
    },
  );

  app.delete<{ Params: { id: string } }>("/v1/rooms/:id/telegram-chat", async (request, reply) => {
    const { user } = await requireUser(request, true);
    const room = await roomStore.unbindTelegramChat(
      z.string().uuid().parse(request.params.id),
      user.id,
    );
    io.to(`room:${room.id}`).emit("room:updated", { room: withPresence(room) });
    return reply.code(204).send();
  });

  app.post("/v1/telegram/webhook", async (request, reply) => {
    if (!config.TELEGRAM_WEBHOOK_SECRET)
      throw new AppError(503, "TELEGRAM_WEBHOOK_DISABLED", "Webhook Telegram не настроен.");
    const header = request.headers["x-telegram-bot-api-secret-token"];
    if (typeof header !== "string" || !equalSecret(header, config.TELEGRAM_WEBHOOK_SECRET))
      throw new AppError(403, "INVALID_TELEGRAM_WEBHOOK_SECRET", "Webhook не подтверждён.");
    const update = TelegramUpdateSchema.safeParse(request.body);
    if (!update.success) return reply.send({ ok: true });
    if (update.data.inline_query) {
      const inlineQuery = update.data.inline_query;
      const publicId = /^room_([A-Za-z0-9_-]{20,24})$/.exec(inlineQuery.query)?.[1];
      const secret = publicId ? await roomStore.getSecret(publicId) : null;
      const results =
        publicId && secret && secret.status !== "DRAFT"
          ? [
              {
                type: "article",
                id: publicId,
                title: `Смотреть: ${secret.name}`,
                description: `${secret.sourceKind === "LIVE" ? "LIVE" : "VOD"} · ${secret.sourceProvider}`,
                input_message_content: {
                  message_text: [
                    `🎬 ${secret.name}`,
                    `${secret.sourceKind === "LIVE" ? "LIVE" : "VOD"} · ${secret.sourceProvider}`,
                    secret.nowWatchingText || secret.cachedTitle || "Совместный просмотр",
                    createTelegramRoomLinks(
                      config.TELEGRAM_BOT_USERNAME,
                      config.TELEGRAM_APP_SHORT_NAME,
                      publicId,
                    ).canonical,
                  ].join("\n"),
                },
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "Открыть WatchRoom",
                        url: createTelegramRoomLinks(
                          config.TELEGRAM_BOT_USERNAME,
                          config.TELEGRAM_APP_SHORT_NAME,
                          publicId,
                        ).canonical,
                      },
                    ],
                  ],
                },
              },
            ]
          : [];
      await telegramApi<boolean>("answerInlineQuery", {
        inline_query_id: inlineQuery.id,
        results,
        cache_time: 0,
        is_personal: true,
      });
      return reply.send({ ok: true });
    }
    if (!update.data.message) return reply.send({ ok: true });
    const shared = update.data.message.chat_shared;
    const binding = await roomStore.findTelegramBindingByRequestId(shared.request_id);
    if (!binding || binding.status !== "PENDING") return reply.send({ ok: true });
    const fail = async (message: string) => {
      await roomStore.failTelegramBindingRequest(binding.id, message);
      return reply.send({ ok: true });
    };
    if (
      binding.expiresAt <= now() ||
      binding.telegramUserId !== String(update.data.message.from.id)
    )
      return fail("Telegram не подтвердил владельца запроса или срок выбора истёк.");
    try {
      const chatId = String(shared.chat_id);
      const [chat, administrators, bot] = await Promise.all([
        telegramApi<{ id: number; type: string; username?: string }>("getChat", {
          chat_id: chatId,
        }),
        telegramApi<Array<{ status: string; user: { id: number } }>>("getChatAdministrators", {
          chat_id: chatId,
        }),
        telegramApi<{ id: number }>("getMe", {}),
      ]);
      const botMember = await telegramApi<{ status: string }>("getChatMember", {
        chat_id: chatId,
        user_id: bot.id,
      });
      const username = chat.username;
      const validUsername = Boolean(username && /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username));
      const requesterIsAdmin = administrators.some(
        (member) =>
          String(member.user.id) === binding.telegramUserId &&
          (member.status === "creator" || member.status === "administrator"),
      );
      const botIsMember = ["member", "administrator", "creator"].includes(botMember.status);
      if (
        !["group", "supergroup"].includes(chat.type) ||
        !validUsername ||
        !requesterIsAdmin ||
        !botIsMember
      )
        return fail("Нужна публичная группа: вы должны быть администратором, а бот — участником.");
      await roomStore.completeTelegramBindingRequest({
        requestToken: binding.id,
        chatId,
        username: username as string,
        url: `https://t.me/${username}`,
      });
      const secret = await roomStore.getSecretById(binding.roomId);
      if (secret) {
        const detail = await roomStore.getDetail(secret.publicId, binding.requestedById, null);
        if (detail && !detail.locked)
          io.to(`room:${binding.roomId}`).emit("room:updated", {
            room: withPresence(detail.room),
          });
      }
    } catch {
      await roomStore.failTelegramBindingRequest(
        binding.id,
        "Telegram не позволил проверить чат и права участников.",
      );
    }
    return reply.send({ ok: true });
  });

  app.get<{ Params: { publicId: string } }>("/v1/rooms/:publicId/messages", async (request) => {
    const { user } = await requireUser(request);
    return {
      messages: await roomStore.listMessages(
        z.string().min(20).max(24).parse(request.params.publicId),
        user.id,
        roomGrantHash(request),
      ),
    };
  });

  app.post<{ Params: { publicId: string } }>(
    "/v1/rooms/:publicId/messages",
    async (request, reply) => {
      const { user } = await requireUser(request, true);
      const publicId = z.string().min(20).max(24).parse(request.params.publicId);
      const rateKey = `${user.id}:${publicId}`;
      const timestamp = now().getTime();
      if (chatAttempts.size > 1_000) {
        for (const [key, value] of chatAttempts) {
          if (value.resetAt <= timestamp) chatAttempts.delete(key);
        }
      }
      const previous = chatAttempts.get(rateKey);
      const attempt =
        !previous || previous.resetAt <= timestamp
          ? { count: 0, resetAt: timestamp + 60_000 }
          : previous;
      attempt.count += 1;
      chatAttempts.set(rateKey, attempt);
      if (attempt.count > config.CHAT_RATE_LIMIT_PER_MINUTE)
        throw new AppError(
          429,
          "ROOM_CHAT_RATE_LIMITED",
          "Слишком много сообщений. Подождите минуту.",
        );
      const { text } = CreateRoomMessageSchema.parse(request.body);
      const message = await roomStore.createMessage(
        publicId,
        user.id,
        roomGrantHash(request),
        text,
      );
      io.to(`room:${message.roomId}`).emit("chat:new-message", { message });
      return reply.code(201).send({ message });
    },
  );

  app.delete<{ Params: { messageId: string } }>(
    "/v1/room-messages/:messageId",
    async (request, reply) => {
      const { user } = await requireUser(request, true);
      const messageId = z.string().uuid().parse(request.params.messageId);
      const { roomId } = await roomStore.deleteMessage(messageId, user.id);
      io.to(`room:${roomId}`).emit("chat:message-deleted", { messageId });
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string } }>(
    "/v1/rooms/:id/chat-restrictions",
    async (request, reply) => {
      const { user } = await requireUser(request, true);
      const input = MuteRoomMemberSchema.parse(request.body);
      const roomId = z.string().uuid().parse(request.params.id);
      const restriction = await roomStore.muteMember(roomId, user.id, input);
      io.to(`room:${roomId}`).emit("chat:member-muted", {
        userId: input.userId,
        mutedById: user.id,
        ...restriction,
      });
      return reply.code(201).send({ muted: true, ...restriction });
    },
  );

  app.put<{ Params: { id: string; userId: string } }>(
    "/v1/rooms/:id/blocked-members/:userId",
    async (request, reply) => {
      const { user } = await requireUser(request, true);
      const roomId = z.string().uuid().parse(request.params.id);
      const targetUserId = z.string().uuid().parse(request.params.userId);
      const { reason } = BlockRoomMemberSchema.parse(request.body);
      await roomStore.blockMember(roomId, user.id, targetUserId, reason ?? null);
      io.to(`room:${roomId}`).emit("room:access-revoked", { userId: targetUserId });
      const sockets = await io.in(`room:${roomId}`).fetchSockets();
      for (const socket of sockets)
        if (socket.data.userId === targetUserId) socket.disconnect(true);
      return reply.code(204).send();
    },
  );

  app.delete<{ Params: { id: string; userId: string } }>(
    "/v1/rooms/:id/blocked-members/:userId",
    async (request, reply) => {
      const { user } = await requireUser(request, true);
      await roomStore.unblockMember(
        z.string().uuid().parse(request.params.id),
        user.id,
        z.string().uuid().parse(request.params.userId),
      );
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { publicId: string } }>(
    "/v1/rooms/:publicId/abuse-reports",
    async (request, reply) => {
      const { user } = await requireUser(request, true);
      const publicId = z.string().min(20).max(24).parse(request.params.publicId);
      allowRate(
        reportAttempts,
        user.id,
        config.ABUSE_REPORT_RATE_LIMIT_PER_DAY,
        24 * 60 * 60_000,
        "ABUSE_REPORT_RATE_LIMITED",
        "Достигнут дневной лимит жалоб.",
      );
      const report = await roomStore.createAbuseReport(
        publicId,
        user.id,
        roomGrantHash(request),
        AbuseReportSchema.parse(request.body),
      );
      return reply.code(201).send({ report });
    },
  );

  app.post<{ Params: { publicId: string } }>("/v1/rooms/:publicId/playback", async (request) => {
    const { user } = await requireUser(request, true);
    const command = PlaybackCommandSchema.parse(request.body);
    const room = await roomStore.applyPlayback(
      z.string().min(20).max(24).parse(request.params.publicId),
      user.id,
      roomGrantHash(request),
      command,
    );
    const payload = { room: withPresence(room) };
    io.to(`room:${room.id}`).emit("playback:command", {
      serverNowMs: now().getTime(),
      playback: playbackSnapshot(room),
    });
    if (command.action === "play") emitSystemEvent(room.id, "PLAYBACK_STARTED", user.id);
    if (command.action === "pause") emitSystemEvent(room.id, "PLAYBACK_PAUSED", user.id);
    return payload;
  });

  app.get<{ Params: { publicId: string } }>("/v1/rooms/:publicId/invite", async (request) => {
    await requireUser(request);
    const publicId = z.string().min(20).max(24).parse(request.params.publicId);
    if (!(await roomStore.getSecret(publicId)))
      throw new AppError(404, "ROOM_NOT_FOUND", "Комната не найдена.");
    return createTelegramRoomLinks(
      config.TELEGRAM_BOT_USERNAME,
      config.TELEGRAM_APP_SHORT_NAME,
      publicId,
    );
  });

  app.post<{ Params: { publicId: string } }>(
    "/v1/rooms/:publicId/share-message",
    async (request) => {
      const { user } = await requireUser(request, true);
      const publicId = z.string().min(20).max(24).parse(request.params.publicId);
      const detail = await roomStore.getDetail(publicId, user.id, roomGrantHash(request));
      if (!detail || detail.locked)
        throw new AppError(403, "ROOM_ACCESS_DENIED", "Комната недоступна.");
      if (!config.TELEGRAM_BOT_TOKEN)
        throw new AppError(
          503,
          "TELEGRAM_SHARE_UNAVAILABLE",
          "Отправка через Telegram недоступна в локальном режиме.",
        );
      const links = createTelegramRoomLinks(
        config.TELEGRAM_BOT_USERNAME,
        config.TELEGRAM_APP_SHORT_NAME,
        publicId,
      );
      const telegramResponse = await telegramFetch(
        `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/savePreparedInlineMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            user_id: Number(user.telegramId),
            result: {
              type: "article",
              id: publicId,
              title: `Смотреть: ${detail.room.name}`,
              input_message_content: {
                message_text: [
                  `🎬 ${detail.room.name}`,
                  `${detail.room.sourceKind === "LIVE" ? "LIVE" : "VOD"} · ${detail.room.sourceProvider}`,
                  detail.room.nowWatchingText || detail.room.cachedTitle || "Совместный просмотр",
                  "Присоединяйтесь к WatchRoom:",
                  links.canonical,
                ].join("\n"),
              },
              reply_markup: {
                inline_keyboard: [[{ text: "Открыть WatchRoom", url: links.canonical }]],
              },
            },
            allow_user_chats: true,
            allow_bot_chats: false,
            allow_group_chats: true,
            allow_channel_chats: true,
          }),
        },
      );
      const body = (await telegramResponse.json()) as {
        ok?: boolean;
        result?: { id?: string; expiration_date?: number };
      };
      if (!telegramResponse.ok || !body.ok || !body.result?.id)
        throw new AppError(
          502,
          "TELEGRAM_SHARE_FAILED",
          "Не удалось подготовить сообщение. Ссылка доступна для копирования.",
        );
      return {
        preparedMessageId: body.result.id,
        expiresAt: body.result.expiration_date
          ? new Date(body.result.expiration_date * 1_000).toISOString()
          : null,
      };
    },
  );

  app.setNotFoundHandler(async (request, reply) =>
    reply
      .code(404)
      .send({ error: { code: "NOT_FOUND", message: "Маршрут не найден.", requestId: request.id } }),
  );
  app.setErrorHandler(async (error, request, reply) => {
    metrics.errors += 1;
    if (error instanceof AppError)
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
          ...(error.details ?? {}),
        },
      });
    if (error instanceof ZodError)
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues
            .map((issue) => {
              const field = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
              return `${field}${issue.message}`;
            })
            .join("; "),
          requestId: request.id,
          details: error.issues,
        },
      });
    if (error instanceof SourceParseError)
      return reply.code(400).send({
        error: { code: error.code, message: error.message, requestId: request.id },
      });
    if (
      error &&
      typeof error === "object" &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode >= 400
    ) {
      const statusCode = Math.min(error.statusCode, 499);
      return reply.code(statusCode).send({
        error: {
          code: statusCode === 413 ? "PAYLOAD_TOO_LARGE" : "BAD_REQUEST",
          message:
            statusCode === 413
              ? "Размер запроса превышает допустимый предел."
              : "Запрос не может быть обработан.",
          requestId: request.id,
        },
      });
    }
    request.log.error(
      { errorType: error instanceof Error ? error.name : "UnknownError" },
      "Unhandled request error",
    );
    return reply.code(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Непредвиденная ошибка сервера.",
        requestId: request.id,
      },
    });
  });

  async function closeSocketServer(): Promise<void> {
    await new Promise<void>((resolve) => io.close(() => resolve()));
  }
  return {
    app,
    setDraining() {
      draining = true;
    },
    async close() {
      if (closed) return;
      closed = true;
      draining = true;
      clearInterval(presenceSweep);
      clearInterval(chatCleanup);
      presence.close();
      io.emit("system:shutdown", { reconnect: true });
      io.disconnectSockets(true);
      await closeSocketServer();
      await app.close();
      await database.close();
    },
  };
}
