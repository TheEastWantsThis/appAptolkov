import type { RoomDto } from "@watchroom/shared";
import Link from "next/link";

export function RoomCard({ room }: { room: RoomDto }) {
  const live = room.sourceKind === "LIVE" || room.status === "LIVE";
  return (
    <Link className="room-card" href={`/rooms/${room.publicId}`}>
      <div className="room-thumbnail">
        {room.cachedThumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" src={room.cachedThumbnailUrl} />
        ) : (
          <span>{room.sourceProvider === "YOUTUBE" ? "YT" : "TV"}</span>
        )}
        <strong className={live ? "live-badge" : "vod-badge"}>{live ? "LIVE" : "VOD"}</strong>
      </div>
      <div className="room-card-copy">
        <h3>{room.name}</h3>
        <p>{room.nowWatchingText || room.cachedTitle || "Источник выбран"}</p>
        <small>Смотрят сейчас: {room.viewerCount}</small>
      </div>
    </Link>
  );
}
