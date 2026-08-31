import type { PlayerState, RoomDto } from "@watchroom/shared";

export type RoomConnectionState = "CONNECTING" | "CONNECTED" | "RECONNECTING" | "OFFLINE";

interface RoomStatusStackProps {
  connectionState: RoomConnectionState;
  roomStatus: RoomDto["status"];
  playerState: PlayerState;
  paused: boolean;
  playbackActorName?: string;
}

export function RoomStatusStack({
  connectionState,
  roomStatus,
  playerState,
  paused,
  playbackActorName,
}: RoomStatusStackProps) {
  return (
    <div aria-label="Состояние комнаты">
      {connectionState !== "CONNECTED" ? (
        <div className="room-state-banner room-state-warning" role="status">
          <strong>
            {connectionState === "RECONNECTING" ? "Переподключаемся…" : "Нет соединения"}
          </strong>
          <span>Команды временно недоступны; плеер и состояние комнаты не пересоздаются.</span>
        </div>
      ) : null}
      {roomStatus === "WAITING" || roomStatus === "DRAFT" ? (
        <div className="room-state-banner" role="status">
          <strong>Ожидаем начала</strong>
          <span>Владелец скоро запустит совместный просмотр.</span>
        </div>
      ) : null}
      {roomStatus === "ENDED" ? (
        <div className="room-state-banner room-state-ended" role="status">
          <strong>Комната завершена</strong>
          <span>Чат доступен для просмотра, управление остановлено.</span>
        </div>
      ) : null}
      {playerState === "LOADING" ? (
        <div className="room-state-banner" role="status">
          Загружаем официальный плеер…
        </div>
      ) : null}
      {playerState === "AUTOPLAY_BLOCKED" ? (
        <div className="room-state-banner room-state-warning" role="status">
          Нажмите «Начать просмотр» — Telegram требует пользовательский жест.
        </div>
      ) : null}
      {playerState === "BUFFERING" ? (
        <div className="room-state-banner" role="status">
          Буферизация… синхронизация продолжится после загрузки.
        </div>
      ) : null}
      {paused && roomStatus !== "ENDED" ? (
        <div className="room-state-banner" role="status">
          Пауза{playbackActorName ? ` от ${playbackActorName}` : ""}
        </div>
      ) : null}
    </div>
  );
}
