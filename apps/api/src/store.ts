import { randomBytes, randomUUID } from "node:crypto";

import type {
  AddChannelMemberInput,
  ChannelDto,
  ChannelMemberDto,
  CreateChannelInput,
  UpdateChannelMemberInput,
  UpdateChannelInput,
  UserDto,
} from "@watchroom/shared";

import type { ValidatedTelegramIdentity } from "./auth/telegram.js";
import { AppError } from "./errors.js";
import type { PrismaClient } from "./generated/prisma/client.js";

export interface SessionRecord {
  user: UserDto;
  csrfTokenHash: string;
  expiresAt: Date;
}

export interface CreatedSession extends SessionRecord {
  tokenHash: string;
}

export interface WatchRoomStore {
  authenticate(
    input: ValidatedTelegramIdentity & {
      tokenHash: string;
      csrfTokenHash: string;
      expiresAt: Date;
    },
  ): Promise<UserDto>;
  findSession(tokenHash: string): Promise<SessionRecord | null>;
  revokeSession(tokenHash: string): Promise<void>;
  listChannels(userId: string): Promise<ChannelDto[]>;
  createChannel(userId: string, input: CreateChannelInput): Promise<ChannelDto>;
  getChannel(slug: string, userId: string | null): Promise<ChannelDto | null>;
  updateChannel(userId: string, channelId: string, input: UpdateChannelInput): Promise<ChannelDto>;
  deleteChannel(userId: string, channelId: string): Promise<void>;
  ownsChannel(userId: string, channelId: string): Promise<boolean>;
  listChannelMembers(userId: string, channelId: string): Promise<ChannelMemberDto[]>;
  addChannelMember(
    userId: string,
    channelId: string,
    input: AddChannelMemberInput,
  ): Promise<ChannelMemberDto>;
  updateChannelMember(
    userId: string,
    channelId: string,
    memberUserId: string,
    input: UpdateChannelMemberInput,
  ): Promise<ChannelMemberDto>;
  removeChannelMember(userId: string, channelId: string, memberUserId: string): Promise<void>;
  getUserSummary(userId: string): Promise<{ firstName: string; username: string | null } | null>;
}

type DbUser = {
  id: string;
  telegramId: bigint;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  status: "ACTIVE" | "BLOCKED";
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
};

function userDto(user: DbUser): UserDto {
  return {
    ...user,
    telegramId: user.telegramId.toString(),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastSeenAt: user.lastSeenAt.toISOString(),
  };
}

function channelDto(
  channel: {
    id: string;
    publicId: string;
    slug: string;
    ownerId: string;
    name: string;
    description: string;
    avatarUrl: string | null;
    visibility: "PUBLIC" | "PRIVATE";
    createdAt: Date;
    updatedAt: Date;
    members: Array<{ role: "OWNER" | "MODERATOR" | "MEMBER"; userId: string }>;
    _count: { members: number };
  },
  userId: string | null,
): ChannelDto {
  return {
    id: channel.id,
    publicId: channel.publicId,
    slug: channel.slug,
    ownerId: channel.ownerId,
    name: channel.name,
    description: channel.description,
    avatarUrl: channel.avatarUrl,
    visibility: channel.visibility,
    role: channel.members.find((member) => member.userId === userId)?.role ?? null,
    memberCount: channel._count.members,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  };
}

function channelMemberDto(member: {
  userId: string;
  role: "OWNER" | "MODERATOR" | "MEMBER";
  createdAt: Date;
  user: { username: string | null; firstName: string; photoUrl: string | null };
}): ChannelMemberDto {
  return {
    userId: member.userId,
    username: member.user.username,
    firstName: member.user.firstName,
    photoUrl: member.user.photoUrl,
    role: member.role,
    createdAt: member.createdAt.toISOString(),
  };
}

function isUniqueError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export class PrismaWatchRoomStore implements WatchRoomStore {
  constructor(private readonly prisma: PrismaClient) {}

  async authenticate(
    input: ValidatedTelegramIdentity & {
      tokenHash: string;
      csrfTokenHash: string;
      expiresAt: Date;
    },
  ): Promise<UserDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.authReplay.deleteMany({ where: { expiresAt: { lt: new Date() } } });
        await tx.authReplay.create({
          data: { digest: input.replayDigest, expiresAt: input.expiresAt },
        });
        const user = await tx.user.upsert({
          where: { telegramId: input.telegramId },
          create: {
            telegramId: input.telegramId,
            username: input.username,
            firstName: input.firstName,
            lastName: input.lastName,
            photoUrl: input.photoUrl,
          },
          update: {
            username: input.username,
            firstName: input.firstName,
            lastName: input.lastName,
            photoUrl: input.photoUrl,
            lastSeenAt: new Date(),
          },
        });
        if (user.status === "BLOCKED")
          throw new AppError(403, "USER_BLOCKED", "Доступ к WatchRoom заблокирован.");
        await tx.session.create({
          data: {
            tokenHash: input.tokenHash,
            csrfTokenHash: input.csrfTokenHash,
            expiresAt: input.expiresAt,
            telegramAuthDate: input.authDate,
            userId: user.id,
          },
        });
        return userDto(user);
      });
    } catch (error: unknown) {
      if (isUniqueError(error))
        throw new AppError(
          409,
          "INIT_DATA_REPLAY",
          "Этот Telegram initData уже использован. Откройте Mini App заново.",
        );
      throw error;
    }
  }

  async findSession(tokenHash: string): Promise<SessionRecord | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status === "BLOCKED"
    )
      return null;
    return {
      user: userDto(session.user),
      csrfTokenHash: session.csrfTokenHash,
      expiresAt: session.expiresAt,
    };
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async listChannels(userId: string): Promise<ChannelDto[]> {
    const channels = await this.prisma.channel.findMany({
      where: { members: { some: { userId } } },
      include: { members: true, _count: { select: { members: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return channels.map((channel) => channelDto(channel, userId));
  }

  async createChannel(userId: string, input: CreateChannelInput): Promise<ChannelDto> {
    try {
      const channel = await this.prisma.channel.create({
        data: {
          publicId: randomBytes(16).toString("base64url"),
          slug: input.slug,
          ownerId: userId,
          name: input.name,
          description: input.description,
          avatarUrl: input.avatarUrl || null,
          visibility: input.visibility,
          members: { create: { userId, role: "OWNER" } },
        },
        include: { members: true, _count: { select: { members: true } } },
      });
      return channelDto(channel, userId);
    } catch (error: unknown) {
      if (isUniqueError(error))
        throw new AppError(409, "SLUG_TAKEN", "Такой адрес канала уже занят.");
      throw error;
    }
  }

  async getChannel(slug: string, userId: string | null): Promise<ChannelDto | null> {
    const channel = await this.prisma.channel.findUnique({
      where: { slug },
      include: { members: true, _count: { select: { members: true } } },
    });
    if (!channel) return null;
    const dto = channelDto(channel, userId);
    if (channel.visibility === "PRIVATE" && dto.role === null) return null;
    return dto;
  }

  async updateChannel(
    userId: string,
    channelId: string,
    input: UpdateChannelInput,
  ): Promise<ChannelDto> {
    const owned = await this.prisma.channel.findFirst({
      where: { id: channelId, ownerId: userId },
    });
    if (!owned)
      throw new AppError(403, "CHANNEL_FORBIDDEN", "Изменять канал может только владелец.");
    try {
      const data: {
        name?: string;
        slug?: string;
        description?: string;
        avatarUrl?: string | null;
        visibility?: "PUBLIC" | "PRIVATE";
      } = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.slug !== undefined) data.slug = input.slug;
      if (input.description !== undefined) data.description = input.description;
      if (input.avatarUrl !== undefined)
        data.avatarUrl = input.avatarUrl === "" ? null : input.avatarUrl;
      if (input.visibility !== undefined) data.visibility = input.visibility;
      const channel = await this.prisma.channel.update({
        where: { id: channelId },
        data,
        include: { members: true, _count: { select: { members: true } } },
      });
      return channelDto(channel, userId);
    } catch (error: unknown) {
      if (isUniqueError(error))
        throw new AppError(409, "SLUG_TAKEN", "Такой адрес канала уже занят.");
      throw error;
    }
  }

  async deleteChannel(userId: string, channelId: string): Promise<void> {
    const result = await this.prisma.channel.deleteMany({
      where: {
        id: channelId,
        ownerId: userId,
        rooms: { none: { status: { in: ["WAITING", "LIVE"] } } },
      },
    });
    if (result.count === 0) {
      const owned = await this.prisma.channel.findFirst({
        where: { id: channelId, ownerId: userId },
      });
      if (!owned)
        throw new AppError(403, "CHANNEL_FORBIDDEN", "Удалить канал может только владелец.");
      throw new AppError(
        409,
        "CHANNEL_HAS_ACTIVE_ROOMS",
        "Сначала завершите активные комнаты канала.",
      );
    }
  }

  async ownsChannel(userId: string, channelId: string): Promise<boolean> {
    return (await this.prisma.channel.count({ where: { id: channelId, ownerId: userId } })) === 1;
  }

  async listChannelMembers(userId: string, channelId: string): Promise<ChannelMemberDto[]> {
    const membership = await this.prisma.channelMember.count({ where: { channelId, userId } });
    if (membership === 0)
      throw new AppError(
        403,
        "CHANNEL_MEMBERS_FORBIDDEN",
        "Список участников доступен участникам канала.",
      );
    const members = await this.prisma.channelMember.findMany({
      where: { channelId },
      include: { user: { select: { username: true, firstName: true, photoUrl: true } } },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }, { userId: "asc" }],
    });
    return members.map(channelMemberDto);
  }

  async addChannelMember(
    userId: string,
    channelId: string,
    input: AddChannelMemberInput,
  ): Promise<ChannelMemberDto> {
    if (!(await this.ownsChannel(userId, channelId)))
      throw new AppError(403, "CHANNEL_FORBIDDEN", "Участниками управляет только владелец.");
    const candidates = await this.prisma.user.findMany({
      where: { username: { equals: input.username, mode: "insensitive" }, status: "ACTIVE" },
      select: { id: true },
      take: 2,
    });
    if (candidates.length === 0)
      throw new AppError(
        404,
        "CHANNEL_MEMBER_USER_NOT_FOUND",
        "Пользователь должен сначала открыть WatchRoom, затем его можно добавить по Telegram username.",
      );
    if (candidates.length > 1)
      throw new AppError(
        409,
        "CHANNEL_MEMBER_USERNAME_AMBIGUOUS",
        "Username недавно сменился. Попросите пользователя снова открыть WatchRoom.",
      );
    const candidate = candidates[0];
    if (!candidate)
      throw new AppError(404, "CHANNEL_MEMBER_USER_NOT_FOUND", "Пользователь не найден.");
    try {
      const member = await this.prisma.channelMember.create({
        data: { channelId, userId: candidate.id, role: input.role },
        include: { user: { select: { username: true, firstName: true, photoUrl: true } } },
      });
      return channelMemberDto(member);
    } catch (error: unknown) {
      if (isUniqueError(error))
        throw new AppError(409, "CHANNEL_MEMBER_EXISTS", "Пользователь уже состоит в канале.");
      throw error;
    }
  }

  async updateChannelMember(
    userId: string,
    channelId: string,
    memberUserId: string,
    input: UpdateChannelMemberInput,
  ): Promise<ChannelMemberDto> {
    if (!(await this.ownsChannel(userId, channelId)))
      throw new AppError(403, "CHANNEL_FORBIDDEN", "Участниками управляет только владелец.");
    const existing = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: memberUserId } },
    });
    if (!existing)
      throw new AppError(404, "CHANNEL_MEMBER_NOT_FOUND", "Участник канала не найден.");
    if (existing.role === "OWNER")
      throw new AppError(409, "CHANNEL_OWNER_IMMUTABLE", "Роль владельца изменить нельзя.");
    const member = await this.prisma.channelMember.update({
      where: { channelId_userId: { channelId, userId: memberUserId } },
      data: { role: input.role },
      include: { user: { select: { username: true, firstName: true, photoUrl: true } } },
    });
    return channelMemberDto(member);
  }

  async removeChannelMember(
    userId: string,
    channelId: string,
    memberUserId: string,
  ): Promise<void> {
    if (!(await this.ownsChannel(userId, channelId)))
      throw new AppError(403, "CHANNEL_FORBIDDEN", "Участниками управляет только владелец.");
    const existing = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: memberUserId } },
    });
    if (!existing)
      throw new AppError(404, "CHANNEL_MEMBER_NOT_FOUND", "Участник канала не найден.");
    if (existing.role === "OWNER")
      throw new AppError(409, "CHANNEL_OWNER_IMMUTABLE", "Владельца нельзя удалить из канала.");
    await this.prisma.channelMember.delete({
      where: { channelId_userId: { channelId, userId: memberUserId } },
    });
  }

  async getUserSummary(
    userId: string,
  ): Promise<{ firstName: string; username: string | null } | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, username: true },
    });
  }
}

export class MemoryWatchRoomStore implements WatchRoomStore {
  private readonly users = new Map<string, DbUser>();
  private readonly telegramUsers = new Map<bigint, string>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly replay = new Set<string>();
  private readonly channels = new Map<string, ChannelDto>();
  private readonly channelMembers = new Map<
    string,
    Map<string, { role: "OWNER" | "MODERATOR" | "MEMBER"; createdAt: string }>
  >();

  async authenticate(
    input: ValidatedTelegramIdentity & {
      tokenHash: string;
      csrfTokenHash: string;
      expiresAt: Date;
    },
  ): Promise<UserDto> {
    if (this.replay.has(input.replayDigest))
      throw new AppError(
        409,
        "INIT_DATA_REPLAY",
        "Этот Telegram initData уже использован. Откройте Mini App заново.",
      );
    this.replay.add(input.replayDigest);
    const now = new Date();
    const existingId = this.telegramUsers.get(input.telegramId);
    const existing = existingId ? this.users.get(existingId) : undefined;
    const user: DbUser = existing
      ? {
          ...existing,
          username: input.username,
          firstName: input.firstName,
          lastName: input.lastName,
          photoUrl: input.photoUrl,
          updatedAt: now,
          lastSeenAt: now,
        }
      : {
          id: randomUUID(),
          telegramId: input.telegramId,
          username: input.username,
          firstName: input.firstName,
          lastName: input.lastName,
          photoUrl: input.photoUrl,
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
          lastSeenAt: now,
        };
    this.users.set(user.id, user);
    this.telegramUsers.set(user.telegramId, user.id);
    const dto = userDto(user);
    this.sessions.set(input.tokenHash, {
      user: dto,
      csrfTokenHash: input.csrfTokenHash,
      expiresAt: input.expiresAt,
    });
    return dto;
  }
  async findSession(tokenHash: string): Promise<SessionRecord | null> {
    const value = this.sessions.get(tokenHash);
    return value && value.expiresAt > new Date() ? value : null;
  }
  async revokeSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }
  async listChannels(userId: string): Promise<ChannelDto[]> {
    return [...this.channels.values()]
      .filter((channel) => this.channelMembers.get(channel.id)?.has(userId))
      .map((channel) => ({
        ...channel,
        role: this.channelMembers.get(channel.id)?.get(userId)?.role ?? null,
      }));
  }
  async createChannel(userId: string, input: CreateChannelInput): Promise<ChannelDto> {
    if ([...this.channels.values()].some((channel) => channel.slug === input.slug))
      throw new AppError(409, "SLUG_TAKEN", "Такой адрес канала уже занят.");
    const now = new Date().toISOString();
    const channel: ChannelDto = {
      id: randomUUID(),
      publicId: randomBytes(16).toString("base64url"),
      ownerId: userId,
      role: "OWNER",
      memberCount: 1,
      name: input.name,
      slug: input.slug,
      description: input.description,
      visibility: input.visibility,
      avatarUrl: input.avatarUrl || null,
      createdAt: now,
      updatedAt: now,
    };
    this.channels.set(channel.id, channel);
    this.channelMembers.set(channel.id, new Map([[userId, { role: "OWNER", createdAt: now }]]));
    return channel;
  }
  async getChannel(slug: string, userId: string | null): Promise<ChannelDto | null> {
    const channel = [...this.channels.values()].find((item) => item.slug === slug);
    const role = userId
      ? (this.channelMembers.get(channel?.id ?? "")?.get(userId)?.role ?? null)
      : null;
    if (!channel || (channel.visibility === "PRIVATE" && role === null)) return null;
    return { ...channel, role };
  }
  async updateChannel(
    userId: string,
    channelId: string,
    input: UpdateChannelInput,
  ): Promise<ChannelDto> {
    const channel = this.channels.get(channelId);
    if (!channel || channel.ownerId !== userId)
      throw new AppError(403, "CHANNEL_FORBIDDEN", "Изменять канал может только владелец.");
    if (
      input.slug &&
      [...this.channels.values()].some((item) => item.id !== channelId && item.slug === input.slug)
    )
      throw new AppError(409, "SLUG_TAKEN", "Такой адрес канала уже занят.");
    const updated: ChannelDto = {
      ...channel,
      name: input.name ?? channel.name,
      slug: input.slug ?? channel.slug,
      description: input.description ?? channel.description,
      visibility: input.visibility ?? channel.visibility,
      avatarUrl: input.avatarUrl === "" ? null : (input.avatarUrl ?? channel.avatarUrl),
      updatedAt: new Date().toISOString(),
    };
    this.channels.set(channelId, updated);
    return updated;
  }
  async deleteChannel(userId: string, channelId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel || channel.ownerId !== userId)
      throw new AppError(403, "CHANNEL_FORBIDDEN", "Удалить канал может только владелец.");
    this.channels.delete(channelId);
    this.channelMembers.delete(channelId);
  }
  async ownsChannel(userId: string, channelId: string): Promise<boolean> {
    return this.channels.get(channelId)?.ownerId === userId;
  }
  async listChannelMembers(userId: string, channelId: string): Promise<ChannelMemberDto[]> {
    const memberships = this.channelMembers.get(channelId);
    if (!memberships?.has(userId))
      throw new AppError(
        403,
        "CHANNEL_MEMBERS_FORBIDDEN",
        "Список участников доступен участникам канала.",
      );
    return [...memberships.entries()]
      .flatMap(([memberUserId, membership]) => {
        const user = this.users.get(memberUserId);
        if (!user) return [];
        return {
          userId: memberUserId,
          username: user.username,
          firstName: user.firstName,
          photoUrl: user.photoUrl,
          role: membership.role,
          createdAt: membership.createdAt,
        };
      })
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }
  async addChannelMember(
    userId: string,
    channelId: string,
    input: AddChannelMemberInput,
  ): Promise<ChannelMemberDto> {
    if (!(await this.ownsChannel(userId, channelId)))
      throw new AppError(403, "CHANNEL_FORBIDDEN", "Участниками управляет только владелец.");
    const candidates = [...this.users.values()].filter(
      (user) => user.status === "ACTIVE" && user.username?.toLowerCase() === input.username,
    );
    if (candidates.length === 0)
      throw new AppError(
        404,
        "CHANNEL_MEMBER_USER_NOT_FOUND",
        "Пользователь должен сначала открыть WatchRoom, затем его можно добавить по Telegram username.",
      );
    if (candidates.length > 1)
      throw new AppError(
        409,
        "CHANNEL_MEMBER_USERNAME_AMBIGUOUS",
        "Username недавно сменился. Попросите пользователя снова открыть WatchRoom.",
      );
    const target = candidates[0];
    const memberships = this.channelMembers.get(channelId);
    if (!target || !memberships)
      throw new AppError(404, "CHANNEL_MEMBER_USER_NOT_FOUND", "Пользователь не найден.");
    if (memberships.has(target.id))
      throw new AppError(409, "CHANNEL_MEMBER_EXISTS", "Пользователь уже состоит в канале.");
    const createdAt = new Date().toISOString();
    memberships.set(target.id, { role: input.role, createdAt });
    const channel = this.channels.get(channelId);
    if (!channel) throw new AppError(404, "CHANNEL_NOT_FOUND", "Канал не найден.");
    this.channels.set(channelId, { ...channel, memberCount: memberships.size });
    return {
      userId: target.id,
      username: target.username,
      firstName: target.firstName,
      photoUrl: target.photoUrl,
      role: input.role,
      createdAt,
    };
  }
  async updateChannelMember(
    userId: string,
    channelId: string,
    memberUserId: string,
    input: UpdateChannelMemberInput,
  ): Promise<ChannelMemberDto> {
    if (!(await this.ownsChannel(userId, channelId)))
      throw new AppError(403, "CHANNEL_FORBIDDEN", "Участниками управляет только владелец.");
    const memberships = this.channelMembers.get(channelId);
    if (!memberships)
      throw new AppError(404, "CHANNEL_MEMBER_NOT_FOUND", "Участник канала не найден.");
    const membership = memberships.get(memberUserId);
    if (!membership)
      throw new AppError(404, "CHANNEL_MEMBER_NOT_FOUND", "Участник канала не найден.");
    if (membership.role === "OWNER")
      throw new AppError(409, "CHANNEL_OWNER_IMMUTABLE", "Роль владельца изменить нельзя.");
    memberships.set(memberUserId, { ...membership, role: input.role });
    const target = this.users.get(memberUserId);
    if (!target) throw new AppError(404, "CHANNEL_MEMBER_NOT_FOUND", "Участник не найден.");
    return {
      userId: target.id,
      username: target.username,
      firstName: target.firstName,
      photoUrl: target.photoUrl,
      role: input.role,
      createdAt: membership.createdAt,
    };
  }
  async removeChannelMember(
    userId: string,
    channelId: string,
    memberUserId: string,
  ): Promise<void> {
    if (!(await this.ownsChannel(userId, channelId)))
      throw new AppError(403, "CHANNEL_FORBIDDEN", "Участниками управляет только владелец.");
    const memberships = this.channelMembers.get(channelId);
    if (!memberships)
      throw new AppError(404, "CHANNEL_MEMBER_NOT_FOUND", "Участник канала не найден.");
    const membership = memberships.get(memberUserId);
    if (!membership)
      throw new AppError(404, "CHANNEL_MEMBER_NOT_FOUND", "Участник канала не найден.");
    if (membership.role === "OWNER")
      throw new AppError(409, "CHANNEL_OWNER_IMMUTABLE", "Владельца нельзя удалить из канала.");
    memberships.delete(memberUserId);
    const channel = this.channels.get(channelId);
    if (!channel) throw new AppError(404, "CHANNEL_NOT_FOUND", "Канал не найден.");
    this.channels.set(channelId, { ...channel, memberCount: memberships.size });
  }
  async getUserSummary(
    userId: string,
  ): Promise<{ firstName: string; username: string | null } | null> {
    const user = this.users.get(userId);
    return user ? { firstName: user.firstName, username: user.username } : null;
  }
}
