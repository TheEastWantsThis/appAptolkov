"use client";

import type { PlayerSource } from "@watchroom/shared";
import { useState } from "react";

import { OfficialPlayer } from "../../../components/official-player";
import { RoomStatusStack } from "../../../components/room-status-stack";

const source: PlayerSource = {
  provider: "YOUTUBE",
  kind: "VIDEO",
  sourceId: "dQw4w9WgXcQ",
  canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
};

export function RoomPreview() {
  const [mode, setMode] = useState<"normal" | "sticky" | "hidden">("normal");
  return (
    <main className="app-shell room-page-shell" data-testid="room-preview">
      <header className="room-topbar">
        <button aria-label="Назад в каталог комнат" className="room-icon-button" type="button">
          ←
        </button>
        <div className="room-topbar-title">
          <strong>Ночной кинозал</strong>
          <span>
            <span className="vod-badge">VOD</span>
            <span>● 12</span>
          </span>
        </div>
        <details className="room-menu">
          <summary aria-label="Открыть меню комнаты">•••</summary>
        </details>
      </header>
      <section className="room-summary">
        <div>
          <p className="eyebrow">WatchRoom</p>
          <h1>Ночной кинозал</h1>
        </div>
        <p className="muted">Смотрим вместе без лишнего шума</p>
      </section>
      <RoomStatusStack
        connectionState="RECONNECTING"
        paused
        playerState="AUTOPLAY_BLOCKED"
        roomStatus="LIVE"
        playbackActorName="Анна"
      />
      <div className="room-player-anchor">
        <section className={`room-player-stage player-mode-${mode}`} data-provider="YOUTUBE">
          <div className="mini-player-actions">
            {mode === "normal" ? (
              <button type="button" onClick={() => setMode("sticky")}>
                Свернуть
              </button>
            ) : (
              <button type="button" onClick={() => setMode("normal")}>
                Развернуть
              </button>
            )}
            <button type="button" onClick={() => setMode("hidden")}>
              Закрыть
            </button>
          </div>
          <OfficialPlayer compact={mode !== "normal"} embeddable={false} source={source} />
        </section>
      </div>
      {mode === "hidden" ? (
        <button className="restore-player-button" type="button" onClick={() => setMode("normal")}>
          Вернуть плеер
        </button>
      ) : null}
      <section className="now-watching-card">
        <span>Сейчас смотрят</span>
        <strong>Демо-видео</strong>
        <small>WatchRoom</small>
      </section>
      <section className="reaction-strip" aria-label="Реакции">
        {["👍", "❤️", "😂", "😮", "🔥", "👏"].map((reaction) => (
          <button aria-label={`Отправить реакцию ${reaction}`} key={reaction} type="button">
            {reaction}
          </button>
        ))}
      </section>
      <section className="room-panel">
        <div className="room-section-heading">
          <h2>Участники</h2>
          <span>2 онлайн</span>
        </div>
        <ul className="member-list">
          <li>
            <span>Анна · @anna</span>
            <strong>владелец</strong>
          </li>
          <li>
            <span>Илья · @ilya</span>
            <strong>зритель</strong>
          </li>
        </ul>
      </section>
      <section className="room-panel chat-card">
        <div>
          <h2>Чат комнаты</h2>
          <p className="muted">Максимум 40 сообщений, хранение до 24 часов.</p>
        </div>
        <div className="chat-list">
          <article className="chat-message">
            <div>
              <strong>Анна</strong>
              <small>22:10</small>
            </div>
            <p>Начинаем через минуту 👋</p>
          </article>
        </div>
        <form className="chat-form">
          <label className="sr-only" htmlFor="preview-message">
            Сообщение
          </label>
          <input id="preview-message" placeholder="Сообщение…" />
          <button className="primary-button" type="button">
            Отправить
          </button>
        </form>
      </section>
    </main>
  );
}
