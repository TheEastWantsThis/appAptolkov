"use client";

import type { ChannelDto } from "@watchroom/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChannelAvatar } from "../components/channel-avatar";
import { useWatchRoom } from "../components/watchroom-provider";

export default function HomePage() {
  const { user, loading, error, logout, request } = useWatchRoom();
  const [channels, setChannels] = useState<ChannelDto[]>([]);
  const [publicChannels, setPublicChannels] = useState<ChannelDto[]>([]);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    void request<{ channels: ChannelDto[] }>("/v1/channels")
      .then((data) => setChannels(data.channels))
      .catch((reason: unknown) =>
        setChannelsError(reason instanceof Error ? reason.message : "Не удалось загрузить каналы."),
      );
    void request<{ channels: ChannelDto[] }>("/v1/channels/public")
      .then((data) => setPublicChannels(data.channels))
      .catch((reason: unknown) =>
        setChannelsError(
          reason instanceof Error ? reason.message : "Не удалось загрузить открытые каналы.",
        ),
      );
  }, [request, user]);
  if (loading)
    return (
      <main className="app-shell">
        <section className="loading-card">
          <span className="loading-spinner" />
          <p>Входим через Telegram…</p>
        </section>
      </main>
    );
  if (error || !user)
    return (
      <main className="app-shell">
        <section className="status-card">
          <h1>Не удалось войти</h1>
          <p className="muted">{error ?? "Откройте Mini App заново."}</p>
        </section>
      </main>
    );
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">WatchRoom</p>
          <h1>Привет, {user.firstName}</h1>
        </div>
        <div className="button-row">
          <Link className="primary-button link-button" href="/channels/new">
            Создать канал
          </Link>
          <button className="secondary-button" type="button" onClick={() => void logout()}>
            Выйти
          </button>
        </div>
      </header>
      <Link className="catalog-link" href="/rooms">
        Смотреть открытые комнаты →
      </Link>
      <section className="section-block" aria-labelledby="channels-title">
        <h2 id="channels-title">Ваши каналы</h2>
        {channelsError ? <p className="error-text">{channelsError}</p> : null}
        {!channelsError && channels.length === 0 ? (
          <div className="empty-card">
            <span className="empty-icon">＋</span>
            <h2>Первый канал — за минуту</h2>
            <p className="muted">
              Это внутренняя страница автора в WatchRoom. Telegram-канал автоматически не создаётся.
            </p>
            <Link className="primary-button link-button" href="/channels/new">
              Создать первый канал
            </Link>
          </div>
        ) : null}
        <div className="channel-grid">
          {channels.map((channel) => (
            <Link className="channel-card" href={`/channels/${channel.slug}`} key={channel.id}>
              <ChannelAvatar name={channel.name} url={channel.avatarUrl} />
              <div>
                <h2>{channel.name}</h2>
                <p className="muted">
                  @{channel.slug} · {channel.visibility === "PUBLIC" ? "Открытый" : "Закрытый"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="section-block" aria-labelledby="public-channels-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Каталог</p>
            <h2 id="public-channels-title">Открытые каналы</h2>
          </div>
          <span className="status-pill">{publicChannels.length}</span>
        </div>
        {publicChannels.length === 0 && !channelsError ? (
          <div className="empty-card">
            <h2>Открытых каналов пока нет</h2>
            <p className="muted">Создайте первый публичный канал — его увидят другие зрители.</p>
          </div>
        ) : null}
        <div className="channel-grid">
          {publicChannels.map((channel) => (
            <Link className="channel-card" href={`/channels/${channel.slug}`} key={channel.id}>
              <ChannelAvatar name={channel.name} url={channel.avatarUrl} />
              <div>
                <h2>{channel.name}</h2>
                <p className="muted">
                  @{channel.slug} · {channel.memberCount} участн.
                  {channel.role ? " · вы участник" : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
