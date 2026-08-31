import type { PlayerSource } from "@watchroom/shared";

import { TwitchPlayerAdapter } from "./twitch-adapter";
import type { PlayerAdapter } from "./types";
import { YouTubePlayerAdapter } from "./youtube-adapter";

export function twitchParentsFromEnvironment(): string[] {
  const configured = process.env.NEXT_PUBLIC_TWITCH_PARENT_DOMAINS ?? "localhost";
  return configured
    .split(",")
    .map((parent) => parent.trim())
    .filter(Boolean);
}

export function createPlayerAdapter(
  container: HTMLElement,
  source: PlayerSource,
  twitchParents = twitchParentsFromEnvironment(),
): PlayerAdapter {
  return source.provider === "YOUTUBE"
    ? new YouTubePlayerAdapter(container)
    : new TwitchPlayerAdapter(container, twitchParents);
}
