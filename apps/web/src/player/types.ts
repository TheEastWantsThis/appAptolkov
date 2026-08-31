import type { PlayerCapabilities, PlayerEvent, PlayerSource, PlayerState } from "@watchroom/shared";

export interface PlayerErrorDetail {
  code: string;
  message: string;
  originalUrl: string | null;
}

export interface PlayerEventDetail {
  event: PlayerEvent;
  error?: PlayerErrorDetail;
}

export type PlayerEventHandler = (detail: PlayerEventDetail) => void;

export interface PlayerAdapter {
  readonly capabilities: PlayerCapabilities;
  loadSource(source: PlayerSource): Promise<void>;
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  getCurrentTime(): number | null;
  getDuration(): number | null;
  getState(): PlayerState;
  setMuted(muted: boolean): void;
  on(event: PlayerEvent, handler: PlayerEventHandler): () => void;
  destroy(): void;
}

export class UnsupportedPlayerOperationError extends Error {
  constructor(operation: string) {
    super(`Операция ${operation} недоступна для этого источника.`);
    this.name = "UnsupportedPlayerOperationError";
  }
}
