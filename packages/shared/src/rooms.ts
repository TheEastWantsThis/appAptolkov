import { z } from "zod";

export const RoomVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);
export const RoomStatusSchema = z.enum(["DRAFT", "WAITING", "LIVE", "ENDED"]);
export const RoomControlPolicySchema = z.enum(["OWNER_ONLY", "MODERATORS", "EVERYONE"]);
export const SourceProviderSchema = z.enum(["YOUTUBE", "TWITCH"]);
export const SourceKindSchema = z.enum(["VIDEO", "VOD", "LIVE"]);
export const RoomRoleSchema = z.enum(["OWNER", "MODERATOR", "VIEWER"]);
export const RoomCapabilitySchema = z.enum([
  "change_source",
  "play",
  "pause",
  "seek",
  "end_room",
  "manage_members",
  "delete_chat_message",
  "mute_chat_member",
]);

const HttpsUrlSchema = z.string().url().startsWith("https://").max(2048);
const PasswordSchema = z
  .string()
  .min(8)
  .max(128)
  .refine(
    (value) => new TextEncoder().encode(value).byteLength <= 128,
    "Пароль не должен превышать 128 байт в UTF-8",
  );

export const CreateRoomSchema = z
  .object({
    channelId: z.string().uuid(),
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(240).default(""),
    visibility: RoomVisibilitySchema.default("PUBLIC"),
    password: PasswordSchema.optional(),
    controlPolicy: RoomControlPolicySchema.default("OWNER_ONLY"),
    sourceProvider: SourceProviderSchema,
    sourceKind: SourceKindSchema,
    sourceId: z.string().trim().min(1).max(128),
    canonicalUrl: HttpsUrlSchema,
    nowWatchingText: z.string().trim().max(120).default(""),
    reactionsEnabled: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    if (value.visibility === "PRIVATE" && !value.password) {
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "Для закрытой комнаты нужен пароль",
      });
    }
    if (value.visibility === "PUBLIC" && value.password) {
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "Пароль допустим только для закрытой комнаты",
      });
    }
    if (value.sourceProvider === "TWITCH" && value.sourceKind === "VIDEO") {
      context.addIssue({
        code: "custom",
        path: ["sourceKind"],
        message: "Для Twitch выберите VOD или LIVE",
      });
    }
  });

export const UpdateRoomSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(240).optional(),
    visibility: RoomVisibilitySchema.optional(),
    password: PasswordSchema.optional(),
    controlPolicy: RoomControlPolicySchema.optional(),
    status: RoomStatusSchema.optional(),
    sourceProvider: SourceProviderSchema.optional(),
    sourceKind: SourceKindSchema.optional(),
    sourceId: z.string().trim().min(1).max(128).optional(),
    canonicalUrl: HttpsUrlSchema.optional(),
    nowWatchingText: z.string().trim().max(120).optional(),
    reactionsEnabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Нужно изменить хотя бы одно поле");

export const UnlockRoomSchema = z.object({ password: PasswordSchema });

export const PlaybackCommandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("play"),
    positionSeconds: z.number().finite().nonnegative(),
    expectedVersion: z.number().int().nonnegative().optional(),
  }),
  z.object({
    action: z.literal("pause"),
    positionSeconds: z.number().finite().nonnegative(),
    expectedVersion: z.number().int().nonnegative().optional(),
  }),
  z.object({
    action: z.literal("seek"),
    positionSeconds: z.number().finite().nonnegative(),
    expectedVersion: z.number().int().nonnegative().optional(),
  }),
]);

export const RoomPlaybackSchema = z.object({
  paused: z.boolean(),
  state: z.enum(["PLAYING", "PAUSED", "ENDED"]),
  positionSeconds: z.number().finite().nonnegative(),
  changedAtServerMs: z.number().int().nonnegative(),
  playbackRate: z.literal(1),
  version: z.number().int().nonnegative(),
  actorUserId: z.string().uuid().nullable(),
  liveEdge: z.boolean(),
  updatedAt: z.string().datetime(),
});

export const RoomSchema = z.object({
  id: z.string().uuid(),
  publicId: z.string().min(20).max(24),
  channelId: z.string().uuid(),
  ownerId: z.string().uuid(),
  name: z.string().min(2).max(80),
  description: z.string().max(240),
  visibility: RoomVisibilitySchema,
  status: RoomStatusSchema,
  controlPolicy: RoomControlPolicySchema,
  sourceProvider: SourceProviderSchema,
  sourceKind: SourceKindSchema,
  sourceId: z.string().min(1).max(128),
  canonicalUrl: HttpsUrlSchema,
  cachedTitle: z.string().max(200).nullable(),
  cachedThumbnailUrl: HttpsUrlSchema.nullable(),
  cachedCreatorName: z.string().max(120).nullable(),
  cachedLiveStatus: z.enum(["UNKNOWN", "LIVE", "OFFLINE", "UPCOMING", "VOD"]).nullable(),
  cachedEmbeddable: z.boolean().nullable(),
  metadataFetchedAt: z.string().datetime().nullable(),
  nowWatchingText: z.string().max(120),
  reactionsEnabled: z.boolean(),
  playback: RoomPlaybackSchema,
  linkedTelegramChatId: z.string().nullable(),
  linkedTelegramChatUsername: z.string().nullable(),
  linkedTelegramChatUrl: HttpsUrlSchema.nullable(),
  role: RoomRoleSchema.nullable(),
  permissions: z.array(RoomCapabilitySchema),
  viewerCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
});

export const LockedRoomSchema = z.object({
  publicId: z.string().min(20).max(24),
  visibility: z.literal("PRIVATE"),
  locked: z.literal(true),
});

export const RoomDetailSchema = z.union([
  z.object({ locked: z.literal(false), room: RoomSchema }),
  LockedRoomSchema,
]);

export const RoomPreviewSchema = z.object({
  publicId: z.string().min(20).max(24),
  name: z.string().min(2).max(80),
  description: z.string().max(240),
  visibility: RoomVisibilitySchema,
  status: RoomStatusSchema,
  sourceProvider: SourceProviderSchema,
  sourceKind: SourceKindSchema,
  cachedTitle: z.string().max(200).nullable(),
  cachedThumbnailUrl: HttpsUrlSchema.nullable(),
  cachedCreatorName: z.string().max(120).nullable(),
  cachedLiveStatus: z.enum(["UNKNOWN", "LIVE", "OFFLINE", "UPCOMING", "VOD"]).nullable(),
  nowWatchingText: z.string().max(120),
  viewerCount: z.number().int().nonnegative(),
  viewerNames: z.array(z.string().min(1).max(64)).max(3),
});

export const RoomCatalogSchema = z.object({
  rooms: z.array(RoomSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const RoomMemberSchema = z.object({
  userId: z.string().uuid(),
  firstName: z.string().min(1).max(64),
  username: z.string().nullable(),
  role: RoomRoleSchema,
});

export const RoomMembersSchema = z.object({ members: z.array(RoomMemberSchema) });

export const CreateRoomMessageSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine(
      (value) =>
        [...value].every((character) => {
          const codePoint = character.codePointAt(0) ?? 0;
          return (
            codePoint === 9 ||
            codePoint === 10 ||
            codePoint === 13 ||
            (codePoint >= 32 && codePoint !== 127)
          );
        }),
      "Управляющие символы не разрешены",
    )
    .transform((value) => value.normalize("NFC")),
});

export const RoomMessageSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  authorId: z.string().uuid(),
  authorFirstName: z.string().min(1).max(64),
  authorUsername: z.string().nullable(),
  text: z.string().min(1).max(500),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const RoomMessagesSchema = z.object({ messages: z.array(RoomMessageSchema).max(40) });

export const RoomChatRestrictionStatusSchema = z.object({
  mutedUntil: z.string().datetime(),
  reason: z.string().max(240).nullable(),
  mutedByRole: z.enum(["OWNER", "MODERATOR"]),
});

export const RoomModerationAuditActionSchema = z.enum([
  "SELF_DELETE_MESSAGE",
  "MODERATOR_DELETE_MESSAGE",
  "MUTE_MEMBER",
  "BIND_TELEGRAM_CHAT",
  "UNBIND_TELEGRAM_CHAT",
  "BLOCK_MEMBER",
  "UNBLOCK_MEMBER",
]);

export const RoomModerationAuditSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  actorUserId: z.string().uuid(),
  targetUserId: z.string().uuid().nullable(),
  targetMessageId: z.string().uuid().nullable(),
  action: RoomModerationAuditActionSchema,
  mutedUntil: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const TelegramChatBindingRequestSchema = z.object({
  requestToken: z.string().uuid(),
  preparedButtonId: z.string().min(1).max(256),
  expiresAt: z.string().datetime(),
});

export const TelegramChatBindingStatusSchema = z.object({
  status: z.enum(["PENDING", "BOUND", "FAILED", "EXPIRED"]),
  message: z.string().max(240).nullable(),
});

export const MuteRoomMemberSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().trim().max(240).optional(),
  durationMinutes: z.number().int().min(1).max(1_440),
});

export const BlockRoomMemberSchema = z.object({
  reason: z.string().trim().min(1).max(240).optional(),
});

export const AbuseReportSchema = z.object({
  targetUserId: z.string().uuid().optional(),
  category: z.enum(["SPAM", "HARASSMENT", "ILLEGAL_CONTENT", "OTHER"]),
  details: z.string().trim().max(500).optional(),
});

export const RoomInviteSchema = z.object({
  canonical: HttpsUrlSchema,
  compact: HttpsUrlSchema,
});

export type RoomCapability = z.infer<typeof RoomCapabilitySchema>;
export type RoomRole = z.infer<typeof RoomRoleSchema>;
export type RoomControlPolicy = z.infer<typeof RoomControlPolicySchema>;
export type SourceKind = z.infer<typeof SourceKindSchema>;
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type UpdateRoomInput = z.infer<typeof UpdateRoomSchema>;
export type PlaybackCommand = z.infer<typeof PlaybackCommandSchema>;
export type RoomDto = z.infer<typeof RoomSchema>;
export type RoomPreviewDto = z.infer<typeof RoomPreviewSchema>;
export type RoomMemberDto = z.infer<typeof RoomMemberSchema>;
export type RoomMessageDto = z.infer<typeof RoomMessageSchema>;
export type RoomChatRestrictionStatus = z.infer<typeof RoomChatRestrictionStatusSchema>;
export type RoomModerationAuditDto = z.infer<typeof RoomModerationAuditSchema>;
export type MuteRoomMemberInput = z.infer<typeof MuteRoomMemberSchema>;
export type BlockRoomMemberInput = z.infer<typeof BlockRoomMemberSchema>;
export type AbuseReportInput = z.infer<typeof AbuseReportSchema>;

export function resolveRoomCapabilities(
  role: RoomRole | null,
  policy: RoomControlPolicy,
  sourceKind: SourceKind,
): RoomCapability[] {
  if (!role) return [];
  const capabilities = new Set<RoomCapability>();
  if (role === "OWNER") {
    capabilities.add("change_source");
    capabilities.add("end_room");
    capabilities.add("manage_members");
    capabilities.add("delete_chat_message");
    capabilities.add("mute_chat_member");
  } else if (role === "MODERATOR") {
    capabilities.add("delete_chat_message");
    capabilities.add("mute_chat_member");
  }
  const canControlPlayback =
    role === "OWNER" || policy === "EVERYONE" || (role === "MODERATOR" && policy === "MODERATORS");
  if (canControlPlayback) {
    capabilities.add("play");
    capabilities.add("pause");
    if (sourceKind !== "LIVE") capabilities.add("seek");
  }
  return RoomCapabilitySchema.options.filter((capability) => capabilities.has(capability));
}

export function createTelegramRoomLinks(
  botUsername: string,
  appShortName: string,
  publicId: string,
): { canonical: string; compact: string } {
  const bot = botUsername.replace(/^@/, "");
  const base = `https://t.me/${encodeURIComponent(bot)}/${encodeURIComponent(appShortName)}`;
  const start = `room_${publicId}`;
  return {
    canonical: `${base}?startapp=${encodeURIComponent(start)}`,
    compact: `${base}?startapp=${encodeURIComponent(start)}&mode=compact`,
  };
}
