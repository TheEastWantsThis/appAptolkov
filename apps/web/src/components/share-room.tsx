"use client";

import { useEffect, useState } from "react";

import { useWatchRoom } from "./watchroom-provider";

interface InviteLinks {
  canonical: string;
  compact: string;
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    return copied;
  } catch {
    return false;
  }
}

export function ShareRoom({
  publicId,
  grantToken,
}: {
  publicId: string;
  grantToken: string | null;
}) {
  const { request } = useWatchRoom();
  const [notice, setNotice] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteLinks | null>(null);

  async function links(): Promise<InviteLinks> {
    if (invite) return invite;
    const loaded = await request<InviteLinks>(`/v1/rooms/${publicId}/invite`);
    setInvite(loaded);
    return loaded;
  }

  useEffect(() => {
    void Promise.resolve()
      .then(() => request<InviteLinks>(`/v1/rooms/${publicId}/invite`))
      .then(setInvite)
      .catch(() => undefined);
  }, [publicId, request]);

  async function copy(compact = false) {
    const invite = await links();
    const copied = await copyText(compact ? invite.compact : invite.canonical);
    setNotice(copied ? "Ссылка скопирована" : "Не удалось скопировать — выделите ссылку вручную.");
  }

  async function shareTelegram() {
    try {
      const prepared = await request<{ preparedMessageId: string }>(
        `/v1/rooms/${publicId}/share-message`,
        {
          method: "POST",
          ...(grantToken ? { headers: { "x-room-grant": grantToken } } : {}),
          body: "{}",
        },
      );
      const shareMessage = window.Telegram?.WebApp.shareMessage;
      if (!shareMessage) throw new Error("UNSUPPORTED");
      shareMessage(prepared.preparedMessageId, (success) => {
        setNotice(success ? "Сообщение отправлено" : "Отправка отменена");
      });
    } catch {
      const invite = await links();
      const switchInlineQuery = window.Telegram?.WebApp.switchInlineQuery;
      if (switchInlineQuery) {
        switchInlineQuery(`room_${publicId}`, ["users", "groups", "channels"]);
        setNotice("Выберите чат в Telegram");
        return;
      }
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(invite.canonical)}`;
      if (window.Telegram?.WebApp.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(shareUrl);
        setNotice("Открываем Telegram");
      } else {
        const copied = await copyText(invite.canonical);
        setNotice(copied ? "Ссылка скопирована" : "Telegram-шаринг недоступен");
      }
    }
  }

  async function shareSystem() {
    if (!invite) {
      setNotice("Ссылка ещё готовится. Нажмите «Поделиться» ещё раз.");
      void links().catch(() => setNotice("Не удалось подготовить ссылку"));
      return;
    }
    try {
      if (!navigator.share) throw new Error("UNSUPPORTED");
      await navigator.share({ title: "WatchRoom", url: invite.canonical });
      setNotice("Ссылка передана");
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const copied = await copyText(invite.canonical);
      setNotice(
        copied ? "Системное меню недоступно — ссылка скопирована" : "Не удалось поделиться",
      );
    }
  }

  return (
    <div className="share-block">
      <div className="button-row wrap-row">
        <button className="secondary-button" type="button" onClick={() => void copy()}>
          Копировать
        </button>
        <button className="secondary-button" type="button" onClick={() => void copy(true)}>
          Compact-ссылка
        </button>
        <button className="primary-button" type="button" onClick={() => void shareTelegram()}>
          В Telegram
        </button>
        <button className="secondary-button" type="button" onClick={() => void shareSystem()}>
          Поделиться…
        </button>
      </div>
      {invite ? (
        <label>
          Ссылка-приглашение
          <input aria-label="Ссылка-приглашение" readOnly value={invite.canonical} />
        </label>
      ) : null}
      {notice ? (
        <p className="notice-text" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
