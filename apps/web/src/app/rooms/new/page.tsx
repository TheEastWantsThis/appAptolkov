"use client";

import { parsePlayerSource, type PlayerSource, type RoomDto } from "@watchroom/shared";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useWatchRoom } from "../../../components/watchroom-provider";

export default function NewRoomPage() {
  const router = useRouter();
  const channelId = useSearchParams().get("channel") ?? "";
  const { request } = useWatchRoom();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [password, setPassword] = useState("");
  const [controlPolicy, setControlPolicy] = useState("OWNER_ONLY");
  const [sourceProvider, setSourceProvider] = useState<"YOUTUBE" | "TWITCH">("YOUTUBE");
  const [sourceKind, setSourceKind] = useState<"VIDEO" | "VOD" | "LIVE">("VIDEO");
  const [sourceInput, setSourceInput] = useState("");
  const [nowWatchingText, setNowWatchingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    let source: PlayerSource;
    try {
      source = parsePlayerSource({
        provider: sourceProvider,
        kind: sourceKind,
        input: sourceInput,
      });
    } catch {
      const expected =
        sourceProvider === "YOUTUBE"
          ? "Вставьте ссылку YouTube вида https://www.youtube.com/watch?v=… или ID видео из 11 символов."
          : sourceKind === "LIVE"
            ? "Вставьте ссылку на Twitch-канал вида https://www.twitch.tv/channel или имя канала."
            : "Вставьте ссылку Twitch VOD вида https://www.twitch.tv/videos/123456789 или номер видео.";
      setError(expected);
      return;
    }
    setSaving(true);
    try {
      const response = await request<{ room: RoomDto }>("/v1/rooms", {
        method: "POST",
        body: JSON.stringify({
          channelId,
          name,
          description,
          visibility,
          ...(visibility === "PRIVATE" ? { password } : {}),
          controlPolicy,
          sourceProvider: source.provider,
          sourceKind: source.kind,
          sourceId: source.sourceId,
          canonicalUrl: source.canonicalUrl,
          nowWatchingText,
        }),
      });
      router.push(`/rooms/${response.room.publicId}`);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Не удалось создать комнату.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <Link className="back-link" href="/">
        ← Главная
      </Link>
      <section className="form-card">
        <p className="eyebrow">Новая комната</p>
        <h1>Что смотрим?</h1>
        {!channelId ? (
          <p className="error-text">Сначала откройте канал и создайте комнату оттуда.</p>
        ) : null}
        <form onSubmit={(event) => void submit(event)}>
          <label>
            Название
            <input
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Короткое описание (необязательно)
            <textarea
              maxLength={240}
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label>
            Видимость
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as "PUBLIC" | "PRIVATE")}
            >
              <option value="PUBLIC">Открытая</option>
              <option value="PRIVATE">По паролю</option>
            </select>
          </label>
          {visibility === "PRIVATE" ? (
            <label>
              Пароль
              <input
                required
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          ) : null}
          <label>
            Кто управляет просмотром
            <select
              value={controlPolicy}
              onChange={(event) => setControlPolicy(event.target.value)}
            >
              <option value="OWNER_ONLY">Только владелец</option>
              <option value="MODERATORS">Владелец и модераторы</option>
              <option value="EVERYONE">Все участники</option>
            </select>
          </label>
          <div className="form-columns">
            <label>
              Платформа
              <select
                value={sourceProvider}
                onChange={(event) => {
                  const provider = event.target.value as "YOUTUBE" | "TWITCH";
                  setSourceProvider(provider);
                  if (provider === "TWITCH" && sourceKind === "VIDEO") setSourceKind("VOD");
                }}
              >
                <option value="YOUTUBE">YouTube</option>
                <option value="TWITCH">Twitch</option>
              </select>
            </label>
            <label>
              Тип
              <select
                value={sourceKind}
                onChange={(event) => setSourceKind(event.target.value as "VIDEO" | "VOD" | "LIVE")}
              >
                <option value="VIDEO" disabled={sourceProvider === "TWITCH"}>
                  Видео
                </option>
                <option value="VOD">VOD</option>
                <option value="LIVE">Live</option>
              </select>
            </label>
          </div>
          <label>
            Ссылка на видео или трансляцию
            <input
              required
              inputMode="url"
              maxLength={2048}
              placeholder={
                sourceProvider === "YOUTUBE"
                  ? "https://www.youtube.com/watch?v=…"
                  : sourceKind === "LIVE"
                    ? "https://www.twitch.tv/channel"
                    : "https://www.twitch.tv/videos/123456789"
              }
              value={sourceInput}
              onChange={(event) => {
                setSourceInput(event.target.value);
                setError(null);
              }}
            />
            <span className="muted">
              Отдельный ID вводить не нужно — WatchRoom извлечёт его из ссылки автоматически.
            </span>
          </label>
          <label>
            Сейчас смотрят (необязательно)
            <input
              maxLength={120}
              placeholder="Финал сезона без спойлеров"
              value={nowWatchingText}
              onChange={(event) => setNowWatchingText(event.target.value)}
            />
          </label>
          {error ? (
            <p className="error-text" role="alert">
              {error}
            </p>
          ) : null}
          <button className="primary-button" type="submit" disabled={saving || !channelId}>
            {saving ? "Создаём…" : "Создать комнату"}
          </button>
        </form>
      </section>
    </main>
  );
}
