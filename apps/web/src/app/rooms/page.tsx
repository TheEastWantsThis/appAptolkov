"use client";

import type { RoomDto } from "@watchroom/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import { RoomCard } from "../../components/room-card";
import { useWatchRoom } from "../../components/watchroom-provider";

export default function RoomCatalogPage() {
  const { loading, request } = useWatchRoom();
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(cursor?: string) {
    try {
      const page = await request<{ rooms: RoomDto[]; nextCursor: string | null }>(
        `/v1/rooms/catalog${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      setRooms((current) => (cursor ? [...current, ...page.rooms] : page.rooms));
      setNextCursor(page.nextCursor);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить комнаты.");
    }
  }

  useEffect(() => {
    if (!loading) void Promise.resolve().then(() => load());
    // request is stable for the provider lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return (
    <main className="app-shell">
      <Link className="back-link" href="/">
        ← Главная
      </Link>
      <header className="catalog-header">
        <div>
          <p className="eyebrow">WatchRoom</p>
          <h1>Открытые комнаты</h1>
        </div>
      </header>
      {error ? <p className="error-text">{error}</p> : null}
      {!loading && !error && rooms.length === 0 ? (
        <section className="empty-card">
          <h2>Сейчас тихо</h2>
          <p className="muted">Открытые комнаты со статусом ожидания или LIVE появятся здесь.</p>
        </section>
      ) : null}
      <section className="room-grid" aria-label="Список комнат">
        {rooms.map((room) => (
          <RoomCard room={room} key={room.id} />
        ))}
      </section>
      {nextCursor ? (
        <button
          className="secondary-button load-more"
          type="button"
          onClick={() => void load(nextCursor)}
        >
          Показать ещё
        </button>
      ) : null}
    </main>
  );
}
