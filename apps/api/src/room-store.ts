import { randomBytes, randomUUID } from "node:crypto";

import {
  resolveRoomCapabilities,
  type AbuseReportInput,
  type CreateRoomInput,
  type PlaybackCommand,
  type RoomDto,
  type RoomMemberDto,
  type RoomMessageDto,
  type RoomChatRestrictionStatus,
  type RoomModerationAuditDto,
  type RoomRole,
  type SourceMetadata,
  type PlayerSource,
  type MuteRoomMemberInput,
  type UpdateRoomInput,
} from "@watchroom/shared";

import { AppError } from "./errors.js";
import type { PrismaClient } from "./generated/prisma/client.js";
import type { WatchRoomStore } from "./store.js";

type RoomRow = {
  id: string;
  publicId: string;
  channelId: string;
  ownerId: string;
  name: string;
  description: string;
  visibility: "PUBLIC" | "PRIVATE";
  passwordHash: string | null;
  passwordRevision: number;
  status: "DRAFT" | "WAITING" | "LIVE" | "ENDED";
  controlPolicy: "OWNER_ONLY" | "MODERATORS" | "EVERYONE";
  sourceProvider: "YOUTUBE" | "TWITCH";
  sourceKind: "VIDEO" | "VOD" | "LIVE";
  sourceId: string;
  canonicalUrl: string;
  cachedTitle: string | null;
  cachedThumbnailUrl: string | null;
  cachedCreatorName: string | null;
  cachedLiveStatus: string | null;
  cachedEmbeddable: boolean | null;
  metadataFetchedAt: Date | null;
  nowWatchingText: string;
  reactionsEnabled: boolean;
  playbackPaused: boolean;
  playbackState: string;
  playbackPositionSeconds: number;
  playbackRate: number;
  playbackVersion: number;
  playbackUpdatedAt: Date;
  playbackActorUserId: string | null;
  playbackLiveEdge: boolean;
  linkedTelegramChatId: bigint | null;
  linkedTelegramChatUsername: string | null;
  linkedTelegramChatUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  members: Array<{ userId: string; role: RoomRole; lastSeenAt: Date }>;
};

export interface RoomSecret {
  id: string;
  publicId: string;
  visibility: "PUBLIC" | "PRIVATE";
  passwordHash: string | null;
  passwordRevision: number;
  ownerId: string;
  name: string;
  sourceProvider: "YOUTUBE" | "TWITCH";
  sourceKind: "VIDEO" | "VOD" | "LIVE";
  sourceId: string;
  canonicalUrl: string;
  description: string;
  status: "DRAFT" | "WAITING" | "LIVE" | "ENDED";
  cachedTitle: string | null;
  cachedThumbnailUrl: string | null;
  cachedCreatorName: string | null;
  cachedLiveStatus: "UNKNOWN" | "LIVE" | "OFFLINE" | "UPCOMING" | "VOD" | null;
  nowWatchingText: string;
  cachedEmbeddable: boolean | null;
}

export type RoomDetail =
  { locked: true; publicId: string; visibility: "PRIVATE" } | { locked: false; room: RoomDto };

export interface TelegramBindingRequestRecord {
  id: string;
  roomId: string;
  requestedById: string;
  telegramUserId: string;
  requestId: number;
  preparedButtonId: string;
  status: "PENDING" | "BOUND" | "FAILED";
  message: string | null;
  expiresAt: Date;
}

export interface RoomStore {
  createRoom(
    userId: string,
    input: CreateRoomInput,
    passwordHash: string | null,
    metadata?: SourceMetadata,
  ): Promise<RoomDto>;
  getSecret(publicId: string): Promise<RoomSecret | null>;
  getSecretById(roomId: string): Promise<RoomSecret | null>;
  getDetail(
    publicId: string,
    userId: string | null,
    grantHash: string | null,
    viewerCount?: number,
  ): Promise<RoomDetail | null>;
  listCatalog(userId: string | null, cursor: string | null, limit: number): Promise<RoomDto[]>;
  listChannelRooms(
    channelId: string,
    userId: string | null,
    cursor: string | null,
    limit: number,
  ): Promise<RoomDto[]>;
  createGrant(
    roomId: string,
    userId: string,
    tokenHash: string,
    passwordRevision: number,
    expiresAt: Date,
  ): Promise<void>;
  joinRoom(publicId: string, userId: string, grantHash: string | null): Promise<RoomDto>;
  updateRoom(
    roomId: string,
    ownerId: string,
    input: UpdateRoomInput,
    passwordHash: string | null | undefined,
    metadata?: SourceMetadata,
  ): Promise<RoomDto>;
  deleteRoom(roomId: string, ownerId: string): Promise<void>;
  setModerator(roomId: string, ownerId: string, userId: string, enabled: boolean): Promise<void>;
  listMembers(
    roomId: string,
    requestingUserId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RoomMemberDto[]>;
  applyPlayback(
    publicId: string,
    userId: string,
    grantHash: string | null,
    command: PlaybackCommand,
  ): Promise<RoomDto>;
  changeSource(
    publicId: string,
    userId: string,
    grantHash: string | null,
    source: PlayerSource,
    expectedVersion: number,
    metadata: SourceMetadata,
  ): Promise<RoomDto>;
  listMessages(
    publicId: string,
    userId: string,
    grantHash: string | null,
  ): Promise<RoomMessageDto[]>;
  createMessage(
    publicId: string,
    userId: string,
    grantHash: string | null,
    text: string,
  ): Promise<RoomMessageDto>;
  deleteMessage(
    messageId: string,
    userId: string,
    expectedRoomId?: string,
  ): Promise<{ roomId: string }>;
  muteMember(
    roomId: string,
    userId: string,
    input: MuteRoomMemberInput,
  ): Promise<RoomChatRestrictionStatus>;
  cleanupExpiredMessages(): Promise<number>;
  getActiveChatRestriction(
    publicId: string,
    userId: string,
    grantHash: string | null,
  ): Promise<RoomChatRestrictionStatus | null>;
  listModerationAudit(roomId: string, userId: string): Promise<RoomModerationAuditDto[]>;
  createTelegramBindingRequest(input: {
    roomId: string;
    ownerId: string;
    telegramUserId: string;
    requestId: number;
    preparedButtonId: string;
    expiresAt: Date;
  }): Promise<TelegramBindingRequestRecord>;
  getTelegramBindingRequest(
    requestToken: string,
    ownerId: string,
  ): Promise<TelegramBindingRequestRecord | null>;
  findTelegramBindingByRequestId(requestId: number): Promise<TelegramBindingRequestRecord | null>;
  failTelegramBindingRequest(requestToken: string, message: string): Promise<void>;
  completeTelegramBindingRequest(input: {
    requestToken: string;
    chatId: string;
    username: string;
    url: string;
  }): Promise<void>;
  unbindTelegramChat(roomId: string, ownerId: string): Promise<RoomDto>;
  rehashPassword(roomId: string, currentHash: string, replacementHash: string): Promise<void>;
  hasActiveRoomsForChannel(channelId: string): Promise<boolean>;
  blockMember(
    roomId: string,
    ownerId: string,
    userId: string,
    reason: string | null,
  ): Promise<void>;
  unblockMember(roomId: string, ownerId: string, userId: string): Promise<void>;
  createAbuseReport(
    publicId: string,
    reporterId: string,
    grantHash: string | null,
    input: AbuseReportInput,
  ): Promise<{ id: string; createdAt: string }>;
}

function messageDto(message: {
  id: string;
  roomId: string;
  authorId: string;
  text: string;
  createdAt: Date;
  expiresAt: Date;
  author: { firstName: string; username: string | null };
}): RoomMessageDto {
  return {
    id: message.id,
    roomId: message.roomId,
    authorId: message.authorId,
    authorFirstName: message.author.firstName,
    authorUsername: message.author.username,
    text: message.text,
    createdAt: message.createdAt.toISOString(),
    expiresAt: message.expiresAt.toISOString(),
  };
}

function auditDto(audit: {
  id: string;
  roomId: string;
  actorUserId: string;
  targetUserId: string | null;
  targetMessageId: string | null;
  action: string;
  mutedUntil: Date | null;
  createdAt: Date;
  expiresAt: Date;
}): RoomModerationAuditDto {
  return {
    id: audit.id,
    roomId: audit.roomId,
    actorUserId: audit.actorUserId,
    targetUserId: audit.targetUserId,
    targetMessageId: audit.targetMessageId,
    action: audit.action as RoomModerationAuditDto["action"],
    mutedUntil: audit.mutedUntil?.toISOString() ?? null,
    createdAt: audit.createdAt.toISOString(),
    expiresAt: audit.expiresAt.toISOString(),
  };
}

function telegramBindingRecord(request: {
  id: string;
  roomId: string;
  requestedById: string;
  telegramUserId: bigint;
  requestId: number;
  preparedButtonId: string;
  status: string;
  message: string | null;
  expiresAt: Date;
}): TelegramBindingRequestRecord {
  return {
    id: request.id,
    roomId: request.roomId,
    requestedById: request.requestedById,
    telegramUserId: request.telegramUserId.toString(),
    requestId: request.requestId,
    preparedButtonId: request.preparedButtonId,
    status: request.status as TelegramBindingRequestRecord["status"],
    message: request.message,
    expiresAt: request.expiresAt,
  };
}

function toDto(row: RoomRow, userId: string | null, viewerCount = 0): RoomDto {
  const memberRole = row.members.find((member) => member.userId === userId)?.role;
  const role = userId ? (memberRole ?? null) : null;
  return {
    id: row.id,
    publicId: row.publicId,
    channelId: row.channelId,
    ownerId: row.ownerId,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    status: row.status,
    controlPolicy: row.controlPolicy,
    sourceProvider: row.sourceProvider,
    sourceKind: row.sourceKind,
    sourceId: row.sourceId,
    canonicalUrl: row.canonicalUrl,
    cachedTitle: row.cachedTitle,
    cachedThumbnailUrl: row.cachedThumbnailUrl,
    cachedCreatorName: row.cachedCreatorName,
    cachedLiveStatus: row.cachedLiveStatus as RoomDto["cachedLiveStatus"],
    cachedEmbeddable: row.cachedEmbeddable,
    metadataFetchedAt: row.metadataFetchedAt?.toISOString() ?? null,
    nowWatchingText: row.nowWatchingText,
    reactionsEnabled: row.reactionsEnabled,
    playback: {
      paused: row.playbackPaused,
      state: row.playbackState as "PLAYING" | "PAUSED" | "ENDED",
      positionSeconds: row.playbackPositionSeconds,
      changedAtServerMs: row.playbackUpdatedAt.getTime(),
      playbackRate: 1,
      version: row.playbackVersion,
      actorUserId: row.playbackActorUserId,
      liveEdge: row.playbackLiveEdge,
      updatedAt: row.playbackUpdatedAt.toISOString(),
    },
    linkedTelegramChatId: row.linkedTelegramChatId?.toString() ?? null,
    linkedTelegramChatUsername: row.linkedTelegramChatUsername,
    linkedTelegramChatUrl: row.linkedTelegramChatUrl,
    role,
    permissions: resolveRoomCapabilities(role, row.controlPolicy, row.sourceKind),
    viewerCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
  };
}

function roomSecret(row: RoomRow): RoomSecret {
  return {
    id: row.id,
    publicId: row.publicId,
    visibility: row.visibility,
    passwordHash: row.passwordHash,
    passwordRevision: row.passwordRevision,
    ownerId: row.ownerId,
    name: row.name,
    sourceProvider: row.sourceProvider,
    sourceKind: row.sourceKind,
    sourceId: row.sourceId,
    canonicalUrl: row.canonicalUrl,
    description: row.description,
    status: row.status,
    cachedTitle: row.cachedTitle,
    cachedThumbnailUrl: row.cachedThumbnailUrl,
    cachedCreatorName: row.cachedCreatorName,
    cachedLiveStatus: row.cachedLiveStatus as RoomSecret["cachedLiveStatus"],
    nowWatchingText: row.nowWatchingText,
    cachedEmbeddable: row.cachedEmbeddable,
  };
}

function metadataFields(metadata?: SourceMetadata) {
  return metadata
    ? {
        cachedTitle: metadata.title,
        cachedThumbnailUrl: metadata.thumbnailUrl,
        cachedCreatorName: metadata.creatorName,
        cachedLiveStatus: metadata.liveStatus,
        cachedEmbeddable: metadata.embeddable,
        metadataFetchedAt: metadata.fetchedAt ? new Date(metadata.fetchedAt) : null,
      }
    : null;
}

function newRoomRow(
  userId: string,
  input: CreateRoomInput,
  passwordHash: string | null,
  metadata?: SourceMetadata,
): RoomRow {
  const timestamp = new Date();
  return {
    id: randomUUID(),
    publicId: randomBytes(16).toString("base64url"),
    channelId: input.channelId,
    ownerId: userId,
    name: input.name,
    description: input.description,
    visibility: input.visibility,
    passwordHash,
    passwordRevision: 1,
    status: "DRAFT",
    controlPolicy: input.controlPolicy,
    sourceProvider: input.sourceProvider,
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    canonicalUrl: input.canonicalUrl,
    cachedTitle: metadata?.title ?? null,
    cachedThumbnailUrl: metadata?.thumbnailUrl ?? null,
    cachedCreatorName: metadata?.creatorName ?? null,
    cachedLiveStatus: metadata?.liveStatus ?? null,
    cachedEmbeddable: metadata?.embeddable ?? null,
    metadataFetchedAt: metadata?.fetchedAt ? new Date(metadata.fetchedAt) : null,
    nowWatchingText: input.nowWatchingText,
    reactionsEnabled: input.reactionsEnabled,
    playbackPaused: true,
    playbackState: "PAUSED",
    playbackPositionSeconds: 0,
    playbackRate: 1,
    playbackVersion: 0,
    playbackUpdatedAt: timestamp,
    playbackActorUserId: null,
    playbackLiveEdge: false,
    linkedTelegramChatId: null,
    linkedTelegramChatUsername: null,
    linkedTelegramChatUrl: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    startedAt: null,
    endedAt: null,
    members: [{ userId, role: "OWNER", lastSeenAt: timestamp }],
  };
}

function applyUpdate(
  row: RoomRow,
  input: UpdateRoomInput,
  passwordHash: string | null | undefined,
  metadata?: SourceMetadata,
  timestamp = new Date(),
): RoomRow {
  assertRoomStatusTransition(row.status, input.status);
  const next = { ...row, members: [...row.members] };
  for (const key of [
    "name",
    "description",
    "visibility",
    "controlPolicy",
    "status",
    "sourceProvider",
    "sourceKind",
    "sourceId",
    "canonicalUrl",
    "nowWatchingText",
    "reactionsEnabled",
  ] as const) {
    const value = input[key];
    if (value !== undefined) Object.assign(next, { [key]: value });
  }
  if (passwordHash !== undefined) {
    next.passwordHash = passwordHash;
    next.passwordRevision += 1;
  }
  const providerMetadata = metadataFields(metadata);
  if (providerMetadata) Object.assign(next, providerMetadata);
  if (input.status === "LIVE" && row.status !== "LIVE") {
    next.startedAt = timestamp;
    next.endedAt = null;
  }
  if (input.status === "ENDED" && row.status !== "ENDED") {
    next.endedAt = timestamp;
    next.playbackState = "ENDED";
    next.playbackPaused = true;
    next.playbackVersion += 1;
    next.playbackUpdatedAt = timestamp;
    next.playbackActorUserId = row.ownerId;
  }
  next.updatedAt = timestamp;
  return next;
}

export function assertRoomStatusTransition(
  current: "DRAFT" | "WAITING" | "LIVE" | "ENDED",
  requested: "DRAFT" | "WAITING" | "LIVE" | "ENDED" | undefined,
): void {
  if (!requested || requested === current) return;
  const allowed: Record<typeof current, ReadonlyArray<typeof current>> = {
    DRAFT: ["WAITING", "ENDED"],
    WAITING: ["LIVE", "ENDED"],
    LIVE: ["ENDED"],
    ENDED: [],
  };
  if (!allowed[current].includes(requested))
    throw new AppError(
      409,
      "INVALID_ROOM_STATUS_TRANSITION",
      `Переход комнаты ${current} → ${requested} запрещён.`,
    );
}

export class PrismaRoomStore implements RoomStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly identityStore: WatchRoomStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createRoom(
    userId: string,
    input: CreateRoomInput,
    passwordHash: string | null,
    metadata?: SourceMetadata,
  ): Promise<RoomDto> {
    if (!(await this.identityStore.ownsChannel(userId, input.channelId))) {
      throw new AppError(403, "ROOM_FORBIDDEN", "Создать комнату может только владелец канала.");
    }
    const row = await this.prisma.room.create({
      data: {
        publicId: randomBytes(16).toString("base64url"),
        channelId: input.channelId,
        ownerId: userId,
        name: input.name,
        description: input.description,
        visibility: input.visibility,
        passwordHash,
        controlPolicy: input.controlPolicy,
        sourceProvider: input.sourceProvider,
        sourceKind: input.sourceKind,
        sourceId: input.sourceId,
        canonicalUrl: input.canonicalUrl,
        cachedTitle: metadata?.title ?? null,
        cachedThumbnailUrl: metadata?.thumbnailUrl ?? null,
        cachedCreatorName: metadata?.creatorName ?? null,
        cachedLiveStatus: metadata?.liveStatus ?? null,
        cachedEmbeddable: metadata?.embeddable ?? null,
        metadataFetchedAt: metadata?.fetchedAt ? new Date(metadata.fetchedAt) : null,
        nowWatchingText: input.nowWatchingText,
        reactionsEnabled: input.reactionsEnabled,
        members: { create: { userId, role: "OWNER" } },
      },
      include: { members: true },
    });
    return toDto(row, userId);
  }

  async getSecret(publicId: string): Promise<RoomSecret | null> {
    const row = await this.prisma.room.findUnique({
      where: { publicId },
      include: { members: true },
    });
    return row ? roomSecret(row) : null;
  }

  async getSecretById(roomId: string): Promise<RoomSecret | null> {
    const row = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { members: true },
    });
    return row ? roomSecret(row) : null;
  }

  private async hasGrant(row: RoomRow, userId: string, tokenHash: string | null): Promise<boolean> {
    if (!tokenHash) return false;
    return (
      (await this.prisma.roomAccessGrant.count({
        where: {
          tokenHash,
          roomId: row.id,
          userId,
          passwordRevision: row.passwordRevision,
          expiresAt: { gt: new Date() },
        },
      })) === 1
    );
  }

  async getDetail(
    publicId: string,
    userId: string | null,
    grantHash: string | null,
    viewerCount = 0,
  ): Promise<RoomDetail | null> {
    const row = await this.prisma.room.findUnique({
      where: { publicId },
      include: { members: true },
    });
    if (!row) return null;
    if (
      userId &&
      (await this.prisma.roomUserBlock.count({ where: { roomId: row.id, userId } })) > 0
    )
      throw new AppError(403, "ROOM_ACCESS_DENIED", "Комната недоступна.");
    const privilegedRole = row.members.find((member) => member.userId === userId)?.role;
    const privileged = privilegedRole === "OWNER" || privilegedRole === "MODERATOR";
    if (
      row.visibility === "PRIVATE" &&
      (!userId || (!privileged && !(await this.hasGrant(row, userId, grantHash))))
    ) {
      return { locked: true, publicId: row.publicId, visibility: "PRIVATE" };
    }
    return { locked: false, room: toDto(row, userId, viewerCount) };
  }

  async listCatalog(
    userId: string | null,
    cursor: string | null,
    limit: number,
  ): Promise<RoomDto[]> {
    const rows = await this.prisma.room.findMany({
      where: {
        visibility: "PUBLIC",
        status: { in: ["WAITING", "LIVE"] },
        ...(userId ? { userBlocks: { none: { userId } } } : {}),
      },
      include: { members: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return rows.map((row) => toDto(row, userId));
  }

  async listChannelRooms(
    channelId: string,
    userId: string | null,
    cursor: string | null,
    limit: number,
  ): Promise<RoomDto[]> {
    const ownsChannel = userId ? await this.identityStore.ownsChannel(userId, channelId) : false;
    const rows = await this.prisma.room.findMany({
      where: ownsChannel
        ? { channelId }
        : {
            channelId,
            visibility: "PUBLIC",
            status: { not: "DRAFT" },
            ...(userId ? { userBlocks: { none: { userId } } } : {}),
          },
      include: { members: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return rows.map((row) => toDto(row, userId));
  }

  async createGrant(
    roomId: string,
    userId: string,
    tokenHash: string,
    passwordRevision: number,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.roomAccessGrant.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
      this.prisma.roomAccessGrant.create({
        data: { roomId, userId, tokenHash, passwordRevision, expiresAt },
      }),
    ]);
  }

  async joinRoom(publicId: string, userId: string, grantHash: string | null): Promise<RoomDto> {
    const detail = await this.getDetail(publicId, userId, grantHash);
    if (!detail || detail.locked) {
      throw new AppError(403, "ROOM_ACCESS_DENIED", "Комната недоступна.");
    }
    await this.prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: detail.room.id, userId } },
      create: { roomId: detail.room.id, userId, role: "VIEWER", lastSeenAt: this.now() },
      update: { lastSeenAt: this.now() },
    });
    const refreshed = await this.getDetail(publicId, userId, grantHash);
    if (!refreshed || refreshed.locked) throw new Error("ROOM_JOIN_FAILED");
    return refreshed.room;
  }

  async updateRoom(
    roomId: string,
    ownerId: string,
    input: UpdateRoomInput,
    passwordHash: string | null | undefined,
    metadata?: SourceMetadata,
  ): Promise<RoomDto> {
    const existing = await this.prisma.room.findFirst({ where: { id: roomId, ownerId } });
    if (!existing)
      throw new AppError(403, "ROOM_FORBIDDEN", "Изменять комнату может только владелец.");
    assertRoomStatusTransition(existing.status, input.status);
    const data: Record<string, unknown> = { ...input };
    delete data.password;
    const providerMetadata = metadataFields(metadata);
    if (providerMetadata) Object.assign(data, providerMetadata);
    if (passwordHash !== undefined) {
      data.passwordHash = passwordHash;
      data.passwordRevision = { increment: 1 };
    }
    if (input.status === "LIVE" && existing.status !== "LIVE") {
      data.startedAt = new Date();
      data.endedAt = null;
    }
    if (input.status === "ENDED" && existing.status !== "ENDED") {
      data.endedAt = this.now();
      data.playbackState = "ENDED";
      data.playbackPaused = true;
      data.playbackVersion = { increment: 1 };
      data.playbackUpdatedAt = this.now();
      data.playbackActorUserId = ownerId;
    }
    const row = await this.prisma.room.update({
      where: { id: roomId },
      data,
      include: { members: true },
    });
    return toDto(row, ownerId);
  }

  async deleteRoom(roomId: string, ownerId: string): Promise<void> {
    const result = await this.prisma.room.deleteMany({ where: { id: roomId, ownerId } });
    if (result.count === 0)
      throw new AppError(403, "ROOM_FORBIDDEN", "Удалить комнату может только владелец.");
  }

  async setModerator(
    roomId: string,
    ownerId: string,
    userId: string,
    enabled: boolean,
  ): Promise<void> {
    const room = await this.prisma.room.findFirst({ where: { id: roomId, ownerId } });
    if (!room) throw new AppError(403, "ROOM_FORBIDDEN", "Управлять ролями может только владелец.");
    if (userId === ownerId)
      throw new AppError(400, "INVALID_ROOM_ROLE", "Роль владельца нельзя изменить.");
    await this.prisma.roomMember.upsert({
      where: { roomId_userId: { roomId, userId } },
      create: { roomId, userId, role: enabled ? "MODERATOR" : "VIEWER" },
      update: { role: enabled ? "MODERATOR" : "VIEWER" },
    });
  }

  async listMembers(
    roomId: string,
    requestingUserId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RoomMemberDto[]> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new AppError(404, "ROOM_NOT_FOUND", "Комната не найдена.");
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: requestingUserId } },
    });
    if (!membership) throw new AppError(403, "ROOM_ACCESS_DENIED", "Комната недоступна.");
    const members = await this.prisma.roomMember.findMany({
      where: { roomId },
      include: { user: { select: { firstName: true, username: true } } },
      orderBy: [{ lastSeenAt: "desc" }, { userId: "asc" }],
      take: limit,
      ...(cursor ? { cursor: { roomId_userId: { roomId, userId: cursor } }, skip: 1 } : {}),
    });
    return members.map((member) => ({
      userId: member.userId,
      firstName: member.user.firstName,
      username: member.user.username,
      role: member.role,
    }));
  }

  async applyPlayback(
    publicId: string,
    userId: string,
    grantHash: string | null,
    command: PlaybackCommand,
  ): Promise<RoomDto> {
    const detail = await this.getDetail(publicId, userId, grantHash);
    if (!detail || detail.locked || !detail.room.permissions.includes(command.action)) {
      throw new AppError(403, "ROOM_CONTROL_FORBIDDEN", "Недостаточно прав для управления.");
    }
    if (detail.room.status === "ENDED")
      throw new AppError(409, "ROOM_ENDED", "Комната уже завершена.");
    const expectedVersion = command.expectedVersion ?? detail.room.playback.version;
    if (expectedVersion !== detail.room.playback.version)
      throw new AppError(409, "STALE_PLAYBACK_VERSION", "Состояние комнаты уже изменилось.");
    const isLive = detail.room.sourceKind === "LIVE";
    const timestamp = this.now();
    const state =
      command.action === "play"
        ? "PLAYING"
        : command.action === "pause"
          ? "PAUSED"
          : detail.room.playback.state;
    const elapsedSeconds =
      detail.room.playback.state === "PLAYING"
        ? Math.max(0, timestamp.getTime() - detail.room.playback.changedAtServerMs) / 1_000
        : 0;
    const authoritativePosition =
      command.action === "seek"
        ? command.positionSeconds
        : detail.room.playback.positionSeconds + elapsedSeconds;
    const updated = await this.prisma.room.updateMany({
      where: { id: detail.room.id, playbackVersion: expectedVersion },
      data: {
        playbackPaused: state !== "PLAYING",
        playbackState: state,
        playbackPositionSeconds: isLive ? 0 : authoritativePosition,
        playbackRate: 1,
        playbackVersion: { increment: 1 },
        playbackUpdatedAt: timestamp,
        playbackActorUserId: userId,
        playbackLiveEdge: isLive && command.action === "play",
      },
    });
    if (updated.count !== 1)
      throw new AppError(409, "STALE_PLAYBACK_VERSION", "Состояние комнаты уже изменилось.");
    const row = await this.prisma.room.findUniqueOrThrow({
      where: { id: detail.room.id },
      include: { members: true },
    });
    return toDto(row, userId);
  }

  async changeSource(
    publicId: string,
    userId: string,
    grantHash: string | null,
    source: PlayerSource,
    expectedVersion: number,
    metadata: SourceMetadata,
  ): Promise<RoomDto> {
    const detail = await this.getDetail(publicId, userId, grantHash);
    if (!detail || detail.locked || !detail.room.permissions.includes("change_source"))
      throw new AppError(403, "ROOM_CONTROL_FORBIDDEN", "Недостаточно прав для смены источника.");
    if (detail.room.status === "ENDED")
      throw new AppError(409, "ROOM_ENDED", "Завершённую комнату изменить нельзя.");
    if (detail.room.playback.version !== expectedVersion)
      throw new AppError(409, "STALE_PLAYBACK_VERSION", "Состояние комнаты уже изменилось.");
    const updated = await this.prisma.room.updateMany({
      where: { id: detail.room.id, playbackVersion: expectedVersion },
      data: {
        sourceProvider: source.provider,
        sourceKind: source.kind,
        sourceId: source.sourceId,
        canonicalUrl: source.canonicalUrl,
        ...metadataFields(metadata),
        playbackPaused: true,
        playbackState: "PAUSED",
        playbackPositionSeconds: 0,
        playbackRate: 1,
        playbackVersion: { increment: 1 },
        playbackUpdatedAt: this.now(),
        playbackActorUserId: userId,
        playbackLiveEdge: false,
      },
    });
    if (updated.count !== 1)
      throw new AppError(409, "STALE_PLAYBACK_VERSION", "Состояние комнаты уже изменилось.");
    const row = await this.prisma.room.findUniqueOrThrow({
      where: { id: detail.room.id },
      include: { members: true },
    });
    return toDto(row, userId);
  }

  async listMessages(
    publicId: string,
    userId: string,
    grantHash: string | null,
  ): Promise<RoomMessageDto[]> {
    const detail = await this.getDetail(publicId, userId, grantHash);
    if (!detail || detail.locked || !detail.room.role)
      throw new AppError(403, "ROOM_ACCESS_DENIED", "Комната недоступна.");
    await this.prisma.roomMessage.deleteMany({ where: { expiresAt: { lte: this.now() } } });
    const messages = await this.prisma.roomMessage.findMany({
      where: { roomId: detail.room.id },
      include: { author: { select: { firstName: true, username: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 40,
    });
    return messages.reverse().map(messageDto);
  }

  async createMessage(
    publicId: string,
    userId: string,
    grantHash: string | null,
    text: string,
  ): Promise<RoomMessageDto> {
    const detail = await this.getDetail(publicId, userId, grantHash);
    if (!detail || detail.locked || !detail.room.role)
      throw new AppError(403, "ROOM_ACCESS_DENIED", "Комната недоступна.");
    if (detail.room.status === "ENDED")
      throw new AppError(409, "ROOM_ENDED", "Чат завершённой комнаты доступен только для чтения.");
    return this.prisma.$transaction(async (transaction) => {
      const current = this.now();
      await transaction.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${detail.room.id}::uuid FOR UPDATE`;
      const restriction = await transaction.roomChatRestriction.findFirst({
        where: { roomId: detail.room.id, userId, mutedUntil: { gt: current } },
        orderBy: { mutedUntil: "desc" },
      });
      if (restriction)
        throw new AppError(
          403,
          "ROOM_CHAT_MUTED",
          `Чат временно недоступен. Осталось ${Math.max(1, Math.ceil((restriction.mutedUntil.getTime() - current.getTime()) / 60_000))} мин.${restriction.reason ? ` Причина: ${restriction.reason}` : ""}`,
          {
            mutedUntil: restriction.mutedUntil.toISOString(),
            retryAfterMs: Math.max(0, restriction.mutedUntil.getTime() - current.getTime()),
          },
        );
      const created = await transaction.roomMessage.create({
        data: {
          roomId: detail.room.id,
          authorId: userId,
          text,
          expiresAt: new Date(current.getTime() + 24 * 60 * 60_000),
        },
        include: { author: { select: { firstName: true, username: true } } },
      });
      await transaction.roomMessage.deleteMany({ where: { expiresAt: { lte: current } } });
      const overflow = await transaction.roomMessage.findMany({
        where: { roomId: detail.room.id },
        select: { id: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: 40,
      });
      if (overflow.length)
        await transaction.roomMessage.deleteMany({
          where: { id: { in: overflow.map((message) => message.id) } },
        });
      return messageDto(created);
    });
  }

  async deleteMessage(
    messageId: string,
    userId: string,
    expectedRoomId?: string,
  ): Promise<{ roomId: string }> {
    const message = await this.prisma.roomMessage.findUnique({
      where: { id: messageId },
      include: { room: { include: { members: true } } },
    });
    if (!message) throw new AppError(404, "ROOM_MESSAGE_NOT_FOUND", "Сообщение не найдено.");
    if (expectedRoomId && message.roomId !== expectedRoomId)
      throw new AppError(404, "ROOM_MESSAGE_NOT_FOUND", "Сообщение не найдено.");
    const role = message.room.members.find((member) => member.userId === userId)?.role ?? null;
    const permissions = resolveRoomCapabilities(
      role,
      message.room.controlPolicy,
      message.room.sourceKind,
    );
    const selfDelete = message.authorId === userId;
    if (!selfDelete && !permissions.includes("delete_chat_message"))
      throw new AppError(403, "ROOM_CHAT_FORBIDDEN", "Недостаточно прав для модерации чата.");
    const current = this.now();
    await this.prisma.$transaction([
      this.prisma.roomMessage.delete({ where: { id: messageId } }),
      this.prisma.roomModerationAudit.create({
        data: {
          roomId: message.roomId,
          actorUserId: userId,
          targetUserId: message.authorId,
          targetMessageId: messageId,
          action: selfDelete ? "SELF_DELETE_MESSAGE" : "MODERATOR_DELETE_MESSAGE",
          expiresAt: new Date(current.getTime() + 30 * 24 * 60 * 60_000),
        },
      }),
    ]);
    return { roomId: message.roomId };
  }

  async muteMember(
    roomId: string,
    userId: string,
    input: MuteRoomMemberInput,
  ): Promise<RoomChatRestrictionStatus> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { members: true },
    });
    if (!room) throw new AppError(404, "ROOM_NOT_FOUND", "Комната не найдена.");
    const role = room.members.find((member) => member.userId === userId)?.role ?? null;
    if (
      !resolveRoomCapabilities(role, room.controlPolicy, room.sourceKind).includes(
        "mute_chat_member",
      )
    )
      throw new AppError(403, "ROOM_CHAT_FORBIDDEN", "Недостаточно прав для модерации чата.");
    const target = room.members.find((member) => member.userId === input.userId);
    if (!target || target.role === "OWNER")
      throw new AppError(400, "INVALID_ROOM_MEMBER", "Участника нельзя заглушить.");
    const mutedUntil = new Date(this.now().getTime() + input.durationMinutes * 60_000);
    await this.prisma.$transaction([
      this.prisma.roomChatRestriction.create({
        data: {
          roomId,
          userId: input.userId,
          mutedById: userId,
          reason: input.reason || null,
          mutedUntil,
        },
      }),
      this.prisma.roomModerationAudit.create({
        data: {
          roomId,
          actorUserId: userId,
          targetUserId: input.userId,
          action: "MUTE_MEMBER",
          mutedUntil,
          expiresAt: new Date(this.now().getTime() + 30 * 24 * 60 * 60_000),
        },
      }),
    ]);
    return {
      mutedUntil: mutedUntil.toISOString(),
      reason: input.reason ?? null,
      mutedByRole: role === "OWNER" ? "OWNER" : "MODERATOR",
    };
  }

  async cleanupExpiredMessages(): Promise<number> {
    const current = this.now();
    const [result] = await this.prisma.$transaction([
      this.prisma.roomMessage.deleteMany({ where: { expiresAt: { lte: current } } }),
      this.prisma.session.deleteMany({
        where: { OR: [{ expiresAt: { lte: current } }, { revokedAt: { not: null } }] },
      }),
      this.prisma.authReplay.deleteMany({ where: { expiresAt: { lte: current } } }),
      this.prisma.roomAccessGrant.deleteMany({ where: { expiresAt: { lte: current } } }),
      this.prisma.roomChatRestriction.deleteMany({ where: { mutedUntil: { lte: current } } }),
      this.prisma.roomMember.deleteMany({
        where: {
          role: "VIEWER",
          lastSeenAt: { lte: new Date(current.getTime() - 30 * 24 * 60 * 60_000) },
        },
      }),
      this.prisma.roomModerationAudit.deleteMany({ where: { expiresAt: { lte: current } } }),
      this.prisma.telegramChatBindingRequest.updateMany({
        where: { status: "PENDING", expiresAt: { lte: current } },
        data: { status: "FAILED", message: "Срок выбора чата истёк.", consumedAt: current },
      }),
      this.prisma.telegramChatBindingRequest.deleteMany({
        where: { expiresAt: { lte: new Date(current.getTime() - 30 * 24 * 60 * 60_000) } },
      }),
      this.prisma.abuseReport.deleteMany({ where: { expiresAt: { lte: current } } }),
    ]);
    return result.count;
  }

  async getActiveChatRestriction(
    publicId: string,
    userId: string,
    grantHash: string | null,
  ): Promise<RoomChatRestrictionStatus | null> {
    const detail = await this.getDetail(publicId, userId, grantHash);
    if (!detail || detail.locked || !detail.room.role)
      throw new AppError(403, "ROOM_ACCESS_DENIED", "Комната недоступна.");
    const restriction = await this.prisma.roomChatRestriction.findFirst({
      where: { roomId: detail.room.id, userId, mutedUntil: { gt: this.now() } },
      orderBy: [{ mutedUntil: "desc" }, { createdAt: "desc" }],
    });
    if (!restriction) return null;
    const moderator = await this.prisma.roomMember.findUnique({
      where: {
        roomId_userId: { roomId: detail.room.id, userId: restriction.mutedById },
      },
    });
    return {
      mutedUntil: restriction.mutedUntil.toISOString(),
      reason: restriction.reason,
      mutedByRole: moderator?.role === "OWNER" ? "OWNER" : "MODERATOR",
    };
  }

  async listModerationAudit(roomId: string, userId: string): Promise<RoomModerationAuditDto[]> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room || room.ownerId !== userId)
      throw new AppError(403, "ROOM_FORBIDDEN", "Журнал модерации доступен владельцу.");
    const current = this.now();
    await this.prisma.roomModerationAudit.deleteMany({ where: { expiresAt: { lte: current } } });
    const audit = await this.prisma.roomModerationAudit.findMany({
      where: { roomId, expiresAt: { gt: current } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
    return audit.map(auditDto);
  }

  async createTelegramBindingRequest(input: {
    roomId: string;
    ownerId: string;
    telegramUserId: string;
    requestId: number;
    preparedButtonId: string;
    expiresAt: Date;
  }): Promise<TelegramBindingRequestRecord> {
    const room = await this.prisma.room.findUnique({ where: { id: input.roomId } });
    if (!room || room.ownerId !== input.ownerId)
      throw new AppError(403, "ROOM_FORBIDDEN", "Привязать обсуждение может только владелец.");
    const request = await this.prisma.telegramChatBindingRequest.create({
      data: {
        roomId: input.roomId,
        requestedById: input.ownerId,
        telegramUserId: BigInt(input.telegramUserId),
        requestId: input.requestId,
        preparedButtonId: input.preparedButtonId,
        expiresAt: input.expiresAt,
      },
    });
    return telegramBindingRecord(request);
  }

  async getTelegramBindingRequest(
    requestToken: string,
    ownerId: string,
  ): Promise<TelegramBindingRequestRecord | null> {
    const request = await this.prisma.telegramChatBindingRequest.findFirst({
      where: { id: requestToken, requestedById: ownerId },
    });
    return request ? telegramBindingRecord(request) : null;
  }

  async findTelegramBindingByRequestId(
    requestId: number,
  ): Promise<TelegramBindingRequestRecord | null> {
    const request = await this.prisma.telegramChatBindingRequest.findUnique({
      where: { requestId },
    });
    return request ? telegramBindingRecord(request) : null;
  }

  async failTelegramBindingRequest(requestToken: string, message: string): Promise<void> {
    await this.prisma.telegramChatBindingRequest.updateMany({
      where: { id: requestToken, status: "PENDING" },
      data: { status: "FAILED", message, consumedAt: this.now() },
    });
  }

  async completeTelegramBindingRequest(input: {
    requestToken: string;
    chatId: string;
    username: string;
    url: string;
  }): Promise<void> {
    const current = this.now();
    await this.prisma.$transaction(async (transaction) => {
      const request = await transaction.telegramChatBindingRequest.findUnique({
        where: { id: input.requestToken },
      });
      if (!request)
        throw new AppError(409, "TELEGRAM_BINDING_EXPIRED", "Запрос привязки уже недействителен.");
      const claimed = await transaction.telegramChatBindingRequest.updateMany({
        where: { id: request.id, status: "PENDING", expiresAt: { gt: current } },
        data: { status: "BOUND", message: null, consumedAt: current },
      });
      if (claimed.count !== 1)
        throw new AppError(409, "TELEGRAM_BINDING_EXPIRED", "Запрос привязки уже недействителен.");
      await transaction.room.update({
        where: { id: request.roomId },
        data: {
          linkedTelegramChatId: BigInt(input.chatId),
          linkedTelegramChatUsername: input.username,
          linkedTelegramChatUrl: input.url,
        },
      });
      await transaction.roomModerationAudit.create({
        data: {
          roomId: request.roomId,
          actorUserId: request.requestedById,
          action: "BIND_TELEGRAM_CHAT",
          expiresAt: new Date(current.getTime() + 30 * 24 * 60 * 60_000),
        },
      });
    });
  }

  async unbindTelegramChat(roomId: string, ownerId: string): Promise<RoomDto> {
    const room = await this.prisma.room.findFirst({ where: { id: roomId, ownerId } });
    if (!room)
      throw new AppError(403, "ROOM_FORBIDDEN", "Отвязать обсуждение может только владелец.");
    const current = this.now();
    const [updated] = await this.prisma.$transaction([
      this.prisma.room.update({
        where: { id: roomId },
        data: {
          linkedTelegramChatId: null,
          linkedTelegramChatUsername: null,
          linkedTelegramChatUrl: null,
        },
        include: { members: true },
      }),
      this.prisma.roomModerationAudit.create({
        data: {
          roomId,
          actorUserId: ownerId,
          action: "UNBIND_TELEGRAM_CHAT",
          expiresAt: new Date(current.getTime() + 30 * 24 * 60 * 60_000),
        },
      }),
    ]);
    return toDto(updated, ownerId);
  }

  async rehashPassword(
    roomId: string,
    currentHash: string,
    replacementHash: string,
  ): Promise<void> {
    await this.prisma.room.updateMany({
      where: { id: roomId, passwordHash: currentHash },
      data: { passwordHash: replacementHash },
    });
  }

  async hasActiveRoomsForChannel(channelId: string): Promise<boolean> {
    return (
      (await this.prisma.room.count({
        where: { channelId, status: { in: ["WAITING", "LIVE"] } },
      })) > 0
    );
  }

  async blockMember(
    roomId: string,
    ownerId: string,
    userId: string,
    reason: string | null,
  ): Promise<void> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { members: true },
    });
    const target = room?.members.find((member) => member.userId === userId);
    if (!room || room.ownerId !== ownerId)
      throw new AppError(403, "ROOM_FORBIDDEN", "Блокировать участников может только владелец.");
    if (!target || target.role === "OWNER")
      throw new AppError(400, "INVALID_ROOM_MEMBER", "Участника нельзя заблокировать.");
    const current = this.now();
    await this.prisma.$transaction([
      this.prisma.roomUserBlock.upsert({
        where: { roomId_userId: { roomId, userId } },
        create: { roomId, userId, blockedById: ownerId, reason },
        update: { blockedById: ownerId, reason, createdAt: current },
      }),
      this.prisma.roomModerationAudit.create({
        data: {
          roomId,
          actorUserId: ownerId,
          targetUserId: userId,
          action: "BLOCK_MEMBER",
          expiresAt: new Date(current.getTime() + 30 * 24 * 60 * 60_000),
        },
      }),
    ]);
  }

  async unblockMember(roomId: string, ownerId: string, userId: string): Promise<void> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room || room.ownerId !== ownerId)
      throw new AppError(403, "ROOM_FORBIDDEN", "Снимать блокировку может только владелец.");
    const current = this.now();
    await this.prisma.$transaction([
      this.prisma.roomUserBlock.deleteMany({ where: { roomId, userId } }),
      this.prisma.roomModerationAudit.create({
        data: {
          roomId,
          actorUserId: ownerId,
          targetUserId: userId,
          action: "UNBLOCK_MEMBER",
          expiresAt: new Date(current.getTime() + 30 * 24 * 60 * 60_000),
        },
      }),
    ]);
  }

  async createAbuseReport(
    publicId: string,
    reporterId: string,
    grantHash: string | null,
    input: AbuseReportInput,
  ): Promise<{ id: string; createdAt: string }> {
    const detail = await this.getDetail(publicId, reporterId, grantHash);
    if (!detail || detail.locked || !detail.room.role)
      throw new AppError(403, "ROOM_ACCESS_DENIED", "Комната недоступна.");
    if (input.targetUserId) {
      if (input.targetUserId === reporterId)
        throw new AppError(400, "INVALID_REPORT_TARGET", "Нельзя отправить жалобу на себя.");
      const target = await this.prisma.roomMember.count({
        where: { roomId: detail.room.id, userId: input.targetUserId },
      });
      if (!target)
        throw new AppError(400, "INVALID_REPORT_TARGET", "Участник не найден в комнате.");
    }
    const current = this.now();
    const report = await this.prisma.abuseReport.create({
      data: {
        roomId: detail.room.id,
        reporterId,
        targetUserId: input.targetUserId ?? null,
        category: input.category,
        details: input.details || null,
        expiresAt: new Date(current.getTime() + 90 * 24 * 60 * 60_000),
      },
    });
    return { id: report.id, createdAt: report.createdAt.toISOString() };
  }
}

export class MemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, RoomRow>();
  private readonly grants = new Map<
    string,
    { roomId: string; userId: string; passwordRevision: number; expiresAt: Date }
  >();
  private readonly messages = new Map<string, RoomMessageDto[]>();
  private readonly restrictions = new Map<
    string,
    {
      mutedUntil: Date;
      reason: string | null;
      mutedById: string;
      mutedByRole: "OWNER" | "MODERATOR";
    }
  >();
  private readonly moderationAudit: RoomModerationAuditDto[] = [];
  private readonly telegramBindingRequests = new Map<string, TelegramBindingRequestRecord>();
  private readonly userBlocks = new Set<string>();
  private readonly abuseReports: Array<{ id: string; expiresAt: Date }> = [];

  constructor(
    private readonly identityStore: WatchRoomStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createRoom(
    userId: string,
    input: CreateRoomInput,
    passwordHash: string | null,
    metadata?: SourceMetadata,
  ): Promise<RoomDto> {
    if (!(await this.identityStore.ownsChannel(userId, input.channelId)))
      throw new AppError(403, "ROOM_FORBIDDEN", "Создать комнату может только владелец канала.");
    const room = newRoomRow(userId, input, passwordHash, metadata);
    this.rooms.set(room.id, room);
    return toDto(room, userId);
  }

  async getSecret(publicId: string): Promise<RoomSecret | null> {
    const row = [...this.rooms.values()].find((room) => room.publicId === publicId);
    return row ? roomSecret(row) : null;
  }

  async getSecretById(roomId: string): Promise<RoomSecret | null> {
    const row = this.rooms.get(roomId);
    return row ? roomSecret(row) : null;
  }

  private hasGrant(row: RoomRow, userId: string, grantHash: string | null): boolean {
    if (!grantHash) return false;
    const grant = this.grants.get(grantHash);
    return Boolean(
      grant &&
      grant.roomId === row.id &&
      grant.userId === userId &&
      grant.passwordRevision === row.passwordRevision &&
      grant.expiresAt > this.now(),
    );
  }

  async getDetail(
    publicId: string,
    userId: string | null,
    grantHash: string | null,
    viewerCount = 0,
  ): Promise<RoomDetail | null> {
    const row = [...this.rooms.values()].find((room) => room.publicId === publicId);
    if (!row) return null;
    if (userId && this.userBlocks.has(`${row.id}:${userId}`))
      throw new AppError(403, "ROOM_ACCESS_DENIED", "Комната недоступна.");
    const role = row.members.find((member) => member.userId === userId)?.role;
    const privileged = role === "OWNER" || role === "MODERATOR";
    if (
      row.visibility === "PRIVATE" &&
      (!userId || (!privileged && !this.hasGrant(row, userId, grantHash)))
    ) {
      return { locked: true, publicId: row.publicId, visibility: "PRIVATE" };
    }
    return { locked: false, room: toDto(row, userId, viewerCount) };
  }

  async listCatalog(
    userId: string | null,
    cursor: string | null,
    limit: number,
  ): Promise<RoomDto[]> {
    const rows = [...this.rooms.values()]
      .filter(
        (room) =>
          room.visibility === "PUBLIC" &&
          ["WAITING", "LIVE"].includes(room.status) &&
          (!userId || !this.userBlocks.has(`${room.id}:${userId}`)),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const start = cursor ? Math.max(0, rows.findIndex((room) => room.id === cursor) + 1) : 0;
    return rows.slice(start, start + limit).map((room) => toDto(room, userId));
  }

  async listChannelRooms(
    channelId: string,
    userId: string | null,
    cursor: string | null,
    limit: number,
  ): Promise<RoomDto[]> {
    const owner = userId ? await this.identityStore.ownsChannel(userId, channelId) : false;
    const rows = [...this.rooms.values()]
      .filter(
        (room) =>
          room.channelId === channelId &&
          (!userId || owner || !this.userBlocks.has(`${room.id}:${userId}`)) &&
          (owner || (room.visibility === "PUBLIC" && room.status !== "DRAFT")),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const start = cursor ? Math.max(0, rows.findIndex((room) => room.id === cursor) + 1) : 0;
    return rows.slice(start, start + limit).map((room) => toDto(room, userId));
  }

  async createGrant(
    roomId: string,
    userId: string,
    tokenHash: string,
    passwordRevision: number,
    expiresAt: Date,
  ): Promise<void> {
    this.grants.set(tokenHash, { roomId, userId, passwordRevision, expiresAt });
  }

  async joinRoom(publicId: string, userId: string, grantHash: string | null): Promise<RoomDto> {
    const detail = await this.getDetail(publicId, userId, grantHash);
    if (!detail || detail.locked)
      throw new AppError(403, "ROOM_ACCESS_DENIED", "Комната недоступна.");
    const row = this.rooms.get(detail.room.id);
    if (!row) throw new Error("ROOM_JOIN_FAILED");
    const existingMember = row.members.find((member) => member.userId === userId);
    if (existingMember) existingMember.lastSeenAt = this.now();
    else row.members.push({ userId, role: "VIEWER", lastSeenAt: this.now() });
    return toDto(row, userId);
  }

  async updateRoom(
    roomId: string,
    ownerId: string,
    input: UpdateRoomInput,
    passwordHash: string | null | undefined,
    metadata?: SourceMetadata,
  ): Promise<RoomDto> {
    const row = this.rooms.get(roomId);
    if (!row || row.ownerId !== ownerId)
      throw new AppError(403, "ROOM_FORBIDDEN", "Изменять комнату может только владелец.");
    const updated = applyUpdate(row, input, passwordHash, metadata, this.now());
    this.rooms.set(roomId, updated);
    return toDto(updated, ownerId);
  }

  async deleteRoom(roomId: string, ownerId: string): Promise<void> {
    const row = this.rooms.get(roomId);
    if (!row || row.ownerId !== ownerId)
      throw new AppError(403, "ROOM_FORBIDDEN", "Удалить комнату может только владелец.");
    this.rooms.delete(roomId);
  }

  async setModerator(
    roomId: string,
    ownerId: string,
    userId: string,
    enabled: boolean,
  ): Promise<void> {
    const row = this.rooms.get(roomId);
    if (!row || row.ownerId !== ownerId)
      throw new AppError(403, "ROOM_FORBIDDEN", "Управлять ролями может только владелец.");
    if (userId === ownerId)
      throw new AppError(400, "INVALID_ROOM_ROLE", "Роль владельца нельзя изменить.");
    const user = await this.identityStore.getUserSummary(userId);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "Пользователь не найден.");
    const member = row.members.find((item) => item.userId === userId);
    if (member) member.role = enabled ? "MODERATOR" : "VIEWER";
    else
      row.members.push({
        userId,
        role: enabled ? "MODERATOR" : "VIEWER",
        lastSeenAt: this.now(),
      });
  }

  async listMembers(
    roomId: string,
    requestingUserId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RoomMemberDto[]> {
    const row = this.rooms.get(roomId);
    if (!row) throw new AppError(404, "ROOM_NOT_FOUND", "Комната не найдена.");
    if (!row.members.some((member) => member.userId === requestingUserId))
      throw new AppError(403, "ROOM_ACCESS_DENIED", "Комната недоступна.");
    const sorted = [...row.members].sort(
      (left, right) => right.lastSeenAt.getTime() - left.lastSeenAt.getTime(),
    );
    const start = cursor
      ? Math.max(0, sorted.findIndex((member) => member.userId === cursor) + 1)
      : 0;
    return Promise.all(
      sorted.slice(start, start + limit).map(async (member) => {
        const user = await this.identityStore.getUserSummary(member.userId);
        return {
          userId: member.userId,
          firstName: user?.firstName ?? "Участник",
          username: user?.username ?? null,
          role: member.role,
        };
      }),
    );
  }

  async applyPlayback(
    publicId: string,
    userId: string,
    grantHash: string | null,
    command: PlaybackCommand,
  ): Promise<RoomDto> {
    const detail = await this.getDetail(publicId, userId, grantHash);
    if (!detail || detail.locked || !detail.room.permissions.includes(command.action))
      throw new AppError(403, "ROOM_CONTROL_FORBIDDEN", "Недостаточно прав для управления.");
    if (detail.room.status === "ENDED")
      throw new AppError(409, "ROOM_ENDED", "Комната уже завершена.");
    const row = this.rooms.get(detail.room.id);
    if (!row) throw new Error("ROOM_NOT_FOUND");
    const expectedVersion = command.expectedVersion ?? row.playbackVersion;
    if (expectedVersion !== row.playbackVersion)
      throw new AppError(409, "STALE_PLAYBACK_VERSION", "Состояние комнаты уже изменилось.");
    const current = this.now();
    const wasPlaying = row.playbackState === "PLAYING";
    const elapsedSeconds = wasPlaying
      ? Math.max(0, current.getTime() - row.playbackUpdatedAt.getTime()) / 1_000
      : 0;
    if (command.action === "play") row.playbackState = "PLAYING";
    if (command.action === "pause") row.playbackState = "PAUSED";
    row.playbackPaused = row.playbackState !== "PLAYING";
    row.playbackPositionSeconds =
      row.sourceKind === "LIVE"
        ? 0
        : command.action === "seek"
          ? command.positionSeconds
          : row.playbackPositionSeconds + elapsedSeconds;
    row.playbackRate = 1;
    row.playbackVersion += 1;
    row.playbackUpdatedAt = current;
    row.playbackActorUserId = userId;
    row.playbackLiveEdge = row.sourceKind === "LIVE" && command.action === "play";
    row.updatedAt = this.now();
    return toDto(row, userId);
  }

  async changeSource(
    publicId: string,
    userId: string,
    grantHash: string | null,
    source: PlayerSource,
    expectedVersion: number,
    metadata: SourceMetadata,
  ): Promise<RoomDto> {
    const detail = await this.getDetail(publicId, userId, grantHash);
    if (!detail || detail.locked || !detail.room.permissions.includes("change_source"))
      throw new AppError(403, "ROOM_CONTROL_FORBIDDEN", "Недостаточно прав для смены источника.");
    if (detail.room.status === "ENDED")
      throw new AppError(409, "ROOM_ENDED", "Завершённую комнату изменить нельзя.");
    const row = this.rooms.get(detail.room.id);
    if (!row) throw new Error("ROOM_NOT_FOUND");
    if (row.playbackVersion !== expectedVersion)
      throw new AppError(409, "STALE_PLAYBACK_VERSION", "Состояние комнаты уже изменилось.");
    row.sourceProvider = source.provider;
    row.sourceKind = source.kind;
    row.sourceId = source.sourceId;
    row.canonicalUrl = source.canonicalUrl;
    Object.assign(row, metadataFields(metadata));
    row.playbackPaused = true;
    row.playbackState = "PAUSED";
    row.playbackPositionSeconds = 0;
    row.playbackRate = 1;
    row.playbackVersion += 1;
    row.playbackUpdatedAt = this.now();
    row.playbackActorUserId = userId;
    row.playbackLiveEdge = false;
    row.updatedAt = this.now();
    return toDto(row, userId);
  }

  async listMessages(
    publicId: string,
    userId: string,
    grantHash: string | null,
  ): Promise<RoomMessageDto[]> {
    const detail = await this.getDetail(publicId, userId, grantHash);
    if (!detail || detail.locked || !detail.room.role)
      throw new AppError(403, "ROOM_ACCESS_DENIED", "Комната недоступна.");
    const now = this.now();
    const current = (this.messages.get(detail.room.id) ?? []).filter(
      (message) => new Date(message.expiresAt) > now,
    );
    current.sort((left, right) =>
      left.createdAt === right.createdAt
        ? left.id.localeCompare(right.id)
        : left.createdAt.localeCompare(right.createdAt),
    );
    this.messages.set(detail.room.id, current);
    return current;
  }

  async createMessage(
    publicId: string,
    userId: string,
    grantHash: string | null,
    text: string,
  ): Promise<RoomMessageDto> {
    const detail = await this.getDetail(publicId, userId, grantHash);
    if (!detail || detail.locked || !detail.room.role)
      throw new AppError(403, "ROOM_ACCESS_DENIED", "Комната недоступна.");
    if (detail.room.status === "ENDED")
      throw new AppError(409, "ROOM_ENDED", "Чат завершённой комнаты доступен только для чтения.");
    const restriction = this.restrictions.get(`${detail.room.id}:${userId}`);
    if (restriction && restriction.mutedUntil > this.now())
      throw new AppError(
        403,
        "ROOM_CHAT_MUTED",
        `Чат временно недоступен. Осталось ${Math.max(1, Math.ceil((restriction.mutedUntil.getTime() - this.now().getTime()) / 60_000))} мин.${restriction.reason ? ` Причина: ${restriction.reason}` : ""}`,
        {
          mutedUntil: restriction.mutedUntil.toISOString(),
          retryAfterMs: Math.max(0, restriction.mutedUntil.getTime() - this.now().getTime()),
        },
      );
    const user = await this.identityStore.getUserSummary(userId);
    const createdAt = this.now();
    const message: RoomMessageDto = {
      id: randomUUID(),
      roomId: detail.room.id,
      authorId: userId,
      authorFirstName: user?.firstName ?? "Участник",
      authorUsername: user?.username ?? null,
      text,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + 24 * 60 * 60_000).toISOString(),
    };
    const messages = [...(this.messages.get(detail.room.id) ?? []), message]
      .sort((left, right) =>
        left.createdAt === right.createdAt
          ? left.id.localeCompare(right.id)
          : left.createdAt.localeCompare(right.createdAt),
      )
      .slice(-40);
    this.messages.set(detail.room.id, messages);
    return message;
  }

  async deleteMessage(
    messageId: string,
    userId: string,
    expectedRoomId?: string,
  ): Promise<{ roomId: string }> {
    for (const [roomId, messages] of this.messages) {
      if (expectedRoomId && roomId !== expectedRoomId) continue;
      if (!messages.some((message) => message.id === messageId)) continue;
      const room = this.rooms.get(roomId);
      if (!room) break;
      const role = room.members.find((member) => member.userId === userId)?.role ?? null;
      const message = messages.find((candidate) => candidate.id === messageId);
      const selfDelete = message?.authorId === userId;
      if (
        !selfDelete &&
        !resolveRoomCapabilities(role, room.controlPolicy, room.sourceKind).includes(
          "delete_chat_message",
        )
      )
        throw new AppError(403, "ROOM_CHAT_FORBIDDEN", "Недостаточно прав для модерации чата.");
      this.messages.set(
        roomId,
        messages.filter((message) => message.id !== messageId),
      );
      this.moderationAudit.push(
        this.newAudit({
          roomId,
          actorUserId: userId,
          targetUserId: message?.authorId ?? null,
          targetMessageId: messageId,
          action: selfDelete ? "SELF_DELETE_MESSAGE" : "MODERATOR_DELETE_MESSAGE",
        }),
      );
      return { roomId };
    }
    throw new AppError(404, "ROOM_MESSAGE_NOT_FOUND", "Сообщение не найдено.");
  }

  async muteMember(
    roomId: string,
    userId: string,
    input: MuteRoomMemberInput,
  ): Promise<RoomChatRestrictionStatus> {
    const room = this.rooms.get(roomId);
    if (!room) throw new AppError(404, "ROOM_NOT_FOUND", "Комната не найдена.");
    const role = room.members.find((member) => member.userId === userId)?.role ?? null;
    if (
      !resolveRoomCapabilities(role, room.controlPolicy, room.sourceKind).includes(
        "mute_chat_member",
      )
    )
      throw new AppError(403, "ROOM_CHAT_FORBIDDEN", "Недостаточно прав для модерации чата.");
    const target = room.members.find((member) => member.userId === input.userId);
    if (!target || target.role === "OWNER")
      throw new AppError(400, "INVALID_ROOM_MEMBER", "Участника нельзя заглушить.");
    const mutedUntil = new Date(this.now().getTime() + input.durationMinutes * 60_000);
    const reason = input.reason ?? null;
    this.restrictions.set(`${roomId}:${input.userId}`, {
      mutedUntil,
      reason,
      mutedById: userId,
      mutedByRole: role === "OWNER" ? "OWNER" : "MODERATOR",
    });
    this.moderationAudit.push(
      this.newAudit({
        roomId,
        actorUserId: userId,
        targetUserId: input.userId,
        targetMessageId: null,
        action: "MUTE_MEMBER",
        mutedUntil: mutedUntil.toISOString(),
      }),
    );
    return {
      mutedUntil: mutedUntil.toISOString(),
      reason,
      mutedByRole: role === "OWNER" ? "OWNER" : "MODERATOR",
    };
  }

  async cleanupExpiredMessages(): Promise<number> {
    let removed = 0;
    const current = this.now();
    for (const [roomId, messages] of this.messages) {
      const active = messages.filter((message) => new Date(message.expiresAt) > current);
      removed += messages.length - active.length;
      if (active.length) this.messages.set(roomId, active);
      else this.messages.delete(roomId);
    }
    for (const [tokenHash, grant] of this.grants)
      if (grant.expiresAt <= current) this.grants.delete(tokenHash);
    for (const [key, restriction] of this.restrictions)
      if (restriction.mutedUntil <= current) this.restrictions.delete(key);
    const viewerCutoff = current.getTime() - 30 * 24 * 60 * 60_000;
    for (const room of this.rooms.values())
      room.members = room.members.filter(
        (member) => member.role !== "VIEWER" || member.lastSeenAt.getTime() > viewerCutoff,
      );
    for (let index = this.moderationAudit.length - 1; index >= 0; index -= 1)
      if (new Date(this.moderationAudit[index]?.expiresAt ?? 0) <= current)
        this.moderationAudit.splice(index, 1);
    for (const request of this.telegramBindingRequests.values())
      if (request.status === "PENDING" && request.expiresAt <= current) {
        request.status = "FAILED";
        request.message = "Срок выбора чата истёк.";
      }
    for (const [id, request] of this.telegramBindingRequests)
      if (request.expiresAt.getTime() <= current.getTime() - 30 * 24 * 60 * 60_000)
        this.telegramBindingRequests.delete(id);
    for (let index = this.abuseReports.length - 1; index >= 0; index -= 1)
      if ((this.abuseReports[index]?.expiresAt.getTime() ?? 0) <= current.getTime())
        this.abuseReports.splice(index, 1);
    return removed;
  }

  async getActiveChatRestriction(
    publicId: string,
    userId: string,
    grantHash: string | null,
  ): Promise<RoomChatRestrictionStatus | null> {
    const detail = await this.getDetail(publicId, userId, grantHash);
    if (!detail || detail.locked || !detail.room.role)
      throw new AppError(403, "ROOM_ACCESS_DENIED", "Комната недоступна.");
    const restriction = this.restrictions.get(`${detail.room.id}:${userId}`);
    if (!restriction || restriction.mutedUntil <= this.now()) return null;
    return {
      mutedUntil: restriction.mutedUntil.toISOString(),
      reason: restriction.reason,
      mutedByRole: restriction.mutedByRole,
    };
  }

  async listModerationAudit(roomId: string, userId: string): Promise<RoomModerationAuditDto[]> {
    const room = this.rooms.get(roomId);
    if (!room || room.ownerId !== userId)
      throw new AppError(403, "ROOM_FORBIDDEN", "Журнал модерации доступен владельцу.");
    return this.moderationAudit
      .filter((item) => item.roomId === roomId && new Date(item.expiresAt) > this.now())
      .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 100);
  }

  async createTelegramBindingRequest(input: {
    roomId: string;
    ownerId: string;
    telegramUserId: string;
    requestId: number;
    preparedButtonId: string;
    expiresAt: Date;
  }): Promise<TelegramBindingRequestRecord> {
    const room = this.rooms.get(input.roomId);
    if (!room || room.ownerId !== input.ownerId)
      throw new AppError(403, "ROOM_FORBIDDEN", "Привязать обсуждение может только владелец.");
    const request: TelegramBindingRequestRecord = {
      id: randomUUID(),
      roomId: input.roomId,
      requestedById: input.ownerId,
      telegramUserId: input.telegramUserId,
      requestId: input.requestId,
      preparedButtonId: input.preparedButtonId,
      status: "PENDING",
      message: null,
      expiresAt: input.expiresAt,
    };
    this.telegramBindingRequests.set(request.id, request);
    return request;
  }

  async getTelegramBindingRequest(
    requestToken: string,
    ownerId: string,
  ): Promise<TelegramBindingRequestRecord | null> {
    const request = this.telegramBindingRequests.get(requestToken);
    return request?.requestedById === ownerId ? request : null;
  }

  async findTelegramBindingByRequestId(
    requestId: number,
  ): Promise<TelegramBindingRequestRecord | null> {
    return (
      [...this.telegramBindingRequests.values()].find(
        (request) => request.requestId === requestId,
      ) ?? null
    );
  }

  async failTelegramBindingRequest(requestToken: string, message: string): Promise<void> {
    const request = this.telegramBindingRequests.get(requestToken);
    if (request?.status === "PENDING") {
      request.status = "FAILED";
      request.message = message;
    }
  }

  async completeTelegramBindingRequest(input: {
    requestToken: string;
    chatId: string;
    username: string;
    url: string;
  }): Promise<void> {
    const request = this.telegramBindingRequests.get(input.requestToken);
    if (!request || request.status !== "PENDING" || request.expiresAt <= this.now())
      throw new AppError(409, "TELEGRAM_BINDING_EXPIRED", "Запрос привязки уже недействителен.");
    const room = this.rooms.get(request.roomId);
    if (!room) throw new AppError(404, "ROOM_NOT_FOUND", "Комната не найдена.");
    room.linkedTelegramChatId = BigInt(input.chatId);
    room.linkedTelegramChatUsername = input.username;
    room.linkedTelegramChatUrl = input.url;
    request.status = "BOUND";
    this.moderationAudit.push(
      this.newAudit({
        roomId: room.id,
        actorUserId: request.requestedById,
        targetUserId: null,
        targetMessageId: null,
        action: "BIND_TELEGRAM_CHAT",
      }),
    );
  }

  async unbindTelegramChat(roomId: string, ownerId: string): Promise<RoomDto> {
    const room = this.rooms.get(roomId);
    if (!room || room.ownerId !== ownerId)
      throw new AppError(403, "ROOM_FORBIDDEN", "Отвязать обсуждение может только владелец.");
    room.linkedTelegramChatId = null;
    room.linkedTelegramChatUsername = null;
    room.linkedTelegramChatUrl = null;
    this.moderationAudit.push(
      this.newAudit({
        roomId,
        actorUserId: ownerId,
        targetUserId: null,
        targetMessageId: null,
        action: "UNBIND_TELEGRAM_CHAT",
      }),
    );
    return toDto(room, ownerId);
  }

  async rehashPassword(
    roomId: string,
    currentHash: string,
    replacementHash: string,
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (room?.passwordHash === currentHash) room.passwordHash = replacementHash;
  }

  async hasActiveRoomsForChannel(channelId: string): Promise<boolean> {
    return [...this.rooms.values()].some(
      (room) => room.channelId === channelId && ["WAITING", "LIVE"].includes(room.status),
    );
  }

  async blockMember(
    roomId: string,
    ownerId: string,
    userId: string,
    reason: string | null,
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    const target = room?.members.find((member) => member.userId === userId);
    if (!room || room.ownerId !== ownerId)
      throw new AppError(403, "ROOM_FORBIDDEN", "Блокировать участников может только владелец.");
    if (!target || target.role === "OWNER")
      throw new AppError(400, "INVALID_ROOM_MEMBER", "Участника нельзя заблокировать.");
    this.userBlocks.add(`${roomId}:${userId}`);
    this.moderationAudit.push(
      this.newAudit({
        roomId,
        actorUserId: ownerId,
        targetUserId: userId,
        targetMessageId: null,
        action: "BLOCK_MEMBER",
      }),
    );
    void reason;
  }

  async unblockMember(roomId: string, ownerId: string, userId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room || room.ownerId !== ownerId)
      throw new AppError(403, "ROOM_FORBIDDEN", "Снимать блокировку может только владелец.");
    this.userBlocks.delete(`${roomId}:${userId}`);
    this.moderationAudit.push(
      this.newAudit({
        roomId,
        actorUserId: ownerId,
        targetUserId: userId,
        targetMessageId: null,
        action: "UNBLOCK_MEMBER",
      }),
    );
  }

  async createAbuseReport(
    publicId: string,
    reporterId: string,
    grantHash: string | null,
    input: AbuseReportInput,
  ): Promise<{ id: string; createdAt: string }> {
    const detail = await this.getDetail(publicId, reporterId, grantHash);
    if (!detail || detail.locked || !detail.room.role)
      throw new AppError(403, "ROOM_ACCESS_DENIED", "Комната недоступна.");
    if (
      input.targetUserId &&
      (input.targetUserId === reporterId ||
        !this.rooms
          .get(detail.room.id)
          ?.members.some((member) => member.userId === input.targetUserId))
    )
      throw new AppError(400, "INVALID_REPORT_TARGET", "Участник не найден в комнате.");
    const createdAt = this.now();
    const id = randomUUID();
    this.abuseReports.push({
      id,
      expiresAt: new Date(createdAt.getTime() + 90 * 24 * 60 * 60_000),
    });
    return { id, createdAt: createdAt.toISOString() };
  }

  private newAudit(input: {
    roomId: string;
    actorUserId: string;
    targetUserId: string | null;
    targetMessageId: string | null;
    action: RoomModerationAuditDto["action"];
    mutedUntil?: string;
  }): RoomModerationAuditDto {
    const current = this.now();
    return {
      id: randomUUID(),
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      targetMessageId: input.targetMessageId,
      action: input.action,
      mutedUntil: input.mutedUntil ?? null,
      createdAt: current.toISOString(),
      expiresAt: new Date(current.getTime() + 30 * 24 * 60 * 60_000).toISOString(),
    };
  }
}
