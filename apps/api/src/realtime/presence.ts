type PresenceEntry = {
  sockets: Map<string, number>;
  graceTimer: ReturnType<typeof setTimeout> | null;
};

export class PresenceRegistry {
  private readonly rooms = new Map<string, Map<string, PresenceEntry>>();

  constructor(
    private readonly heartbeatTimeoutMs: number,
    private readonly gracePeriodMs: number,
    private readonly now: () => number = Date.now,
    private readonly onChange: (roomId: string) => void = () => undefined,
  ) {}

  connect(roomId: string, userId: string, socketId: string): void {
    const users = this.rooms.get(roomId) ?? new Map<string, PresenceEntry>();
    const entry = users.get(userId) ?? { sockets: new Map<string, number>(), graceTimer: null };
    if (entry.graceTimer) clearTimeout(entry.graceTimer);
    entry.graceTimer = null;
    entry.sockets.set(socketId, this.now());
    users.set(userId, entry);
    this.rooms.set(roomId, users);
  }

  heartbeat(roomId: string, userId: string, socketId: string): boolean {
    const entry = this.rooms.get(roomId)?.get(userId);
    if (!entry?.sockets.has(socketId)) return false;
    entry.sockets.set(socketId, this.now());
    return true;
  }

  disconnect(roomId: string, userId: string, socketId: string, immediate = false): void {
    const entry = this.rooms.get(roomId)?.get(userId);
    if (!entry) return;
    entry.sockets.delete(socketId);
    if (entry.sockets.size > 0) return;
    if (immediate || this.gracePeriodMs === 0) this.removeUser(roomId, userId);
    else {
      if (entry.graceTimer) clearTimeout(entry.graceTimer);
      entry.graceTimer = setTimeout(() => this.removeUser(roomId, userId), this.gracePeriodMs);
      entry.graceTimer.unref?.();
    }
  }

  sweep(): string[] {
    const changedRooms = new Set<string>();
    const threshold = this.now() - this.heartbeatTimeoutMs;
    for (const [roomId, users] of this.rooms) {
      for (const [userId, entry] of users) {
        for (const [socketId, lastSeen] of entry.sockets) {
          if (lastSeen <= threshold) {
            entry.sockets.delete(socketId);
            changedRooms.add(roomId);
          }
        }
        if (entry.sockets.size === 0 && !entry.graceTimer)
          this.disconnect(roomId, userId, "", false);
      }
    }
    return [...changedRooms];
  }

  snapshot(roomId: string): { viewerCount: number; userIds: string[] } {
    const userIds = [...(this.rooms.get(roomId)?.entries() ?? [])]
      .filter(([, entry]) => entry.sockets.size > 0 || entry.graceTimer)
      .map(([userId]) => userId)
      .sort();
    return { viewerCount: userIds.length, userIds };
  }

  close(): void {
    for (const users of this.rooms.values())
      for (const entry of users.values()) if (entry.graceTimer) clearTimeout(entry.graceTimer);
    this.rooms.clear();
  }

  private removeUser(roomId: string, userId: string): void {
    const users = this.rooms.get(roomId);
    const entry = users?.get(userId);
    if (entry?.graceTimer) clearTimeout(entry.graceTimer);
    users?.delete(userId);
    if (users?.size === 0) this.rooms.delete(roomId);
    this.onChange(roomId);
  }
}
