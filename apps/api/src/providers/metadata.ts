import { SourceMetadataSchema, type PlayerSource, type SourceMetadata } from "@watchroom/shared";

import type { ApiConfig } from "../config.js";

type Fetcher = typeof fetch;
type YouTubeItem = {
  snippet?: {
    title?: unknown;
    channelTitle?: unknown;
    thumbnails?: { high?: { url?: unknown }; default?: { url?: unknown } };
  };
  status?: { embeddable?: unknown };
  liveStreamingDetails?: { actualEndTime?: unknown; actualStartTime?: unknown };
};

function unavailable(
  source: PlayerSource,
  reason: SourceMetadata["unavailableReason"],
): SourceMetadata {
  return SourceMetadataSchema.parse({
    source,
    available: false,
    title: null,
    creatorName: null,
    thumbnailUrl: null,
    liveStatus: source.kind === "VOD" || source.kind === "VIDEO" ? "VOD" : "UNKNOWN",
    embeddable: null,
    fetchedAt: null,
    unavailableReason: reason,
  });
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

export class ProviderMetadataService {
  private readonly cache = new Map<string, { expiresAt: number; value: SourceMetadata }>();
  private twitchToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: ApiConfig,
    private readonly fetcher: Fetcher = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async get(source: PlayerSource): Promise<SourceMetadata> {
    const key = `${source.provider}:${source.kind}:${source.sourceId}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > this.now()) return cached.value;
    let value: SourceMetadata;
    try {
      value =
        source.provider === "YOUTUBE" ? await this.youtube(source) : await this.twitch(source);
    } catch {
      value = unavailable(source, "QUOTA_OR_PROVIDER_ERROR");
    }
    this.cache.set(key, {
      value,
      expiresAt: this.now() + this.config.PROVIDER_METADATA_TTL_SECONDS * 1_000,
    });
    return value;
  }

  private async youtube(source: PlayerSource): Promise<SourceMetadata> {
    if (!this.config.YOUTUBE_API_KEY) return unavailable(source, "CREDENTIALS_MISSING");
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,status,liveStreamingDetails");
    url.searchParams.set("id", source.sourceId);
    url.searchParams.set("key", this.config.YOUTUBE_API_KEY);
    const response = await this.fetcher(url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return unavailable(source, "QUOTA_OR_PROVIDER_ERROR");
    const body = (await response.json()) as { items?: YouTubeItem[] };
    const item = body.items?.[0];
    if (!item) return unavailable(source, "NOT_FOUND");
    const snippet = item.snippet ?? {};
    const live = item.liveStreamingDetails;
    const liveStatus =
      source.kind !== "LIVE"
        ? "VOD"
        : live?.actualEndTime
          ? "OFFLINE"
          : live?.actualStartTime
            ? "LIVE"
            : "UPCOMING";
    return SourceMetadataSchema.parse({
      source,
      available: true,
      title: text(snippet.title, 200),
      creatorName: text(snippet.channelTitle, 120),
      thumbnailUrl: text(snippet.thumbnails?.high?.url ?? snippet.thumbnails?.default?.url, 2048),
      liveStatus,
      embeddable: item.status?.embeddable === true,
      fetchedAt: new Date(this.now()).toISOString(),
      unavailableReason: null,
    });
  }

  private async token(): Promise<string> {
    if (this.twitchToken && this.twitchToken.expiresAt > this.now() + 60_000)
      return this.twitchToken.value;
    const url = new URL("https://id.twitch.tv/oauth2/token");
    const clientId = this.config.TWITCH_CLIENT_ID;
    const clientSecret = this.config.TWITCH_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("TWITCH_CREDENTIALS_MISSING");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("client_secret", clientSecret);
    url.searchParams.set("grant_type", "client_credentials");
    const response = await this.fetcher(url, {
      method: "POST",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error("TWITCH_TOKEN_FAILED");
    const body = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new Error("TWITCH_TOKEN_FAILED");
    this.twitchToken = {
      value: body.access_token,
      expiresAt: this.now() + (body.expires_in ?? 3_600) * 1_000,
    };
    return body.access_token;
  }

  private async twitch(source: PlayerSource): Promise<SourceMetadata> {
    if (!this.config.TWITCH_CLIENT_ID || !this.config.TWITCH_CLIENT_SECRET)
      return unavailable(source, "CREDENTIALS_MISSING");
    const clientId = this.config.TWITCH_CLIENT_ID;
    const token = await this.token();
    const read = async (url: URL) => {
      const response = await this.fetcher(url, {
        headers: { "Client-Id": clientId, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error("TWITCH_API_FAILED");
      return (await response.json()) as { data?: Array<Record<string, unknown>> };
    };
    let item: Record<string, unknown> | undefined;
    let user: Record<string, unknown> | undefined;
    if (source.kind === "LIVE") {
      const streamsUrl = new URL("https://api.twitch.tv/helix/streams");
      streamsUrl.searchParams.set("user_login", source.sourceId);
      const usersUrl = new URL("https://api.twitch.tv/helix/users");
      usersUrl.searchParams.set("login", source.sourceId);
      const [streams, users] = await Promise.all([read(streamsUrl), read(usersUrl)]);
      item = streams.data?.[0];
      user = users.data?.[0];
      if (!user) return unavailable(source, "NOT_FOUND");
    } else {
      const videosUrl = new URL("https://api.twitch.tv/helix/videos");
      videosUrl.searchParams.set("id", source.sourceId);
      item = (await read(videosUrl)).data?.[0];
    }
    if (!item && source.kind !== "LIVE") return unavailable(source, "NOT_FOUND");
    const thumbnail = item?.thumbnail_url ?? user?.profile_image_url;
    return SourceMetadataSchema.parse({
      source,
      available: Boolean(item) || Boolean(user),
      title: text(item?.title, 200),
      creatorName: text(item?.user_name ?? user?.display_name, 120),
      thumbnailUrl: text(
        typeof thumbnail === "string"
          ? thumbnail.replace("%{width}", "640").replace("%{height}", "360")
          : null,
        2048,
      ),
      liveStatus: source.kind === "LIVE" ? (item ? "LIVE" : "OFFLINE") : "VOD",
      embeddable: source.kind === "VOD" ? true : null,
      fetchedAt: new Date(this.now()).toISOString(),
      unavailableReason: null,
    });
  }
}
