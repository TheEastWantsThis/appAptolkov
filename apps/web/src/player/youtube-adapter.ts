import {
  playerCapabilities,
  type PlayerEvent,
  type PlayerSource,
  type PlayerState,
} from "@watchroom/shared";

import { PlayerEventEmitter } from "./event-emitter";
import { loadYouTubeSdk } from "./script-loaders";
import type { PlayerAdapter, PlayerErrorDetail, PlayerEventHandler } from "./types";
import { UnsupportedPlayerOperationError } from "./types";
import type { YouTubeNamespace, YouTubePlayerInstance } from "./vendor-types";

type YouTubeSdkLoader = () => Promise<YouTubeNamespace>;

export class YouTubePlayerAdapter implements PlayerAdapter {
  private readonly events = new PlayerEventEmitter();
  private player: YouTubePlayerInstance | null = null;
  private source: PlayerSource | null = null;
  private state: PlayerState = "IDLE";
  private readyResolver: (() => void) | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly sdkLoader: YouTubeSdkLoader = loadYouTubeSdk,
  ) {}

  get capabilities() {
    return this.source
      ? playerCapabilities(this.source)
      : { seek: false, currentTime: false, duration: false };
  }

  async loadSource(source: PlayerSource): Promise<void> {
    if (source.provider !== "YOUTUBE") throw new Error("YOUTUBE_SOURCE_REQUIRED");
    this.source = source;
    this.state = "LOADING";
    if (this.player) {
      this.player.cueVideoById(source.sourceId);
      this.setState("READY", "READY");
      return;
    }
    try {
      const sdk = await this.sdkLoader();
      await new Promise<void>((resolve) => {
        this.readyResolver = resolve;
        this.player = new sdk.Player(this.container, {
          width: "100%",
          height: "100%",
          videoId: source.sourceId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            enablejsapi: 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              this.setState("READY", "READY");
              this.readyResolver?.();
              this.readyResolver = null;
            },
            onStateChange: ({ data }) => this.handleState(data),
            onError: ({ data }) => this.handleError(data),
            onAutoplayBlocked: () => this.setState("AUTOPLAY_BLOCKED", "AUTOPLAY_BLOCKED"),
          },
        });
      });
    } catch {
      this.emitError({
        code: "YOUTUBE_SDK_LOAD_FAILED",
        message: "Не удалось загрузить официальный YouTube-плеер.",
        originalUrl: source.canonicalUrl,
      });
      throw new Error("YOUTUBE_SDK_LOAD_FAILED");
    }
  }

  play(): void {
    this.player?.playVideo();
  }

  pause(): void {
    this.player?.pauseVideo();
  }

  seek(seconds: number): void {
    if (!this.capabilities.seek) throw new UnsupportedPlayerOperationError("seek");
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError("INVALID_SEEK_POSITION");
    this.player?.seekTo(seconds, true);
  }

  getCurrentTime(): number | null {
    if (!this.capabilities.currentTime || !this.player) return null;
    const value = this.player.getCurrentTime();
    return Number.isFinite(value) ? value : null;
  }

  getDuration(): number | null {
    if (!this.capabilities.duration || !this.player) return null;
    const value = this.player.getDuration();
    return Number.isFinite(value) ? value : null;
  }

  getState(): PlayerState {
    return this.state;
  }

  setMuted(muted: boolean): void {
    if (muted) this.player?.mute();
    else this.player?.unMute();
  }

  on(event: PlayerEvent, handler: PlayerEventHandler): () => void {
    return this.events.on(event, handler);
  }

  destroy(): void {
    this.player?.destroy();
    this.player = null;
    this.source = null;
    this.state = "DESTROYED";
    this.events.clear();
  }

  private setState(state: PlayerState, event: PlayerEvent): void {
    this.state = state;
    this.events.emit({ event });
  }

  private handleState(state: number): void {
    if (state === 0) this.setState("ENDED", "ENDED");
    else if (state === 1) this.setState("PLAYING", "PLAYING");
    else if (state === 2) this.setState("PAUSED", "PAUSED");
    else if (state === 3) this.setState("BUFFERING", "BUFFERING");
  }

  private handleError(code: number): void {
    const messages: Record<number, string> = {
      2: "YouTube отклонил идентификатор видео.",
      5: "Видео нельзя воспроизвести в HTML5-плеере.",
      100: "Видео удалено, скрыто или не найдено.",
      101: "Автор запретил встраивание этого видео.",
      150: "Автор запретил встраивание этого видео.",
      153: "YouTube не получил обязательную идентификацию приложения.",
    };
    this.emitError({
      code: `YOUTUBE_${code}`,
      message: messages[code] ?? "YouTube не смог воспроизвести видео.",
      originalUrl: this.source?.canonicalUrl ?? null,
    });
  }

  private emitError(error: PlayerErrorDetail): void {
    this.state = "ERROR";
    this.events.emit({ event: "ERROR", error });
  }
}
