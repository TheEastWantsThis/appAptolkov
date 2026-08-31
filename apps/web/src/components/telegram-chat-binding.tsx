"use client";

import { useCallback, useEffect, useState } from "react";

import { useWatchRoom } from "./watchroom-provider";

interface BindingRequest {
  requestToken: string;
  preparedButtonId: string;
  expiresAt: string;
}

interface BindingStatus {
  status: "PENDING" | "BOUND" | "FAILED" | "EXPIRED";
  message: string | null;
}

export function supportsTelegramChatRequest(webApp?: Pick<TelegramWebApp, "requestChat">): boolean {
  return typeof webApp?.requestChat === "function";
}

export function TelegramChatBinding({
  roomId,
  linkedUsername,
  onChanged,
}: {
  roomId: string;
  linkedUsername: string | null;
  onChanged(): Promise<void>;
}) {
  const { request } = useWatchRoom();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const storageKey = `watchroom.telegram-binding.${roomId}`;

  const checkStatus = useCallback(
    async (requestToken: string): Promise<BindingStatus> => {
      const status = await request<BindingStatus>(
        `/v1/rooms/${roomId}/telegram-chat/requests/${requestToken}`,
      );
      if (status.status === "BOUND") {
        sessionStorage.removeItem(storageKey);
        setNotice("Telegram-обсуждение подтверждено.");
        await onChanged();
      } else if (status.status === "FAILED" || status.status === "EXPIRED") {
        sessionStorage.removeItem(storageKey);
        setNotice(status.message ?? "Не удалось подтвердить выбранный чат.");
      }
      return status;
    },
    [onChanged, request, roomId, storageKey],
  );

  const poll = useCallback(
    async (requestToken: string) => {
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        const status = await checkStatus(requestToken);
        if (status.status !== "PENDING") return;
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
      setNotice(
        "Telegram ещё обрабатывает выбор. Проверка продолжится после возврата в приложение.",
      );
    },
    [checkStatus],
  );

  useEffect(() => {
    const resume = () => {
      const pending = sessionStorage.getItem(storageKey);
      if (pending) void poll(pending).catch(() => setNotice("Не удалось проверить выбор чата."));
    };
    resume();
    window.addEventListener("watchroom:telegram-activated", resume);
    return () => window.removeEventListener("watchroom:telegram-activated", resume);
  }, [poll, storageKey]);

  async function chooseChat() {
    const webApp = window.Telegram?.WebApp;
    if (!webApp?.requestChat) {
      setNotice("Обновите Telegram и откройте WatchRoom как Mini App, затем повторите выбор.");
      return;
    }
    setBusy(true);
    try {
      const prepared = await request<BindingRequest>(`/v1/rooms/${roomId}/telegram-chat/request`, {
        method: "POST",
        body: "{}",
      });
      sessionStorage.setItem(storageKey, prepared.requestToken);
      webApp.requestChat(prepared.preparedButtonId, (sent) => {
        if (!sent) {
          sessionStorage.removeItem(storageKey);
          setNotice("Выбор отменён или Telegram не отправил подтверждение боту.");
          setBusy(false);
          return;
        }
        setNotice("Проверяем чат и права через Telegram…");
        void poll(prepared.requestToken).finally(() => setBusy(false));
      });
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Не удалось открыть выбор чата.");
      setBusy(false);
    }
  }

  async function unbind() {
    setBusy(true);
    try {
      await request(`/v1/rooms/${roomId}/telegram-chat`, { method: "DELETE" });
      setNotice("Telegram-обсуждение отвязано.");
      await onChanged();
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Не удалось отвязать чат.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="telegram-binding">
      <div>
        <strong>Telegram-обсуждение</strong>
        <p className="muted">
          {linkedUsername
            ? `Привязано: @${linkedUsername}`
            : "Только существующая публичная группа, где вы администратор, а бот — участник."}
        </p>
      </div>
      <div className="button-row">
        <button className="secondary-button" disabled={busy} type="button" onClick={chooseChat}>
          {linkedUsername ? "Сменить группу" : "Выбрать группу"}
        </button>
        {linkedUsername ? (
          <button className="danger-button" disabled={busy} type="button" onClick={unbind}>
            Отвязать
          </button>
        ) : null}
      </div>
      {!supportsTelegramChatRequest(
        typeof window === "undefined" ? undefined : window.Telegram?.WebApp,
      ) ? (
        <ol className="telegram-binding-help">
          <li>Создайте публичную группу или группу обсуждений в Telegram.</li>
          <li>Добавьте бота WatchRoom как участника.</li>
          <li>Убедитесь, что вы администратор, и откройте Mini App в обновлённом Telegram.</li>
        </ol>
      ) : null}
      {notice ? (
        <p className="notice-text" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
