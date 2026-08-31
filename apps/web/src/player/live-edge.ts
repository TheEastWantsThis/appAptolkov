import type { PlaybackSnapshot, RoomDto } from "@watchroom/shared";

export function shouldReloadTwitchLiveEdge(
  playback: PlaybackSnapshot,
  room: Pick<RoomDto, "sourceProvider" | "sourceKind" | "sourceId">,
  lastAppliedVersion: number | null,
): boolean {
  return (
    playback.liveEdge &&
    playback.state === "PLAYING" &&
    playback.sourceProvider === "TWITCH" &&
    playback.sourceKind === "LIVE" &&
    room.sourceProvider === "TWITCH" &&
    room.sourceKind === "LIVE" &&
    room.sourceId === playback.sourceId &&
    playback.version !== lastAppliedVersion
  );
}
