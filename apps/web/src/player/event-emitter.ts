import type { PlayerEvent } from "@watchroom/shared";

import type { PlayerEventDetail, PlayerEventHandler } from "./types";

export class PlayerEventEmitter {
  private readonly listeners = new Map<PlayerEvent, Set<PlayerEventHandler>>();

  on(event: PlayerEvent, handler: PlayerEventHandler): () => void {
    const handlers = this.listeners.get(event) ?? new Set<PlayerEventHandler>();
    handlers.add(handler);
    this.listeners.set(event, handlers);
    return () => handlers.delete(handler);
  }

  emit(detail: PlayerEventDetail): void {
    for (const handler of this.listeners.get(detail.event) ?? []) handler(detail);
  }

  clear(): void {
    this.listeners.clear();
  }
}
