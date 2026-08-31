import {
  playerCapabilities,
  type PlayerEvent,
  type PlayerSource,
  type PlayerState,
} from "@watchroom/shared";

import { PlayerEventEmitter } from "./event-emitter";
import { loadTwitchSdk } from "./script-loaders";
import type { PlayerAdapter, PlayerEventHandler } from "./types";
import { UnsupportedPlayerOperationError } from "./types";
import type { TwitchNamespace, TwitchPlayerInstance } from "./vendor-types";

type TwitchSdkLoader = () => Promise<TwitchNamespace>;

export function validateTwitchParents(parents: string[]): string[] {
  const normalized = [...new Set(parents.map((parent) => parent.trim().toLowerCase()))];
  const hostnamePattern = /^(?:localhost|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})$/;
  if (normalized.length === 0 || normalized.some((parent) => !hostnamePattern.test(parent)))
    throw new Error("INVALID_TWITCH_PARENT_CONFIGURATION");
  return normalized;
}

export class TwitchPlayerAdapter implements PlayerAdapter {
  private readonly events = new PlayerEventEmitter();
  private readonly parents: string[];
  private player: TwitchPlayerInstance | null = null;
  private source: PlayerSource | null = null;
  private state: PlayerState = "IDLE";

  constructor(
    private readonly container: HTMLElement,
    parents: string[],
    private readonly sdkLoader: TwitchSdkLoader = loadTwitchSdk,
  ) {
    this.parents = validateTwitchParents(parents);
  }

  get capabilities() {
    return this.source
      ? playerCapabilities(this.source)
      : { seek: false, currentTime: false, duration: false };
  }

  async loadSource(source: PlayerSource): Promise<void> {
    if (source.provider !== "TWITCH") throw new Error("TWITCH_SOURCE_REQUIRED");
    this.source = source;
    this.state = "LOADING";
    if (this.player) {
      if (source.kind === "LIVE") this.player.setChannel(source.sourceId);
      else this.player.setVideo(`v${source.sourceId}`, 0);
      this.setState("READY", "READY");
      return;
    }
    try {
      const sdk = await this.sdkLoader();
      if (!this.container.id) this.container.id = `twitch-player-${crypto.randomUUID()}`;
      await new Promise<void>((resolve) => {
        const options = {
          width: "100%",
          height: "100%",
          parent: this.parents,
          autoplay: false,
          muted: true,
          ...(source.kind === "LIVE"
            ? { channel: source.sourceId }
            : { video: `v${source.sourceId}` }),
        };
        this.player = new sdk.Player(this.container.id, options);
        this.player.addEventListener(sdk.Player.READY, () => {
          this.setState("READY", "READY");
          resolve();
        });
        this.player.addEventListener(sdk.Player.PLAY, () =>
          this.setState("BUFFERING", "BUFFERING"),
        );
        this.player.addEventListener(sdk.Player.PLAYING, () => this.setState("PLAYING", "PLAYING"));
        this.player.addEventListener(sdk.Player.PAUSE, () => this.setState("PAUSED", "PAUSED"));
        this.player.addEventListener(sdk.Player.ENDED, () => this.setState("ENDED", "ENDED"));
        this.player.addEventListener(sdk.Player.PLAYBACK_BLOCKED, () =>
          this.setState("AUTOPLAY_BLOCKED", "AUTOPLAY_BLOCKED"),
        );
        this.player.addEventListener(sdk.Player.OFFLINE, () => {
          this.state = "ERROR";
          this.events.emit({
            event: "ERROR",
            error: {
              code: "TWITCH_OFFLINE",
              message: "Twitch-канал сейчас не в эфире.",
              originalUrl: this.source?.canonicalUrl ?? null,
            },
          });
        });
      });
    } catch {
      this.state = "ERROR";
      this.events.emit({
        event: "ERROR",
        error: {
          code: "TWITCH_SDK_LOAD_FAILED",
          message: "Не удалось загрузить официальный Twitch-плеер.",
          originalUrl: source.canonicalUrl,
        },
      });
      throw new Error("TWITCH_SDK_LOAD_FAILED");
    }
  }

  play(): void {
    this.player?.play();
  }

  pause(): void {
    this.player?.pause();
  }

  seek(seconds: number): void {
    if (!this.capabilities.seek) throw new UnsupportedPlayerOperationError("seek");
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError("INVALID_SEEK_POSITION");
    this.player?.seek(seconds);
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
    this.player?.setMuted(muted);
  }

  on(event: PlayerEvent, handler: PlayerEventHandler): () => void {
    return this.events.on(event, handler);
  }

  destroy(): void {
    this.player?.destroy?.();
    this.container.replaceChildren();
    this.player = null;
    this.source = null;
    this.state = "DESTROYED";
    this.events.clear();
  }

  private setState(state: PlayerState, event: PlayerEvent): void {
    this.state = state;
    this.events.emit({ event });
  }
}
