"use client";

import {
  PlayerEventSchema,
  type PlayerEvent,
  type PlayerSource,
  type PlayerState,
} from "@watchroom/shared";
import { useEffect, useRef, useState } from "react";

import { createPlayerAdapter } from "../player/create-adapter";
import type { PlayerAdapter, PlayerErrorDetail } from "../player/types";

interface OfficialPlayerProps {
  source: PlayerSource;
  embeddable?: boolean | null;
  compact?: boolean;
  adapterFactory?: (container: HTMLElement, source: PlayerSource) => PlayerAdapter;
  onAdapterChange?: (adapter: PlayerAdapter | null) => void;
  onStateChange?: (state: PlayerState) => void;
}

const stateLabels: Record<PlayerState, string> = {
  IDLE: "Ожидание",
  LOADING: "Загрузка плеера…",
  READY: "Плеер готов",
  PLAYING: "Воспроизведение",
  PAUSED: "Пауза",
  ENDED: "Видео завершено",
  BUFFERING: "Буферизация…",
  ERROR: "Ошибка плеера",
  AUTOPLAY_BLOCKED: "Нажмите ▶ на видео",
  DESTROYED: "Плеер закрыт",
};

export function OfficialPlayer({
  source,
  embeddable = null,
  compact = false,
  adapterFactory = createPlayerAdapter,
  onAdapterChange,
  onStateChange,
}: OfficialPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<PlayerAdapter | null>(null);
  const [state, setState] = useState<PlayerState>("LOADING");
  const [error, setError] = useState<PlayerErrorDetail | null>(
    embeddable === false
      ? {
          code: "EMBEDDING_DISABLED",
          message: "Автор запретил встраивание этого видео.",
          originalUrl: source.canonicalUrl,
        }
      : null,
  );
  const [pictureInPictureVideo, setPictureInPictureVideo] = useState<HTMLVideoElement | null>(null);
  const sourceKey = `${source.provider}:${source.kind}:${source.sourceId}`;

  const effectiveState: PlayerState = embeddable === false ? "ERROR" : state;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || embeddable === false) return;
    const adapter = adapterFactory(container, source);
    adapterRef.current = adapter;
    onAdapterChange?.(adapter);
    const subscriptions = PlayerEventSchema.options.map((event: PlayerEvent) =>
      adapter.on(event, (detail) => {
        setState(event);
        onStateChange?.(event);
        if (detail.error) setError(detail.error);
        if (["READY", "PLAYING", "PAUSED"].includes(event)) onAdapterChange?.(adapter);
      }),
    );
    void adapter.loadSource(source).catch(() => {
      if (adapter.getState() !== "ERROR") {
        setState("ERROR");
        onStateChange?.("ERROR");
        setError({
          code: "PLAYER_LOAD_FAILED",
          message: "Не удалось загрузить официальный плеер.",
          originalUrl: source.canonicalUrl,
        });
      }
    });
    return () => {
      for (const unsubscribe of subscriptions) unsubscribe();
      adapter.destroy();
      if (adapterRef.current === adapter) adapterRef.current = null;
      onAdapterChange?.(null);
    };
    // sourceKey intentionally prevents recreation for equivalent source objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapterFactory, embeddable, onAdapterChange, onStateChange, sourceKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof document === "undefined" || !document.pictureInPictureEnabled) {
      setPictureInPictureVideo(null);
      return;
    }
    const video = container.querySelector("video");
    setPictureInPictureVideo(
      video && typeof video.requestPictureInPicture === "function" ? video : null,
    );
  }, [sourceKey, effectiveState]);

  async function requestPictureInPicture() {
    if (!pictureInPictureVideo) return;
    try {
      await pictureInPictureVideo.requestPictureInPicture();
    } catch {
      // User cancellation or a client policy is not a player failure.
    }
  }

  return (
    <section
      className={`official-player-shell${compact ? " official-player-compact" : ""}`}
      data-provider={source.provider}
    >
      <div
        className={`official-player-viewport viewport-${source.provider.toLowerCase()}`}
        data-testid="provider-player"
        ref={containerRef}
      />
      {source.provider === "TWITCH" ? (
        <p className="twitch-size-warning">
          Для Twitch требуется область минимум 400×300. Откройте Mini App шире или используйте
          оригинальную страницу.
        </p>
      ) : null}
      <div className="official-player-controls">
        <span className="player-state" role="status">
          {stateLabels[effectiveState]}
        </span>
        {pictureInPictureVideo ? (
          <button
            aria-label="Открыть системный режим картинка в картинке"
            className="secondary-button"
            type="button"
            onClick={() => void requestPictureInPicture()}
          >
            PiP
          </button>
        ) : null}
      </div>
      {effectiveState === "AUTOPLAY_BLOCKED" ? (
        <p className="player-help">
          Telegram или браузер заблокировал программный запуск. Нажмите ▶ прямо на видео.
        </p>
      ) : null}
      {error ? (
        <div className="player-error" role="alert">
          <p>{error.message}</p>
          <a
            className="secondary-button link-button"
            href={error.originalUrl ?? source.canonicalUrl}
            rel="noreferrer"
            target="_blank"
          >
            Открыть оригинал
          </a>
        </div>
      ) : null}
    </section>
  );
}
