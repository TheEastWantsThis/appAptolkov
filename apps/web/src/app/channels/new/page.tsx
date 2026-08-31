"use client";

import type { ChannelDto } from "@watchroom/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useWatchRoom } from "../../../components/watchroom-provider";

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
export default function NewChannelPage() {
  const { user, loading, error: authError, request } = useWatchRoom();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data = await request<{ channel: ChannelDto }>("/v1/channels", {
        method: "POST",
        body: JSON.stringify({ name, slug, description, avatarUrl, visibility }),
      });
      router.push(`/channels/${data.channel.slug}`);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Не удалось создать канал.");
      setSaving(false);
    }
  }
  if (loading)
    return (
      <main className="app-shell">
        <section className="loading-card">Загрузка…</section>
      </main>
    );
  if (!user)
    return (
      <main className="app-shell">
        <section className="status-card">
          <h1>Нужен вход</h1>
          <p className="error-text">{authError}</p>
        </section>
      </main>
    );
  return (
    <main className="app-shell">
      <Link className="back-link" href="/">
        ← Каналы
      </Link>
      <section className="form-card">
        <p className="eyebrow">Новый канал</p>
        <h1>Страница автора</h1>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            Название
            <input
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slug) setSlug(normalizeSlug(event.target.value));
              }}
            />
          </label>
          <label>
            Адрес канала
            <div className="slug-input">
              <span>watchroom/</span>
              <input
                required
                minLength={3}
                maxLength={48}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                value={slug}
                onChange={(event) => setSlug(normalizeSlug(event.target.value))}
              />
            </div>
          </label>
          <label>
            Описание
            <textarea
              maxLength={500}
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label>
            HTTPS-аватар с YouTube, Twitch или Telegram (необязательно)
            <input
              type="url"
              inputMode="url"
              placeholder="https://example.com/avatar.jpg"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
            />
          </label>
          <label>
            Видимость
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as "PUBLIC" | "PRIVATE")}
            >
              <option value="PUBLIC">Открытый</option>
              <option value="PRIVATE">Закрытый</option>
            </select>
          </label>
          {error ? (
            <p className="error-text" role="alert">
              {error}
            </p>
          ) : null}
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? "Создаём…" : "Создать канал"}
          </button>
        </form>
      </section>
    </main>
  );
}
