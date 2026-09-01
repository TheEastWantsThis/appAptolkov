"use client";

import { CreateChannelSchema, type ChannelDto } from "@watchroom/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useWatchRoom } from "../../../components/watchroom-provider";
import { normalizeChannelSlug } from "../../../lib/channel-form";

type ChannelField = "name" | "slug" | "description" | "avatarUrl" | "visibility";
type FieldErrors = Partial<Record<ChannelField, string | undefined>>;

const fieldLabels: Record<ChannelField, string> = {
  name: "Название",
  slug: "Адрес канала",
  description: "Описание",
  avatarUrl: "Аватар",
  visibility: "Видимость",
};

export default function NewChannelPage() {
  const { user, loading, error: authError, request } = useWatchRoom();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  function clearFieldError(field: ChannelField) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const parsed = CreateChannelSchema.safeParse({
      name,
      slug,
      ...(description.trim() ? { description } : {}),
      ...(avatarUrl.trim() ? { avatarUrl } : {}),
      visibility,
    });
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field in fieldLabels && !nextErrors[field as ChannelField])
          nextErrors[field as ChannelField] = issue.message;
      }
      setFieldErrors(nextErrors);
      setError(
        Object.entries(nextErrors)
          .map(([field, message]) => `${fieldLabels[field as ChannelField]}: ${message}`)
          .join("; ") || "Исправьте отмеченные поля.",
      );
      return;
    }
    setSaving(true);
    try {
      const data = await request<{ channel: ChannelDto }>("/v1/channels", {
        method: "POST",
        body: JSON.stringify(parsed.data),
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
        <form noValidate onSubmit={(event) => void submit(event)}>
          <label>
            Название
            <input
              aria-describedby={fieldErrors.name ? "channel-name-error" : undefined}
              aria-invalid={Boolean(fieldErrors.name)}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slugTouched) setSlug(normalizeChannelSlug(event.target.value));
                clearFieldError("name");
              }}
            />
            {fieldErrors.name ? (
              <span className="error-text" id="channel-name-error">
                {fieldErrors.name}
              </span>
            ) : null}
          </label>
          <label>
            Адрес канала
            <div className="slug-input">
              <span>watchroom/</span>
              <input
                aria-describedby={fieldErrors.slug ? "channel-slug-error" : "channel-slug-help"}
                aria-invalid={Boolean(fieldErrors.slug)}
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(normalizeChannelSlug(event.target.value));
                  clearFieldError("slug");
                }}
              />
            </div>
            <span className="muted" id="channel-slug-help">
              От 3 до 48 символов: латинские буквы, цифры и дефисы.
            </span>
            {fieldErrors.slug ? (
              <span className="error-text" id="channel-slug-error">
                {fieldErrors.slug}
              </span>
            ) : null}
          </label>
          <label>
            Описание (необязательно)
            <textarea
              aria-describedby={fieldErrors.description ? "channel-description-error" : undefined}
              aria-invalid={Boolean(fieldErrors.description)}
              rows={4}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                clearFieldError("description");
              }}
            />
            {fieldErrors.description ? (
              <span className="error-text" id="channel-description-error">
                {fieldErrors.description}
              </span>
            ) : null}
          </label>
          <label>
            HTTPS-аватар с YouTube, Twitch или Telegram (необязательно)
            <input
              aria-describedby={
                fieldErrors.avatarUrl ? "channel-avatar-error" : "channel-avatar-help"
              }
              aria-invalid={Boolean(fieldErrors.avatarUrl)}
              type="url"
              inputMode="url"
              placeholder="https://i.ytimg.com/..."
              value={avatarUrl}
              onChange={(event) => {
                setAvatarUrl(event.target.value);
                clearFieldError("avatarUrl");
              }}
            />
            <span className="muted" id="channel-avatar-help">
              Можно оставить пустым. Разрешены только безопасные HTTPS-ссылки YouTube, Twitch и
              Telegram.
            </span>
            {fieldErrors.avatarUrl ? (
              <span className="error-text" id="channel-avatar-error">
                {fieldErrors.avatarUrl}
              </span>
            ) : null}
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
