"use client";

import type { PlayerSource } from "@watchroom/shared";
import { useState } from "react";

import { OfficialPlayer } from "../../../components/official-player";

const source: PlayerSource = {
  provider: "YOUTUBE",
  kind: "VIDEO",
  sourceId: "dQw4w9WgXcQ",
  canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
};

export function RoomPreview() {
  const [mode, setMode] = useState<"normal" | "sticky">("normal");
  return (
    <main className="app-shell room-page-shell" data-testid="room-preview">
      <header className="room-topbar">
        <button aria-label="Назад в каталог комнат" className="room-icon-button" type="button">
          ←
        </button>
        <div className="room-topbar-title">
          <h1>Ночной кинозал</h1>
          <span>
            <span className="vod-badge">VOD</span>
            <span>● 12</span>
          </span>
        </div>
        <details className="room-menu">
          <summary aria-label="Открыть меню комнаты">•••</summary>
        </details>
      </header>
      <div className="room-player-anchor">
        <section className={`room-player-stage player-mode-${mode}`} data-provider="YOUTUBE">
          <div className="mini-player-actions">
            {mode === "normal" ? (
              <button
                aria-label="Закрепить компактный плеер"
                title="Закрепить сверху"
                type="button"
                onClick={() => setMode("sticky")}
              >
                ⌃
              </button>
            ) : (
              <button
                aria-label="Развернуть плеер"
                title="Развернуть"
                type="button"
                onClick={() => setMode("normal")}
              >
                ⛶
              </button>
            )}
          </div>
          <OfficialPlayer compact={mode !== "normal"} embeddable={false} source={source} />
        </section>
      </div>
      <section className="room-panel chat-card">
        <div className="chat-heading">
          <div>
            <h2>Демо-видео</h2>
            <p className="muted">WatchRoom</p>
          </div>
          <span className="connection-dot connection-connected">2 онлайн</span>
        </div>
        <div className="chat-list">
          <article className="chat-message">
            <div className="chat-message-meta">
              <span className="chat-avatar">А</span>
              <strong>Анна</strong>
              <small>22:10</small>
            </div>
            <p>Начинаем через минуту 👋</p>
          </article>
          <article className="chat-message chat-message-own">
            <div className="chat-message-meta">
              <strong>Вы</strong>
              <small>22:11</small>
            </div>
            <p>Я готов 🔥</p>
          </article>
        </div>
        <div className="chat-reactions">
          <div className="reaction-strip" aria-label="Реакции">
            {["👍", "❤️", "😂", "😮", "🔥", "👏"].map((reaction) => (
              <button aria-label={`Отправить реакцию ${reaction}`} key={reaction} type="button">
                {reaction}
              </button>
            ))}
          </div>
        </div>
        <form className="chat-form">
          <label className="sr-only" htmlFor="preview-message">
            Сообщение
          </label>
          <input id="preview-message" placeholder="Сообщение…" />
          <button aria-label="Отправить сообщение" className="chat-send-button" type="button">
            ➤
          </button>
        </form>
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
    </main>
  );
}
