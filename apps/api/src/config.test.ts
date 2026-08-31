import { describe, expect, it } from "vitest";

import { loadApiConfig } from "./config.js";

const validEnvironment = {
  NODE_ENV: "test",
  API_HOST: "127.0.0.1",
  API_PORT: "4100",
  DATABASE_URL: "postgresql://watchroom:watchroom@localhost:5432/watchroom_test",
  WEB_ORIGIN: "http://localhost:3000",
  LOG_LEVEL: "silent",
  SHUTDOWN_TIMEOUT_MS: "5000",
  MOCK_TELEGRAM_AUTH: "true",
} satisfies NodeJS.ProcessEnv;

describe("loadApiConfig", () => {
  it("coerces and validates a complete environment", () => {
    const config = loadApiConfig(validEnvironment);

    expect(config.API_PORT).toBe(4100);
    expect(config.SHUTDOWN_TIMEOUT_MS).toBe(5000);
    expect(config.NODE_ENV).toBe("test");
  });

  it("rejects a non-PostgreSQL database URL", () => {
    expect(() =>
      loadApiConfig({
        ...validEnvironment,
        DATABASE_URL: "https://example.com/database",
      }),
    ).toThrow();
  });

  it("rejects an invalid port", () => {
    expect(() =>
      loadApiConfig({
        ...validEnvironment,
        API_PORT: "70000",
      }),
    ).toThrow();
  });

  it("rejects mock Telegram auth in production", () => {
    expect(() =>
      loadApiConfig({
        ...validEnvironment,
        NODE_ENV: "production",
        MOCK_TELEGRAM_AUTH: "true",
      }),
    ).toThrow("MOCK_TELEGRAM_AUTH запрещён в production");
  });

  it("requires Twitch credentials as a pair", () => {
    expect(() => loadApiConfig({ ...validEnvironment, TWITCH_CLIENT_ID: "client-only" })).toThrow(
      "TWITCH_CLIENT_ID и TWITCH_CLIENT_SECRET задаются вместе",
    );
  });

  it("accepts a complete HTTPS/WSS production topology", () => {
    const config = loadApiConfig({
      ...validEnvironment,
      NODE_ENV: "production",
      MOCK_TELEGRAM_AUTH: "false",
      TELEGRAM_BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyzABCDEFG",
      TELEGRAM_WEBHOOK_SECRET: "w".repeat(32),
      METRICS_BEARER_TOKEN: "m".repeat(32),
      OPERATIONS_BEARER_TOKEN: "o".repeat(32),
      PUBLIC_APP_URL: "https://app.watchroom.example",
      WEB_ORIGIN: "https://app.watchroom.example",
      API_URL: "https://api.watchroom.example",
      WS_URL: "wss://api.watchroom.example",
    });

    expect(config.WS_URL).toBe("wss://api.watchroom.example");
  });

  it("requires the private operations token in production", () => {
    expect(() =>
      loadApiConfig({
        ...validEnvironment,
        NODE_ENV: "production",
        MOCK_TELEGRAM_AUTH: "false",
        TELEGRAM_BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyzABCDEFG",
        TELEGRAM_WEBHOOK_SECRET: "w".repeat(32),
        METRICS_BEARER_TOKEN: "m".repeat(32),
        PUBLIC_APP_URL: "https://app.watchroom.example",
        WEB_ORIGIN: "https://app.watchroom.example",
        API_URL: "https://api.watchroom.example",
        WS_URL: "wss://api.watchroom.example",
      }),
    ).toThrow("OPERATIONS_BEARER_TOKEN обязателен в production");
  });

  it("rejects an insecure or inconsistent production topology", () => {
    expect(() =>
      loadApiConfig({
        ...validEnvironment,
        NODE_ENV: "production",
        MOCK_TELEGRAM_AUTH: "false",
        TELEGRAM_BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyzABCDEFG",
        TELEGRAM_WEBHOOK_SECRET: "w".repeat(32),
        METRICS_BEARER_TOKEN: "m".repeat(32),
        PUBLIC_APP_URL: "http://app.watchroom.example",
        WEB_ORIGIN: "https://wrong.watchroom.example",
        API_URL: "https://api.watchroom.example",
        WS_URL: "wss://wrong.watchroom.example",
      }),
    ).toThrow();
  });
});
