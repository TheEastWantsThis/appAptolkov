import { z } from "zod";

const YouTubeVideoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
const TwitchChannelSchema = z
  .string()
  .toLowerCase()
  .regex(/^[a-z0-9_]{4,25}$/);
const TwitchVideoIdSchema = z.string().regex(/^\d{1,20}$/);

export const PlayerSourceSchema = z.union([
  z.object({
    provider: z.literal("YOUTUBE"),
    kind: z.enum(["VIDEO", "VOD", "LIVE"]),
    sourceId: YouTubeVideoIdSchema,
    canonicalUrl: z.string().url().startsWith("https://www.youtube.com/watch?v=").max(2048),
  }),
  z.object({
    provider: z.literal("TWITCH"),
    kind: z.literal("LIVE"),
    sourceId: TwitchChannelSchema,
    canonicalUrl: z.string().url().startsWith("https://www.twitch.tv/").max(2048),
  }),
  z.object({
    provider: z.literal("TWITCH"),
    kind: z.literal("VOD"),
    sourceId: TwitchVideoIdSchema,
    canonicalUrl: z.string().url().startsWith("https://www.twitch.tv/videos/").max(2048),
  }),
]);

export const ParseSourceRequestSchema = z.object({
  provider: z.enum(["YOUTUBE", "TWITCH"]),
  kind: z.enum(["VIDEO", "VOD", "LIVE"]),
  input: z.string().trim().min(1).max(2048),
});

export const ProviderLiveStatusSchema = z.enum(["UNKNOWN", "LIVE", "OFFLINE", "UPCOMING", "VOD"]);

export const SourceMetadataSchema = z.object({
  source: PlayerSourceSchema,
  available: z.boolean(),
  title: z.string().max(200).nullable(),
  creatorName: z.string().max(120).nullable(),
  thumbnailUrl: z.string().url().startsWith("https://").max(2048).nullable(),
  liveStatus: ProviderLiveStatusSchema,
  embeddable: z.boolean().nullable(),
  fetchedAt: z.string().datetime().nullable(),
  unavailableReason: z
    .enum(["CREDENTIALS_MISSING", "NOT_FOUND", "QUOTA_OR_PROVIDER_ERROR"])
    .nullable(),
});

export const PlayerStateSchema = z.enum([
  "IDLE",
  "LOADING",
  "READY",
  "PLAYING",
  "PAUSED",
  "ENDED",
  "BUFFERING",
  "ERROR",
  "AUTOPLAY_BLOCKED",
  "DESTROYED",
]);

export const PlayerEventSchema = z.enum([
  "READY",
  "PLAYING",
  "PAUSED",
  "ENDED",
  "BUFFERING",
  "ERROR",
  "AUTOPLAY_BLOCKED",
]);

export interface PlayerCapabilities {
  seek: boolean;
  currentTime: boolean;
  duration: boolean;
}

export type PlayerSource = z.infer<typeof PlayerSourceSchema>;
export type ParseSourceRequest = z.infer<typeof ParseSourceRequestSchema>;
export type SourceMetadata = z.infer<typeof SourceMetadataSchema>;
export type PlayerState = z.infer<typeof PlayerStateSchema>;
export type PlayerEvent = z.infer<typeof PlayerEventSchema>;

export class SourceParseError extends Error {
  readonly code = "INVALID_PROVIDER_SOURCE";

  constructor() {
    super("Ссылка или идентификатор источника недопустимы.");
    this.name = "SourceParseError";
  }
}

function safeUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    return url;
  } catch {
    return null;
  }
}

function youtubeSource(sourceId: string, kind: "VIDEO" | "VOD" | "LIVE"): PlayerSource {
  return PlayerSourceSchema.parse({
    provider: "YOUTUBE",
    kind,
    sourceId,
    canonicalUrl: `https://www.youtube.com/watch?v=${sourceId}`,
  });
}

export function parseYouTubeSource(
  input: string,
  kind: "VIDEO" | "VOD" | "LIVE" = "VIDEO",
): PlayerSource {
  const value = input.trim();
  if (YouTubeVideoIdSchema.safeParse(value).success) return youtubeSource(value, kind);
  const url = safeUrl(value);
  if (!url) throw new SourceParseError();
  const hostname = url.hostname.toLowerCase();
  let sourceId: string | null = null;
  let inferredKind = kind;
  if (hostname === "youtu.be") {
    const match = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname);
    sourceId = match?.[1] ?? null;
  } else if (
    [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "music.youtube.com",
      "youtube-nocookie.com",
      "www.youtube-nocookie.com",
    ].includes(hostname)
  ) {
    if (url.pathname === "/watch") {
      const values = url.searchParams.getAll("v");
      sourceId = values.length === 1 ? (values[0] ?? null) : null;
    } else {
      const match = /^\/(shorts|live|embed)\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname);
      sourceId = match?.[2] ?? null;
      if (match?.[1] === "live") inferredKind = "LIVE";
    }
  }
  if (!sourceId || !YouTubeVideoIdSchema.safeParse(sourceId).success) throw new SourceParseError();
  return youtubeSource(sourceId, inferredKind);
}

function twitchLiveSource(sourceId: string): PlayerSource {
  const channel = TwitchChannelSchema.parse(sourceId);
  if (
    new Set([
      "directory",
      "downloads",
      "drops",
      "friends",
      "inventory",
      "jobs",
      "search",
      "settings",
      "subscriptions",
      "turbo",
      "videos",
      "wallet",
    ]).has(channel)
  )
    throw new SourceParseError();
  return PlayerSourceSchema.parse({
    provider: "TWITCH",
    kind: "LIVE",
    sourceId: channel,
    canonicalUrl: `https://www.twitch.tv/${channel}`,
  });
}

function twitchVodSource(sourceId: string): PlayerSource {
  const videoId = TwitchVideoIdSchema.parse(sourceId.replace(/^v/, ""));
  return PlayerSourceSchema.parse({
    provider: "TWITCH",
    kind: "VOD",
    sourceId: videoId,
    canonicalUrl: `https://www.twitch.tv/videos/${videoId}`,
  });
}

export function parseTwitchSource(input: string, kind: "VOD" | "LIVE"): PlayerSource {
  const value = input.trim();
  if (kind === "VOD" && /^v?\d{1,20}$/.test(value)) return twitchVodSource(value);
  if (kind === "LIVE" && TwitchChannelSchema.safeParse(value).success)
    return twitchLiveSource(value);
  const url = safeUrl(value);
  if (!url || !["twitch.tv", "www.twitch.tv", "m.twitch.tv"].includes(url.hostname.toLowerCase()))
    throw new SourceParseError();
  if (kind === "VOD") {
    const match = /^\/videos\/(\d{1,20})\/?$/.exec(url.pathname);
    if (match?.[1]) return twitchVodSource(match[1]);
  } else {
    const match = /^\/([a-zA-Z0-9_]{4,25})\/?$/.exec(url.pathname);
    if (match?.[1]) return twitchLiveSource(match[1]);
  }
  throw new SourceParseError();
}

export function parsePlayerSource(input: ParseSourceRequest): PlayerSource {
  const parsed = ParseSourceRequestSchema.parse(input);
  if (parsed.provider === "YOUTUBE") return parseYouTubeSource(parsed.input, parsed.kind);
  if (parsed.kind === "VIDEO") throw new SourceParseError();
  return parseTwitchSource(parsed.input, parsed.kind);
}

export function normalizePlayerSource(input: {
  provider: "YOUTUBE" | "TWITCH";
  kind: "VIDEO" | "VOD" | "LIVE";
  sourceId: string;
  canonicalUrl: string;
}): PlayerSource {
  const fromId = parsePlayerSource({
    provider: input.provider,
    kind: input.kind,
    input: input.sourceId,
  });
  const fromUrl = parsePlayerSource({
    provider: input.provider,
    kind: input.kind,
    input: input.canonicalUrl,
  });
  if (
    fromId.provider !== fromUrl.provider ||
    fromId.kind !== fromUrl.kind ||
    fromId.sourceId !== fromUrl.sourceId
  )
    throw new SourceParseError();
  return fromUrl;
}

export function playerCapabilities(source: PlayerSource): PlayerCapabilities {
  if (source.provider === "TWITCH" && source.kind === "LIVE")
    return { seek: false, currentTime: false, duration: false };
  if (source.provider === "YOUTUBE" && source.kind === "LIVE")
    return { seek: false, currentTime: true, duration: true };
  return { seek: true, currentTime: true, duration: true };
}
