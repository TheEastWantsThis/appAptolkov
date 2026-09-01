"use client";

import {
  chooseDriftCorrection,
  PlaybackSnapshotSchema,
  PlayerSourceSchema,
  ReactionEventSchema,
  RoomSystemEventSchema,
  type PlaybackSnapshot,
  type PlayerState,
  type ReactionEvent,
  type RoomChatRestrictionStatus,
  type RoomDto,
  type RoomMemberDto,
  type RoomMessageDto,
  type RoomPreviewDto,
  type RoomSystemEvent,
} from "@watchroom/shared";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";

import { ShareRoom } from "../../../components/share-room";
import { TelegramChatBinding } from "../../../components/telegram-chat-binding";
import { OfficialPlayer } from "../../../components/official-player";
import { RoomStatusStack, type RoomConnectionState } from "../../../components/room-status-stack";
import type { PlayerAdapter } from "../../../player/types";
import { shouldReloadTwitchLiveEdge } from "../../../player/live-edge";
import { useWatchRoom } from "../../../components/watchroom-provider";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const websocketUrl = process.env.NEXT_PUBLIC_WS_URL ?? apiUrl;
type PlayerMode = "NORMAL" | "STICKY";

export default function RoomPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const router = useRouter();
  const { loading, request, user } = useWatchRoom();
  const [room, setRoom] = useState<RoomDto | null>(null);
  const [preview, setPreview] = useState<RoomPreviewDto | null>(null);
  const [awaitingJoin, setAwaitingJoin] = useState(false);
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [grantToken, setGrantToken] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : sessionStorage.getItem(`watchroom.room-grant.${publicId}`),
  );
  const [members, setMembers] = useState<RoomMemberDto[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<RoomMessageDto[]>([]);
  const [chatRestriction, setChatRestriction] = useState<RoomChatRestrictionStatus | null>(null);
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);
  const [systemEvents, setSystemEvents] = useState<RoomSystemEvent[]>([]);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const [chatText, setChatText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<RoomConnectionState>("CONNECTING");
  const [playerState, setPlayerState] = useState<PlayerState>("LOADING");
  const [playerMode, setPlayerMode] = useState<PlayerMode>("NORMAL");
  const [sourceProvider, setSourceProvider] = useState<"YOUTUBE" | "TWITCH">("YOUTUBE");
  const [sourceKind, setSourceKind] = useState<"VIDEO" | "VOD" | "LIVE">("VIDEO");
  const [sourceInput, setSourceInput] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const playerAnchorRef = useRef<HTMLDivElement | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const playerModeRef = useRef<PlayerMode>("NORMAL");
  const adapterRef = useRef<PlayerAdapter | null>(null);
  const roomRef = useRef<RoomDto | null>(null);
  const lastLiveEdgeVersionRef = useRef<number | null>(null);
  const pendingPlaybackRef = useRef<{ playback: PlaybackSnapshot; serverNowMs: number } | null>(
    null,
  );
  const applyingRemoteRef = useRef(false);
  const remotePlayerStateRef = useRef<{
    state: "PLAYING" | "PAUSED";
    untilMs: number;
  } | null>(null);

  useEffect(() => {
    playerModeRef.current = playerMode;
  }, [playerMode]);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  useEffect(() => {
    const list = chatListRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      const current = Date.now();
      setClockMs(current);
      setReactions((items) => items.filter((item) => item.expiresAtServerMs > current));
      setSystemEvents((items) => items.filter((item) => item.expiresAtServerMs > current));
      setChatRestriction((restriction) =>
        restriction && new Date(restriction.mutedUntil).getTime() > current ? restriction : null,
      );
    }, 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    const goBack = () => router.push("/rooms");
    const backButtonSupported = webApp?.isVersionAtLeast?.("6.1") ?? Boolean(webApp?.BackButton);
    if (backButtonSupported) {
      webApp?.BackButton?.show();
      webApp?.BackButton?.onClick(goBack);
    }
    return () => {
      if (backButtonSupported) {
        webApp?.BackButton?.offClick(goBack);
        webApp?.BackButton?.hide();
      }
    };
  }, [router]);

  useEffect(() => {
    const anchor = playerAnchorRef.current;
    if (!anchor || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setPlayerMode(entry.isIntersecting ? "NORMAL" : "STICKY");
      },
      { threshold: 0.35 },
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [room?.id]);

  const applyRemotePlayback = useCallback((playback: PlaybackSnapshot, serverNowMs: number) => {
    const adapter = adapterRef.current;
    if (!adapter) {
      pendingPlaybackRef.current = { playback, serverNowMs };
      return;
    }
    if (["BUFFERING", "AUTOPLAY_BLOCKED", "LOADING"].includes(adapter.getState())) {
      pendingPlaybackRef.current = { playback, serverNowMs };
      return;
    }
    applyingRemoteRef.current = true;
    const currentRoom = roomRef.current;
    if (
      currentRoom &&
      shouldReloadTwitchLiveEdge(playback, currentRoom, lastLiveEdgeVersionRef.current)
    ) {
      lastLiveEdgeVersionRef.current = playback.version;
      remotePlayerStateRef.current = {
        state: "PLAYING",
        untilMs: Date.now() + 2_500,
      };
      void adapter
        .loadSource({
          provider: "TWITCH",
          kind: "LIVE",
          sourceId: currentRoom.sourceId,
          canonicalUrl: currentRoom.canonicalUrl,
        })
        .then(() => adapter.play())
        .catch(() => setError("Не удалось вернуться к прямому эфиру Twitch."))
        .finally(() => {
          queueMicrotask(() => {
            applyingRemoteRef.current = false;
          });
        });
      pendingPlaybackRef.current = null;
      return;
    }
    try {
      const current = adapter.getCurrentTime();
      if (current !== null) {
        const correction = chooseDriftCorrection(
          current,
          playback,
          serverNowMs,
          adapter.capabilities.seek,
        );
        if (correction.kind !== "NONE") adapter.seek(correction.targetSeconds);
      }
      remotePlayerStateRef.current = {
        state: playback.state === "PLAYING" ? "PLAYING" : "PAUSED",
        untilMs: Date.now() + 2_500,
      };
      if (playback.state === "PLAYING") adapter.play();
      else adapter.pause();
      if (adapter.getState() === "AUTOPLAY_BLOCKED")
        setNotice("Браузер ждёт вашего нажатия ▶ прямо на видео.");
      pendingPlaybackRef.current = null;
    } finally {
      queueMicrotask(() => {
        applyingRemoteRef.current = false;
      });
    }
  }, []);

  const handleAdapterChange = useCallback(
    (adapter: PlayerAdapter | null) => {
      adapterRef.current = adapter;
      const pending = pendingPlaybackRef.current;
      if (adapter && pending)
        setTimeout(() => applyRemotePlayback(pending.playback, pending.serverNowMs), 0);
    },
    [applyRemotePlayback],
  );
  const handlePlayerState = useCallback(
    (state: PlayerState) => {
      setPlayerState(state);
      if (state === "ERROR") socketRef.current?.emit("telemetry:event", { type: "PLAYER_ERROR" });
      if (state === "AUTOPLAY_BLOCKED")
        socketRef.current?.emit("telemetry:event", { type: "AUTOPLAY_BLOCKED" });
      if (state !== "PLAYING" && state !== "PAUSED") return;
      const remoteState = remotePlayerStateRef.current;
      if (remoteState && remoteState.untilMs > Date.now() && remoteState.state === state) {
        remotePlayerStateRef.current = null;
        return;
      }
      if (applyingRemoteRef.current) return;
      const currentRoom = roomRef.current;
      const action = state === "PLAYING" ? "play" : "pause";
      if (
        !currentRoom ||
        currentRoom.status === "ENDED" ||
        !currentRoom.permissions.includes(action)
      )
        return;
      socketRef.current?.emit(`playback:${action}`, {
        publicId,
        commandId: crypto.randomUUID(),
        expectedVersion: currentRoom.playback.version,
        positionSeconds: adapterRef.current?.getCurrentTime() ?? 0,
      });
    },
    [publicId],
  );

  const load = useCallback(
    async (grant: string | null, enter = false) => {
      const previewResult = await request<{ preview: RoomPreviewDto }>(
        `/v1/rooms/${publicId}/preview`,
      );
      setPreview(previewResult.preview);
      const headers = grant ? { "x-room-grant": grant } : null;
      if (previewResult.preview.visibility === "PRIVATE" && !grant) {
        setLocked(true);
        setAwaitingJoin(false);
        setRoom(null);
        return;
      }
      if (!enter && !grant) {
        setLocked(false);
        setAwaitingJoin(true);
        setRoom(null);
        return;
      }
      const joined = await request<{ room: RoomDto }>(`/v1/rooms/${publicId}/join`, {
        method: "POST",
        ...(headers ? { headers } : {}),
        body: "{}",
      });
      setLocked(false);
      setAwaitingJoin(false);
      setRoom(joined.room);
      const memberPage = await request<{ members: RoomMemberDto[] }>(
        `/v1/rooms/${joined.room.id}/members?limit=100`,
      );
      setMembers(memberPage.members);
      const chatPage = await request<{ messages: RoomMessageDto[] }>(
        `/v1/rooms/${publicId}/messages`,
        headers ? { headers } : {},
      );
      setMessages(chatPage.messages);
    },
    [publicId, request],
  );

  useEffect(() => {
    if (loading || !user) return;
    const savedGrant = sessionStorage.getItem(`watchroom.room-grant.${publicId}`);
    void Promise.resolve()
      .then(() => load(savedGrant, Boolean(savedGrant)))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Комната недоступна."),
      );
  }, [load, loading, publicId, user]);

  async function enterPublicRoom() {
    try {
      setError(null);
      await load(grantToken, true);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Не удалось войти в комнату.");
    }
  }

  const roomId = room?.id;
  useEffect(() => {
    if (!roomId) return;
    const socket = io(websocketUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      setConnectionState("CONNECTED");
      socket.emit("room:join", { publicId, grantToken });
    });
    socket.on("disconnect", (reason) => {
      setConnectionState(reason === "io client disconnect" ? "OFFLINE" : "RECONNECTING");
    });
    socket.on("connect_error", () => setConnectionState("OFFLINE"));
    socket.io.on("reconnect_attempt", () => setConnectionState("RECONNECTING"));
    socket.io.on("reconnect", () => {
      socket.emit("telemetry:event", { type: "RECONNECT" });
      setConnectionState("CONNECTED");
    });
    socket.on("room:presence", (payload: { viewerCount?: unknown; userIds?: unknown }) => {
      if (typeof payload.viewerCount === "number")
        setRoom((current) =>
          current ? { ...current, viewerCount: payload.viewerCount as number } : current,
        );
      if (Array.isArray(payload.userIds))
        setOnlineUserIds(
          payload.userIds.filter((value): value is string => typeof value === "string"),
        );
    });
    socket.on("room:snapshot", (payload: unknown) => {
      const candidate = payload as {
        room?: RoomDto;
        playback?: unknown;
        messages?: RoomMessageDto[];
        serverNowMs?: number;
        chatRestriction?: RoomChatRestrictionStatus | null;
      };
      const parsed = PlaybackSnapshotSchema.safeParse(candidate.playback);
      if (!candidate.room || !parsed.success || typeof candidate.serverNowMs !== "number") return;
      setRoom(candidate.room);
      if (candidate.messages) setMessages(candidate.messages);
      setChatRestriction(candidate.chatRestriction ?? null);
      applyRemotePlayback(parsed.data, candidate.serverNowMs);
    });
    socket.on("playback:command", (payload: unknown) => {
      const candidate = payload as {
        playback?: unknown;
        serverNowMs?: number;
        source?: unknown;
        metadata?: {
          title?: string | null;
          creatorName?: string | null;
          thumbnailUrl?: string | null;
          liveStatus?: RoomDto["cachedLiveStatus"];
          embeddable?: boolean | null;
        };
      };
      const parsed = PlaybackSnapshotSchema.safeParse(candidate.playback);
      if (!parsed.success || typeof candidate.serverNowMs !== "number") return;
      const playback = parsed.data;
      setRoom((current) =>
        current
          ? {
              ...current,
              ...(candidate.source && PlayerSourceSchema.safeParse(candidate.source).success
                ? {
                    sourceProvider: playback.sourceProvider,
                    sourceKind: playback.sourceKind,
                    sourceId: playback.sourceId,
                    canonicalUrl: (candidate.source as { canonicalUrl: string }).canonicalUrl,
                    cachedTitle: candidate.metadata?.title ?? null,
                    cachedCreatorName: candidate.metadata?.creatorName ?? null,
                    cachedThumbnailUrl: candidate.metadata?.thumbnailUrl ?? null,
                    cachedLiveStatus: candidate.metadata?.liveStatus ?? null,
                    cachedEmbeddable: candidate.metadata?.embeddable ?? null,
                  }
                : {}),
              playback: {
                ...current.playback,
                ...playback,
                paused: playback.state !== "PLAYING",
                updatedAt: new Date(playback.changedAtServerMs).toISOString(),
              },
            }
          : current,
      );
      applyRemotePlayback(playback, candidate.serverNowMs);
    });
    socket.on("room:updated", (payload: { room?: RoomDto }) => {
      if (payload.room) setRoom(payload.room);
    });
    socket.on(
      "chat:snapshot",
      (payload: {
        messages?: RoomMessageDto[];
        chatRestriction?: RoomChatRestrictionStatus | null;
      }) => {
        if (Array.isArray(payload.messages)) setMessages(payload.messages.slice(-40));
        setChatRestriction(payload.chatRestriction ?? null);
      },
    );
    socket.on("chat:new-message", (payload: { message?: RoomMessageDto }) => {
      if (payload.message)
        setMessages((current) =>
          [
            ...current.filter((item) => item.id !== payload.message?.id),
            payload.message as RoomMessageDto,
          ].slice(-40),
        );
    });
    socket.on("chat:message-deleted", (payload: { messageId?: unknown }) => {
      if (typeof payload.messageId === "string")
        setMessages((current) => current.filter((message) => message.id !== payload.messageId));
    });
    socket.on(
      "chat:member-muted",
      (payload: {
        userId?: string;
        mutedUntil?: string;
        reason?: string | null;
        mutedByRole?: "OWNER" | "MODERATOR";
      }) => {
        if (payload.userId === user?.id && payload.mutedUntil) {
          setChatRestriction({
            mutedUntil: payload.mutedUntil,
            reason: payload.reason ?? null,
            mutedByRole: payload.mutedByRole ?? "MODERATOR",
          });
          setNotice(
            `Чат недоступен до ${payload.mutedUntil ? new Date(payload.mutedUntil).toLocaleTimeString("ru") : "указанного времени"}${payload.reason ? `: ${payload.reason}` : "."}`,
          );
        }
      },
    );
    socket.on("playback:denied", (payload: { message?: string }) =>
      setError(payload.message ?? "Команда просмотра отклонена."),
    );
    socket.on("chat:denied", (payload: { message?: string }) =>
      setError(payload.message ?? "Команда чата отклонена."),
    );
    socket.on("reaction:new", (payload: unknown) => {
      const parsed = ReactionEventSchema.safeParse(payload);
      if (parsed.success) setReactions((current) => [...current, parsed.data].slice(-24));
    });
    socket.on("system:event", (payload: unknown) => {
      const parsed = RoomSystemEventSchema.safeParse(payload);
      if (parsed.success) setSystemEvents((current) => [...current, parsed.data].slice(-30));
    });
    socket.on("room:ended", () => {
      setRoom((current) => (current ? { ...current, status: "ENDED" } : current));
      setNotice("Комната завершена владельцем.");
    });
    socket.on("room:access-revoked", (payload: { userId?: string }) => {
      if (payload.userId === user?.id) setError("Владелец закрыл вам доступ к этой комнате.");
    });
    socket.on("error", (payload: { message?: string }) => {
      if (payload.message) setError(payload.message);
    });
    const heartbeat = setInterval(() => socket.emit("heartbeat", { publicId }), 15_000);
    const activate = () => {
      if (!socket.connected) socket.connect();
      else socket.emit("room:join", { publicId, grantToken });
    };
    const deactivate = () => {
      const current = adapterRef.current?.getCurrentTime();
      if (current !== null && current !== undefined)
        sessionStorage.setItem(`watchroom.room-position.${publicId}`, String(current));
    };
    window.addEventListener("watchroom:telegram-activated", activate);
    window.addEventListener("watchroom:telegram-deactivated", deactivate);
    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("watchroom:telegram-activated", activate);
      window.removeEventListener("watchroom:telegram-deactivated", deactivate);
      socket.emit("room:leave", { publicId });
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [applyRemotePlayback, grantToken, publicId, roomId, user?.id]);

  const refreshRoom = useCallback(async () => load(grantToken, true), [grantToken, load]);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const response = await request<{ grantToken: string }>(`/v1/rooms/${publicId}/unlock`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      sessionStorage.setItem(`watchroom.room-grant.${publicId}`, response.grantToken);
      setGrantToken(response.grantToken);
      setPassword("");
      await load(response.grantToken);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Не удалось открыть комнату.");
    }
  }

  async function updateOwner(fields: Record<string, unknown>) {
    if (!room) return;
    try {
      const response = await request<{ room: RoomDto }>(`/v1/rooms/${room.id}`, {
        method: "PATCH",
        body: JSON.stringify(fields),
      });
      setRoom(response.room);
      setNotice("Настройки сохранены");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить.");
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = chatText.trim();
    if (!text) return;
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("chat:send", { publicId, commandId: crypto.randomUUID(), text });
      setChatText("");
      return;
    }
    try {
      const response = await request<{ message: RoomMessageDto }>(
        `/v1/rooms/${publicId}/messages`,
        {
          method: "POST",
          ...(grantToken ? { headers: { "x-room-grant": grantToken } } : {}),
          body: JSON.stringify({ text }),
        },
      );
      setMessages((current) =>
        [...current.filter((item) => item.id !== response.message.id), response.message].slice(-40),
      );
      setChatText("");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Сообщение не отправлено.");
    }
  }

  async function deleteMessage(messageId: string) {
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("chat:delete", { publicId, commandId: crypto.randomUUID(), messageId });
      return;
    }
    try {
      await request(`/v1/room-messages/${messageId}`, { method: "DELETE" });
      setMessages((current) => current.filter((message) => message.id !== messageId));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить сообщение.");
    }
  }

  async function muteMember(userId: string) {
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("chat:mute-member", {
        publicId,
        commandId: crypto.randomUUID(),
        userId,
        durationMinutes: 15,
        reason: "Ограничение модератора комнаты",
      });
      return;
    }
    try {
      await request(`/v1/rooms/${room?.id ?? ""}/chat-restrictions`, {
        method: "POST",
        body: JSON.stringify({ userId, durationMinutes: 15 }),
      });
      setNotice("Участник не сможет писать 15 минут");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Не удалось ограничить чат.");
    }
  }

  async function blockMember(userId: string) {
    if (!room) return;
    try {
      await request(`/v1/rooms/${room.id}/blocked-members/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ reason: "Нарушение правил комнаты" }),
      });
      setMembers((current) => current.filter((member) => member.userId !== userId));
      setNotice("Доступ участника к комнате заблокирован");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Не удалось заблокировать участника.");
    }
  }

  async function reportMember(userId: string) {
    try {
      await request(`/v1/rooms/${publicId}/abuse-reports`, {
        method: "POST",
        ...(grantToken ? { headers: { "x-room-grant": grantToken } } : {}),
        body: JSON.stringify({ targetUserId: userId, category: "HARASSMENT" }),
      });
      setNotice("Жалоба отправлена на проверку");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить жалобу.");
    }
  }

  function sendReaction(reaction: "👍" | "❤️" | "😂" | "😮" | "🔥" | "👏") {
    socketRef.current?.emit("reaction:send", {
      publicId,
      commandId: crypto.randomUUID(),
      reaction,
    });
  }

  function changeSource(event: FormEvent) {
    event.preventDefault();
    if (!room || !sourceInput.trim() || !socketRef.current?.connected) {
      setError("Для смены источника нужно активное соединение.");
      return;
    }
    socketRef.current.emit("playback:change-source", {
      publicId,
      commandId: crypto.randomUUID(),
      expectedVersion: room.playback.version,
      source: { provider: sourceProvider, kind: sourceKind, input: sourceInput.trim() },
    });
    setSourceInput("");
  }

  function openTelegramDiscussion(url: string) {
    const current = adapterRef.current?.getCurrentTime();
    sessionStorage.setItem(
      `watchroom.return.${publicId}`,
      JSON.stringify({ positionSeconds: current ?? 0, savedAt: Date.now() }),
    );
    const webApp = window.Telegram?.WebApp;
    if (webApp?.openTelegramLink) webApp.openTelegramLink(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  }

  function toggleFullscreen() {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;
    if (webApp.isFullscreen) webApp.exitFullscreen?.();
    else {
      webApp.expand?.();
      webApp.requestFullscreen?.();
    }
  }

  async function setModerator(enabled: boolean, selectedUserId: string) {
    if (!room || !selectedUserId) return;
    try {
      await request(`/v1/rooms/${room.id}/moderators/${selectedUserId}`, {
        method: enabled ? "PUT" : "DELETE",
        ...(enabled ? { body: "{}" } : {}),
      });
      const result = await request<{ members: RoomMemberDto[] }>(
        `/v1/rooms/${room.id}/members?limit=100`,
      );
      setMembers(result.members);
      setNotice(enabled ? "Модератор назначен" : "Роль модератора снята");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Не удалось изменить роль.");
    }
  }

  if (loading || (!room && !preview && !locked && !error))
    return (
      <main className="app-shell">
        <section className="loading-card">Открываем комнату…</section>
      </main>
    );

  if (locked)
    return (
      <main className="app-shell private-entry">
        <Link className="back-link" href="/rooms">
          ← Каталог
        </Link>
        <section className="form-card lock-card">
          <span className="lock-icon" aria-hidden="true">
            🔒
          </span>
          <p className="eyebrow">Закрытая комната</p>
          <h1>{preview?.name ?? "Нужен пароль"}</h1>
          {preview ? (
            <>
              <p>{preview.description || preview.cachedTitle || "Совместный просмотр"}</p>
              <p className="muted">
                {preview.sourceProvider} · {preview.sourceKind} · {preview.status}
              </p>
              <p className="muted">
                Сейчас смотрят: {preview.nowWatchingText || preview.viewerNames.join(", ") || "—"} ·{" "}
                {preview.viewerCount}
              </p>
            </>
          ) : null}
          <form onSubmit={(event) => void unlock(event)}>
            <label>
              Пароль
              <input
                required
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error ? <p className="error-text">{error}</p> : null}
            <button className="primary-button" type="submit">
              Войти
            </button>
          </form>
        </section>
      </main>
    );

  if (awaitingJoin && preview)
    return (
      <main className="app-shell private-entry">
        <Link className="back-link" href="/rooms">
          ← Каталог
        </Link>
        <section className="form-card lock-card">
          <p className="eyebrow">
            {preview.sourceProvider} · {preview.sourceKind} · {preview.status}
          </p>
          <h1>{preview.name}</h1>
          <p>{preview.description || preview.cachedTitle || "Совместный просмотр"}</p>
          <p className="muted">
            Сейчас смотрят: {preview.nowWatchingText || preview.viewerNames.join(", ") || "—"}
          </p>
          <p className="muted">
            Зрителей: {preview.viewerCount}
            {preview.viewerNames.length > 0 ? ` · ${preview.viewerNames.join(", ")}` : ""}
          </p>
          {error ? <p className="error-text">{error}</p> : null}
          <button className="primary-button" type="button" onClick={() => void enterPublicRoom()}>
            Войти в комнату
          </button>
        </section>
      </main>
    );

  if (!room)
    return (
      <main className="app-shell">
        <Link className="back-link" href="/rooms">
          ← Каталог
        </Link>
        <section className="status-card">
          <h1>Комната недоступна</h1>
          <p className="error-text">{error}</p>
        </section>
      </main>
    );

  const owner = room.role === "OWNER";
  const allowedRoomStatuses = {
    DRAFT: ["DRAFT", "WAITING", "ENDED"],
    WAITING: ["WAITING", "LIVE", "ENDED"],
    LIVE: ["LIVE", "ENDED"],
    ENDED: ["ENDED"],
  }[room.status];
  const live = room.sourceKind === "LIVE" || room.status === "LIVE";
  const onlineSet = new Set(onlineUserIds);
  const onlineMembers = members.filter((member) => onlineSet.has(member.userId));
  const playbackActor = members.find((member) => member.userId === room.playback.actorUserId);
  const muteRemainingSeconds = chatRestriction
    ? Math.max(0, Math.ceil((new Date(chatRestriction.mutedUntil).getTime() - clockMs) / 1_000))
    : 0;
  const chatMuted = muteRemainingSeconds > 0;
  const playerSource = PlayerSourceSchema.parse({
    provider: room.sourceProvider,
    kind: room.sourceKind,
    sourceId: room.sourceId,
    canonicalUrl: room.canonicalUrl,
  });
  return (
    <main className="app-shell room-page-shell">
      <header className="room-topbar">
        <Link aria-label="Назад в каталог комнат" className="room-icon-button" href="/rooms">
          ←
        </Link>
        <div className="room-topbar-title">
          <strong>{room.name}</strong>
          <span>
            <span className={live ? "live-badge" : "vod-badge"}>{live ? "LIVE" : "VOD"}</span>
            <span aria-label={`${room.viewerCount} зрителей`}>● {room.viewerCount}</span>
          </span>
        </div>
        <details className="room-menu">
          <summary aria-label="Открыть меню комнаты">•••</summary>
          <div>
            <button type="button" onClick={toggleFullscreen}>
              Полный экран
            </button>
            <a href={room.canonicalUrl} target="_blank" rel="noreferrer">
              Открыть источник
            </a>
            <span>После возврата приложение попробует переподключиться к комнате.</span>
          </div>
        </details>
      </header>

      <section className="room-summary" aria-labelledby="room-heading">
        <div>
          <p className="eyebrow">
            {room.cachedCreatorName || `${room.sourceProvider} · ${room.sourceKind}`}
          </p>
          <h1 id="room-heading">{room.name}</h1>
        </div>
        {room.visibility === "PRIVATE" ? <span className="status-pill">🔒 Закрытая</span> : null}
        {room.description ? <p className="muted">{room.description}</p> : null}
      </section>

      <RoomStatusStack
        connectionState={connectionState}
        paused={room.playback.paused}
        {...(playbackActor ? { playbackActorName: playbackActor.firstName } : {})}
        playerState={room.cachedEmbeddable === false ? "ERROR" : playerState}
        roomStatus={room.status}
      />

      <div className="room-player-anchor" ref={playerAnchorRef}>
        <section
          aria-label="Видеоплеер комнаты"
          className={`room-player-stage player-mode-${playerMode.toLowerCase()}`}
          data-provider={room.sourceProvider}
        >
          <div className="mini-player-actions">
            {playerMode !== "NORMAL" ? (
              <button
                aria-label="Развернуть плеер"
                title="Развернуть"
                type="button"
                onClick={() => setPlayerMode("NORMAL")}
              >
                ⛶
              </button>
            ) : null}
            {playerMode === "NORMAL" ? (
              <button
                aria-label="Закрепить компактный плеер"
                title="Закрепить сверху"
                type="button"
                onClick={() => setPlayerMode("STICKY")}
              >
                ⌃
              </button>
            ) : null}
          </div>
          <OfficialPlayer
            compact={playerMode !== "NORMAL"}
            embeddable={room.cachedEmbeddable}
            source={playerSource}
            onAdapterChange={handleAdapterChange}
            onStateChange={handlePlayerState}
          />
        </section>
      </div>

      <section className="room-panel chat-card">
        <div className="chat-heading">
          <div>
            <h2>Чат</h2>
            <p className="muted">До 40 сообщений · удаляются через 24 часа</p>
          </div>
          <span className="chat-online-dot">{onlineMembers.length} онлайн</span>
        </div>
        {systemEvents.length ? (
          <div className="system-event-list" aria-label="События комнаты" aria-live="polite">
            {systemEvents.slice(-8).map((event) => {
              const actor = members.find((member) => member.userId === event.actorUserId);
              const action = {
                MEMBER_JOINED: "вошёл в комнату",
                PLAYBACK_STARTED: "запустил просмотр",
                PLAYBACK_PAUSED: "поставил на паузу",
                SOURCE_CHANGED: "сменил источник",
                ROOM_ENDED: "завершил комнату",
              }[event.kind];
              return (
                <p key={event.id}>
                  {actor?.firstName ?? "Участник"} {action}
                </p>
              );
            })}
          </div>
        ) : null}
        <div className="chat-list" aria-live="polite" ref={chatListRef}>
          {messages.length === 0 ? (
            <div className="chat-empty-state">
              <span>💬</span>
              <p>Напишите первое сообщение</p>
            </div>
          ) : (
            messages.map((message) => {
              const ownMessage = message.authorId === user?.id;
              const canDelete = ownMessage || room.permissions.includes("delete_chat_message");
              return (
                <article
                  className={`chat-message${ownMessage ? " chat-message-own" : ""}`}
                  key={message.id}
                >
                  <div className="chat-message-meta">
                    <span className="chat-avatar" aria-hidden="true">
                      {message.authorFirstName.slice(0, 1).toUpperCase()}
                    </span>
                    <strong>{ownMessage ? "Вы" : message.authorFirstName}</strong>
                    <small>
                      {new Date(message.createdAt).toLocaleTimeString("ru", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                    {canDelete ? (
                      <details className="chat-message-menu">
                        <summary aria-label="Опции сообщения">•••</summary>
                        <div>
                          <button type="button" onClick={() => void deleteMessage(message.id)}>
                            Удалить сообщение
                          </button>
                        </div>
                      </details>
                    ) : null}
                  </div>
                  <p>{message.text}</p>
                </article>
              );
            })
          )}
        </div>
        <form className="chat-form" onSubmit={(event) => void sendMessage(event)}>
          <label className="sr-only" htmlFor="room-chat-message">
            Сообщение
          </label>
          <input
            disabled={chatMuted}
            id="room-chat-message"
            maxLength={500}
            placeholder={chatMuted ? "Вы временно не можете писать" : "Сообщение…"}
            value={chatText}
            onChange={(event) => setChatText(event.target.value)}
          />
          <button
            aria-label="Отправить сообщение"
            className="chat-send-button"
            type="submit"
            disabled={chatMuted || !chatText.trim()}
          >
            ➤
          </button>
        </form>
        {chatMuted ? (
          <p className="chat-mute-notice" role="status">
            Текстовый чат недоступен ещё {Math.ceil(muteRemainingSeconds / 60)} мин.
            {chatRestriction?.reason ? ` Причина: ${chatRestriction.reason}` : ""} Смотреть и
            отправлять реакции можно.
          </p>
        ) : null}
      </section>

      <section className="now-watching-card">
        <span>Сейчас смотрят</span>
        <strong>{room.nowWatchingText || room.cachedTitle || "Источник выбран"}</strong>
        <small>{room.cachedCreatorName || room.sourceId}</small>
      </section>

      {live ? (
        <p className="live-latency-note">
          LIVE синхронизируется приблизительно: задержка у зрителей может отличаться. Twitch Live
          нельзя перематывать.
        </p>
      ) : null}

      {room.reactionsEnabled ? (
        <>
          <section className="reaction-strip" aria-label="Реакции">
            {(["👍", "❤️", "😂", "😮", "🔥", "👏"] as const).map((reaction) => (
              <button
                aria-label={`Отправить реакцию ${reaction}`}
                key={reaction}
                type="button"
                onClick={() => sendReaction(reaction)}
              >
                {reaction}
              </button>
            ))}
          </section>
          <div className="reaction-burst" aria-live="polite" aria-label="Последние реакции">
            {reactions.map((reaction) => (
              <span key={`${reaction.actorUserId}:${reaction.createdAtServerMs}`}>
                {reaction.reaction}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="muted reactions-disabled">Реакции отключены владельцем.</p>
      )}

      <section className="room-panel">
        <div className="room-section-heading">
          <h2>Участники</h2>
          <span>{onlineMembers.length} онлайн</span>
        </div>
        <ul className="member-list">
          {onlineMembers.map((member) => (
            <li key={member.userId}>
              <span>
                {member.firstName}
                {member.username ? ` · @${member.username}` : ""}
              </span>
              <span className="member-actions">
                <strong>
                  {member.role === "OWNER"
                    ? "владелец"
                    : member.role === "MODERATOR"
                      ? "модератор"
                      : "зритель"}
                </strong>
                {room.permissions.includes("mute_chat_member") && member.role !== "OWNER" ? (
                  <button type="button" onClick={() => void muteMember(member.userId)}>
                    Ограничить 15 мин
                  </button>
                ) : null}
                {room.permissions.includes("manage_members") && member.role === "VIEWER" ? (
                  <button type="button" onClick={() => void setModerator(true, member.userId)}>
                    Сделать модератором
                  </button>
                ) : null}
                {room.permissions.includes("manage_members") && member.role === "MODERATOR" ? (
                  <button type="button" onClick={() => void setModerator(false, member.userId)}>
                    Снять роль
                  </button>
                ) : null}
                {member.userId !== user?.id ? (
                  <button type="button" onClick={() => void reportMember(member.userId)}>
                    Пожаловаться
                  </button>
                ) : null}
                {owner && member.role !== "OWNER" ? (
                  <button type="button" onClick={() => void blockMember(member.userId)}>
                    Заблокировать
                  </button>
                ) : null}
              </span>
            </li>
          ))}
          {onlineMembers.length === 0 ? (
            <li className="muted">Ждём heartbeat участников…</li>
          ) : null}
        </ul>
      </section>

      {room.linkedTelegramChatUrl ? (
        <section className="telegram-discussion-card">
          <div>
            <strong>Обсуждение в Telegram</strong>
            <span>Откроется отдельно; WatchRoom восстановит соединение после возврата.</span>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => openTelegramDiscussion(room.linkedTelegramChatUrl as string)}
          >
            Обсуждать в Telegram
          </button>
        </section>
      ) : null}

      <section className="room-panel">
        <h2>Пригласить</h2>
        <p className="muted">Пароль никогда не добавляется в ссылку.</p>
        <ShareRoom publicId={publicId} grantToken={grantToken} />
      </section>

      {owner ? (
        <section className="room-panel owner-panel">
          <h2>Управление владельца</h2>
          <form className="owner-source-form" onSubmit={changeSource}>
            <label>
              Платформа
              <select
                value={sourceProvider}
                onChange={(event) => {
                  const provider = event.target.value as "YOUTUBE" | "TWITCH";
                  setSourceProvider(provider);
                  if (provider === "TWITCH" && sourceKind === "VIDEO") setSourceKind("LIVE");
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
                <option value="LIVE">Live</option>
                <option value="VOD">VOD</option>
                {sourceProvider === "YOUTUBE" ? <option value="VIDEO">Видео</option> : null}
              </select>
            </label>
            <label className="owner-source-input">
              Ссылка или ID
              <input
                required
                maxLength={2048}
                value={sourceInput}
                onChange={(event) => setSourceInput(event.target.value)}
              />
            </label>
            <button
              className="primary-button"
              type="submit"
              disabled={connectionState !== "CONNECTED"}
            >
              Сменить источник
            </button>
          </form>
          <label>
            Статус
            <select
              value={room.status}
              onChange={(event) => void updateOwner({ status: event.target.value })}
            >
              {allowedRoomStatuses.map((status) => (
                <option key={status} value={status}>
                  {
                    { DRAFT: "Черновик", WAITING: "Ожидание", LIVE: "В эфире", ENDED: "Завершена" }[
                      status
                    ]
                  }
                </option>
              ))}
            </select>
          </label>
          <label className="toggle-label">
            <input
              checked={room.reactionsEnabled}
              type="checkbox"
              onChange={(event) => void updateOwner({ reactionsEnabled: event.target.checked })}
            />
            Разрешить emoji-реакции
          </label>
          <TelegramChatBinding
            linkedUsername={room.linkedTelegramChatUsername}
            roomId={room.id}
            onChanged={refreshRoom}
          />
          <button
            className="danger-button"
            type="button"
            disabled={room.status === "ENDED"}
            onClick={() => void updateOwner({ status: "ENDED" })}
          >
            Завершить комнату
          </button>
        </section>
      ) : null}
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="notice-text" role="status">
          {notice}
        </p>
      ) : null}
    </main>
  );
}
