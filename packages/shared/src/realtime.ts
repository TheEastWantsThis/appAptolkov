import { z } from "zod";

import {
  CreateRoomMessageSchema,
  MuteRoomMemberSchema,
  RoomChatRestrictionStatusSchema,
  RoomMessageSchema,
  RoomSchema,
} from "./rooms.js";
import { ParseSourceRequestSchema } from "./sources.js";

export const RoomPublicIdSchema = z.string().regex(/^[A-Za-z0-9_-]{20,24}$/);
export const CommandIdSchema = z.string().uuid();
export const RoomJoinEventSchema = z.object({
  publicId: RoomPublicIdSchema,
  grantToken: z.string().min(20).max(256).nullable().default(null),
});
export const RoomLeaveEventSchema = z.object({ publicId: RoomPublicIdSchema });
export const HeartbeatEventSchema = z.object({ publicId: RoomPublicIdSchema });
const PlaybackBaseSchema = z.object({
  publicId: RoomPublicIdSchema,
  commandId: CommandIdSchema,
  expectedVersion: z.number().int().nonnegative(),
  positionSeconds: z.number().finite().nonnegative().max(31_536_000),
});
export const PlaybackPlayEventSchema = PlaybackBaseSchema;
export const PlaybackPauseEventSchema = PlaybackBaseSchema;
export const PlaybackSeekEventSchema = PlaybackBaseSchema;
export const PlaybackChangeSourceEventSchema = z.object({
  publicId: RoomPublicIdSchema,
  commandId: CommandIdSchema,
  expectedVersion: z.number().int().nonnegative(),
  source: ParseSourceRequestSchema,
});
export const ChatSendEventSchema = z.object({
  publicId: RoomPublicIdSchema,
  commandId: CommandIdSchema,
  ...CreateRoomMessageSchema.shape,
});
export const ChatDeleteEventSchema = z.object({
  publicId: RoomPublicIdSchema,
  commandId: CommandIdSchema,
  messageId: z.string().uuid(),
});
export const ChatMuteMemberEventSchema = z.object({
  publicId: RoomPublicIdSchema,
  commandId: CommandIdSchema,
  ...MuteRoomMemberSchema.shape,
});
export const ReactionSendEventSchema = z.object({
  publicId: RoomPublicIdSchema,
  commandId: CommandIdSchema,
  reaction: z.enum(["👍", "❤️", "😂", "😮", "🔥", "👏"]),
});

export const ReactionEventSchema = z.object({
  reaction: ReactionSendEventSchema.shape.reaction,
  actorUserId: z.string().uuid(),
  createdAtServerMs: z.number().int().nonnegative(),
  expiresAtServerMs: z.number().int().nonnegative(),
});

export const RoomSystemEventSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum([
    "MEMBER_JOINED",
    "PLAYBACK_STARTED",
    "PLAYBACK_PAUSED",
    "SOURCE_CHANGED",
    "ROOM_ENDED",
  ]),
  actorUserId: z.string().uuid(),
  createdAtServerMs: z.number().int().nonnegative(),
  expiresAtServerMs: z.number().int().nonnegative(),
});

export const PlaybackSnapshotSchema = z.object({
  sourceProvider: z.enum(["YOUTUBE", "TWITCH"]),
  sourceKind: z.enum(["VIDEO", "VOD", "LIVE"]),
  sourceId: z.string().min(1).max(128),
  state: z.enum(["PLAYING", "PAUSED", "ENDED"]),
  positionSeconds: z.number().finite().nonnegative(),
  changedAtServerMs: z.number().int().nonnegative(),
  playbackRate: z.literal(1),
  version: z.number().int().nonnegative(),
  actorUserId: z.string().uuid().nullable(),
  liveEdge: z.boolean(),
});
export const RoomSnapshotEventSchema = z.object({
  serverNowMs: z.number().int().nonnegative(),
  room: RoomSchema,
  playback: PlaybackSnapshotSchema,
  messages: z.array(RoomMessageSchema).max(40),
  chatRestriction: RoomChatRestrictionStatusSchema.nullable(),
});
export const PresenceEventSchema = z.object({
  viewerCount: z.number().int().nonnegative(),
  userIds: z.array(z.string().uuid()).max(1_000),
});
export const RealtimeErrorSchema = z.object({
  code: z.string().min(1).max(64),
  message: z.string().min(1).max(500),
  retryAfterMs: z.number().int().nonnegative().optional(),
  currentVersion: z.number().int().nonnegative().optional(),
  mutedUntil: z.string().datetime().optional(),
});

export type PlaybackSnapshot = z.infer<typeof PlaybackSnapshotSchema>;
export type RoomSnapshotEvent = z.infer<typeof RoomSnapshotEventSchema>;
export type RealtimeError = z.infer<typeof RealtimeErrorSchema>;
export type ReactionEvent = z.infer<typeof ReactionEventSchema>;
export type RoomSystemEvent = z.infer<typeof RoomSystemEventSchema>;

export function expectedPlaybackPosition(snapshot: PlaybackSnapshot, serverNowMs: number): number {
  if (snapshot.state !== "PLAYING" || snapshot.sourceKind === "LIVE")
    return snapshot.positionSeconds;
  return Math.max(
    0,
    snapshot.positionSeconds +
      (Math.max(0, serverNowMs - snapshot.changedAtServerMs) / 1_000) * snapshot.playbackRate,
  );
}

export type DriftCorrection =
  | { kind: "NONE" }
  | { kind: "SOFT"; targetSeconds: number }
  | { kind: "HARD"; targetSeconds: number };

export function chooseDriftCorrection(
  currentSeconds: number,
  snapshot: PlaybackSnapshot,
  serverNowMs: number,
  canSeek: boolean,
): DriftCorrection {
  if (!canSeek || snapshot.sourceKind === "LIVE") return { kind: "NONE" };
  const targetSeconds = expectedPlaybackPosition(snapshot, serverNowMs);
  const drift = Math.abs(currentSeconds - targetSeconds);
  if (drift < 1.5) return { kind: "NONE" };
  return { kind: drift > 5 ? "HARD" : "SOFT", targetSeconds };
}
