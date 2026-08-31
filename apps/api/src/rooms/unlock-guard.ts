import { AppError } from "../errors.js";

interface AttemptState {
  failures: number;
  blockedUntil: number;
  touchedAt: number;
}

const genericMessage = "Не удалось открыть комнату. Проверьте пароль и попробуйте позже.";

export class RoomUnlockGuard {
  private readonly attempts = new Map<string, AttemptState>();

  constructor(
    private readonly now: () => Date,
    private readonly delay: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {}

  assertAllowed(key: string): void {
    this.cleanup();
    const state = this.attempts.get(key);
    if (state && state.blockedUntil > this.now().getTime()) {
      throw new AppError(429, "ROOM_UNLOCK_FAILED", genericMessage);
    }
  }

  async registerFailure(key: string): Promise<never> {
    const timestamp = this.now().getTime();
    const previous = this.attempts.get(key);
    const failures = (previous?.failures ?? 0) + 1;
    this.attempts.set(key, {
      failures,
      blockedUntil: failures >= 5 ? timestamp + 5 * 60_000 : 0,
      touchedAt: timestamp,
    });
    await this.delay(Math.min(750, 150 * failures));
    throw new AppError(failures >= 5 ? 429 : 403, "ROOM_UNLOCK_FAILED", genericMessage);
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  private cleanup(): void {
    if (this.attempts.size < 1_000) return;
    const cutoff = this.now().getTime() - 15 * 60_000;
    for (const [key, state] of this.attempts) {
      if (state.touchedAt < cutoff && state.blockedUntil <= this.now().getTime()) {
        this.attempts.delete(key);
      }
    }
  }
}
