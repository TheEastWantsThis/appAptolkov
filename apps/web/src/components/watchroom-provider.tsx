"use client";

import type { UserDto } from "@watchroom/shared";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { roomPublicIdFromTelegramStart } from "../lib/telegram-start";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const csrfStorageKey = "watchroom.csrf";
const accessTokenStorageKey = "watchroom.access-token";
let activeCsrfToken = "";
let activeAccessToken = "";
interface WatchRoomContextValue {
  user: UserDto | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
  logout(): Promise<void>;
  request<T>(path: string, init?: RequestInit): Promise<T>;
}
const WatchRoomContext = createContext<WatchRoomContextValue | null>(null);
async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method?.toUpperCase() ?? "GET";
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (activeAccessToken) headers.set("authorization", `Bearer ${activeAccessToken}`);
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && activeCsrfToken)
    headers.set("x-csrf-token", activeCsrfToken);
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers, credentials: "include" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message ?? "Не удалось выполнить запрос.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function readTelegramInitData(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const initData = window.Telegram?.WebApp.initData ?? "";
    if (initData) return initData;
    await new Promise((resolve) => window.setTimeout(resolve, 75));
  }
  return "";
}

export function WatchRoomProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserDto | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const routeFromStartParam = useCallback(() => {
    const webApp = window.Telegram?.WebApp;
    const publicId = roomPublicIdFromTelegramStart({
      initData: webApp?.initData ?? "",
      ...(webApp?.initDataUnsafe?.start_param
        ? { unsafeStartParam: webApp.initDataUnsafe.start_param }
        : {}),
      locationSearch: window.location.search,
      locationHash: window.location.hash,
    });
    if (publicId) router.replace(`/rooms/${publicId}`);
  }, [router]);
  useEffect(() => {
    let active = true;
    async function authenticate() {
      const cachedCsrf = sessionStorage.getItem(csrfStorageKey) ?? "";
      const cachedAccessToken = sessionStorage.getItem(accessTokenStorageKey) ?? "";
      activeCsrfToken = cachedCsrf;
      activeAccessToken = cachedAccessToken;
      try {
        if (!cachedAccessToken && !cachedCsrf) throw new Error("Session bootstrap required");
        const session = await apiRequest<{ user: UserDto }>("/v1/auth/session");
        if (active) {
          setUser(session.user);
          setAccessToken(cachedAccessToken || null);
          routeFromStartParam();
        }
      } catch {
        activeAccessToken = "";
        activeCsrfToken = "";
        sessionStorage.removeItem(accessTokenStorageKey);
        sessionStorage.removeItem(csrfStorageKey);
        try {
          const initData = await readTelegramInitData();
          if (!initData)
            throw new Error(
              "Telegram не передал данные входа. Полностью закройте Mini App и откройте его кнопкой бота ещё раз.",
            );
          const auth = await apiRequest<{
            accessToken: string;
            csrfToken: string;
            user: UserDto;
          }>("/v1/auth/telegram", {
            method: "POST",
            body: JSON.stringify({ initData }),
          });
          activeAccessToken = auth.accessToken;
          activeCsrfToken = auth.csrfToken;
          sessionStorage.setItem(accessTokenStorageKey, auth.accessToken);
          sessionStorage.setItem(csrfStorageKey, auth.csrfToken);
          if (active) {
            setUser(auth.user);
            setAccessToken(auth.accessToken);
            routeFromStartParam();
          }
        } catch (authError: unknown) {
          if (active)
            setError(
              authError instanceof Error ? authError.message : "Не удалось войти через Telegram.",
            );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void authenticate();
    return () => {
      active = false;
    };
  }, [routeFromStartParam]);
  useEffect(() => {
    if (!user) return;
    routeFromStartParam();
    window.addEventListener("watchroom:telegram-activated", routeFromStartParam);
    return () => window.removeEventListener("watchroom:telegram-activated", routeFromStartParam);
  }, [routeFromStartParam, user]);
  const logout = useCallback(async () => {
    await apiRequest("/v1/auth/logout", { method: "POST", body: "{}" });
    activeCsrfToken = "";
    activeAccessToken = "";
    sessionStorage.removeItem(csrfStorageKey);
    sessionStorage.removeItem(accessTokenStorageKey);
    setUser(null);
    setAccessToken(null);
    setError("Сессия завершена. Откройте Mini App заново для входа.");
    router.replace("/");
  }, [router]);
  const value = useMemo<WatchRoomContextValue>(
    () => ({ user, accessToken, loading, error, logout, request: apiRequest }),
    [user, accessToken, loading, error, logout],
  );
  return <WatchRoomContext.Provider value={value}>{children}</WatchRoomContext.Provider>;
}
export function useWatchRoom(): WatchRoomContextValue {
  const value = useContext(WatchRoomContext);
  if (!value) throw new Error("useWatchRoom must be used inside WatchRoomProvider");
  return value;
}
