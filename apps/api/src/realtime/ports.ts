export type Unsubscribe = () => void;

export interface RealtimeBus<TEvent = unknown> {
  publish(channel: string, event: TEvent): Promise<void>;
  subscribe(channel: string, listener: (event: TEvent) => void): Promise<Unsubscribe>;
}

export interface PresenceMember {
  readonly connectionCount: number;
  readonly userId: string;
}

export interface PresenceStore {
  addConnection(roomId: string, userId: string, socketId: string): Promise<void>;
  removeConnection(roomId: string, userId: string, socketId: string): Promise<void>;
  listMembers(roomId: string): Promise<readonly PresenceMember[]>;
}

export interface CommandDeduplicator {
  has(commandId: string): Promise<boolean>;
  remember(commandId: string, ttlMilliseconds: number): Promise<void>;
}

export interface RoomSequenceCoordinator {
  next(roomId: string): Promise<bigint>;
}
