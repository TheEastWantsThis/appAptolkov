"use client";

import type { ChannelDto, ChannelMemberDto, RoomDto } from "@watchroom/shared";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ChannelAvatar } from "../../../components/channel-avatar";
import { RoomCard } from "../../../components/room-card";
import { useWatchRoom } from "../../../components/watchroom-provider";

export default function ChannelPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { user, loading, request } = useWatchRoom();
  const [channel, setChannel] = useState<ChannelDto | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [members, setMembers] = useState<ChannelMemberDto[]>([]);
  const [memberUsername, setMemberUsername] = useState("");
  const [memberRole, setMemberRole] = useState<"MODERATOR" | "MEMBER">("MEMBER");
  useEffect(() => {
    if (loading) return;
    void request<{ channel: ChannelDto }>(`/v1/channels/${encodeURIComponent(params.slug)}`)
      .then((data) => {
        setChannel(data.channel);
        setName(data.channel.name);
        setDescription(data.channel.description);
        setSlug(data.channel.slug);
        setAvatarUrl(data.channel.avatarUrl ?? "");
        setVisibility(data.channel.visibility);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Канал не найден."),
      );
  }, [loading, params.slug, request]);
  useEffect(() => {
    if (!channel) return;
    void request<{ rooms: RoomDto[] }>(`/v1/channels/${channel.id}/rooms`)
      .then((data) => setRooms(data.rooms))
      .catch(() => setRooms([]));
  }, [channel, request]);
  useEffect(() => {
    if (!channel?.role) return;
    void request<{ members: ChannelMemberDto[] }>(`/v1/channels/${channel.id}/members`)
      .then((data) => setMembers(data.members))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить участников."),
      );
  }, [channel?.id, channel?.role, request]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!channel) return;
    try {
      const data = await request<{ channel: ChannelDto }>(`/v1/channels/${channel.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, slug, description, avatarUrl, visibility }),
      });
      setChannel(data.channel);
      if (data.channel.slug !== params.slug) router.replace(`/channels/${data.channel.slug}`);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить.");
    }
  }
  async function remove() {
    if (!channel || !window.confirm("Удалить канал без возможности восстановления?")) return;
    try {
      await request(`/v1/channels/${channel.id}`, { method: "DELETE" });
      router.push("/");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить канал.");
    }
  }
  async function addMember(event: FormEvent) {
    event.preventDefault();
    if (!channel) return;
    try {
      setError(null);
      const data = await request<{ member: ChannelMemberDto }>(
        `/v1/channels/${channel.id}/members`,
        {
          method: "POST",
          body: JSON.stringify({ username: memberUsername, role: memberRole }),
        },
      );
      setMembers((current) => [...current, data.member]);
      setMemberUsername("");
      setChannel((current) =>
        current ? { ...current, memberCount: current.memberCount + 1 } : current,
      );
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Не удалось добавить участника.");
    }
  }
  async function changeMemberRole(member: ChannelMemberDto, role: "MODERATOR" | "MEMBER") {
    if (!channel) return;
    try {
      const data = await request<{ member: ChannelMemberDto }>(
        `/v1/channels/${channel.id}/members/${member.userId}`,
        { method: "PATCH", body: JSON.stringify({ role }) },
      );
      setMembers((current) =>
        current.map((item) => (item.userId === member.userId ? data.member : item)),
      );
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Не удалось изменить роль.");
    }
  }
  async function removeMember(member: ChannelMemberDto) {
    if (!channel || !window.confirm(`Удалить ${member.firstName} из канала?`)) return;
    try {
      await request(`/v1/channels/${channel.id}/members/${member.userId}`, { method: "DELETE" });
      setMembers((current) => current.filter((item) => item.userId !== member.userId));
      setChannel((current) =>
        current ? { ...current, memberCount: Math.max(1, current.memberCount - 1) } : current,
      );
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить участника.");
    }
  }
  if (loading || (!channel && !error))
    return (
      <main className="app-shell">
        <section className="loading-card">Загружаем канал…</section>
      </main>
    );
  if (error && !channel)
    return (
      <main className="app-shell">
        <Link className="back-link" href="/">
          ← Каналы
        </Link>
        <section className="status-card">
          <h1>Канал недоступен</h1>
          <p className="error-text">{error}</p>
        </section>
      </main>
    );
  if (!channel) return null;
  const owner = channel.ownerId === user?.id;
  return (
    <main className="app-shell">
      <Link className="back-link" href="/">
        ← Каналы
      </Link>
      <section className="channel-hero">
        <ChannelAvatar name={channel.name} url={channel.avatarUrl} large />
        <div>
          <span className="status-pill">
            {channel.visibility === "PUBLIC" ? "ОТКРЫТЫЙ" : "ЗАКРЫТЫЙ"}
          </span>
          <h1>{channel.name}</h1>
          <p className="muted">
            @{channel.slug} · участников: {channel.memberCount}
          </p>
        </div>
      </section>
      <section className="status-card">
        <h2>О канале</h2>
        <p className="channel-description">
          {channel.description || "Описание пока не добавлено."}
        </p>
      </section>
      <section className="section-block channel-rooms">
        <div className="section-heading">
          <h2>Комнаты</h2>
          {owner ? (
            <Link className="primary-button link-button" href={`/rooms/new?channel=${channel.id}`}>
              Создать комнату
            </Link>
          ) : null}
        </div>
        {rooms.length === 0 ? <p className="muted">Доступных комнат пока нет.</p> : null}
        <div className="room-grid">
          {rooms.map((room) => (
            <RoomCard room={room} key={room.id} />
          ))}
        </div>
      </section>
      {channel.role ? (
        <section className="status-card">
          <h2>Участники канала</h2>
          <div className="participant-list">
            {members.map((member) => (
              <div className="participant-row" key={member.userId}>
                <span>
                  {member.firstName}
                  {member.username ? ` @${member.username}` : ""} · {member.role}
                </span>
                {owner && member.role !== "OWNER" ? (
                  <span className="button-row">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() =>
                        void changeMemberRole(
                          member,
                          member.role === "MODERATOR" ? "MEMBER" : "MODERATOR",
                        )
                      }
                    >
                      {member.role === "MODERATOR" ? "Сделать участником" : "Сделать модератором"}
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => void removeMember(member)}
                    >
                      Удалить
                    </button>
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          {owner ? (
            <form onSubmit={(event) => void addMember(event)}>
              <label>
                Telegram username
                <input
                  required
                  minLength={5}
                  maxLength={33}
                  placeholder="@username"
                  value={memberUsername}
                  onChange={(event) => setMemberUsername(event.target.value)}
                />
              </label>
              <label>
                Роль
                <select
                  value={memberRole}
                  onChange={(event) => setMemberRole(event.target.value as "MODERATOR" | "MEMBER")}
                >
                  <option value="MEMBER">Участник</option>
                  <option value="MODERATOR">Модератор</option>
                </select>
              </label>
              <button className="primary-button" type="submit">
                Добавить
              </button>
            </form>
          ) : null}
        </section>
      ) : null}
      {owner ? (
        <section className="form-card">
          <h2>Управление каналом</h2>
          <form onSubmit={(event) => void save(event)}>
            <label>
              Название
              <input
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Адрес канала
              <input
                required
                minLength={3}
                maxLength={48}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                value={slug}
                onChange={(event) =>
                  setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                }
              />
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
              HTTPS-ссылка YouTube, Twitch или Telegram
              <input
                type="url"
                inputMode="url"
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
            {error ? <p className="error-text">{error}</p> : null}
            <div className="button-row">
              <button className="primary-button" type="submit">
                Сохранить
              </button>
              <button className="danger-button" type="button" onClick={() => void remove()}>
                Удалить
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </main>
  );
}
