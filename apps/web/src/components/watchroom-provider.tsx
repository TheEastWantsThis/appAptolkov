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
let activeCsrfToken = "";
interface WatchRoomContextValue {
  user: UserDto | null;
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
export function WatchRoomProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserDto | null>(null);
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
      activeCsrfToken = cachedCsrf;
      try {
        if (!cachedCsrf) throw new Error("CSRF bootstrap required");
        const session = await apiRequest<{ user: UserDto }>("/v1/auth/session");
        if (active) {
          setUser(session.user);
          routeFromStartParam();
        }
      } catch {
        try {
          const auth = await apiRequest<{ csrfToken: string; user: UserDto }>("/v1/auth/telegram", {
            method: "POST",
            body: JSON.stringify({ initData: window.Telegram?.WebApp.initData ?? "" }),
          });
          activeCsrfToken = auth.csrfToken;
          sessionStorage.setItem(csrfStorageKey, auth.csrfToken);
          if (active) {
            setUser(auth.user);
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
    sessionStorage.removeItem(csrfStorageKey);
    setUser(null);
    setError("Сессия завершена. Откройте Mini App заново для входа.");
    router.replace("/");
  }, [router]);
  const value = useMemo<WatchRoomContextValue>(
    () => ({ user, loading, error, logout, request: apiRequest }),
    [user, loading, error, logout],
  );
  return <WatchRoomContext.Provider value={value}>{children}</WatchRoomContext.Provider>;
}
export function useWatchRoom(): WatchRoomContextValue {
  const value = useContext(WatchRoomContext);
  if (!value) throw new Error("useWatchRoom must be used inside WatchRoomProvider");
  return value;
}
