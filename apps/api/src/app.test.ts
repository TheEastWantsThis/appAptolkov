import { HealthResponseSchema } from "@watchroom/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApi, type ApiRuntime } from "./app.js";
import { loadApiConfig } from "./config.js";
import type { DatabaseHealth } from "./database.js";
import { MemoryWatchRoomStore } from "./store.js";

const config = loadApiConfig({
  NODE_ENV: "test",
  API_HOST: "127.0.0.1",
  API_PORT: "4000",
  DATABASE_URL: "postgresql://watchroom:watchroom@localhost:5432/watchroom_test",
  WEB_ORIGIN: "http://localhost:3000",
  LOG_LEVEL: "silent",
  SHUTDOWN_TIMEOUT_MS: "5000",
  MOCK_TELEGRAM_AUTH: "true",
});

let runtime: ApiRuntime | undefined;

afterEach(async () => {
  await runtime?.close();
  runtime = undefined;
});

describe("health endpoints", () => {
  it("returns a valid live health response", async () => {
    const database: DatabaseHealth = {
      ping: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };
    runtime = createApi(config, { database, store: new MemoryWatchRoomStore() });

    const response = await runtime.app.inject({ method: "GET", url: "/health/live" });
    const body = HealthResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("watchroom-api");
  });

  it("reports database readiness", async () => {
    const database: DatabaseHealth = {
      ping: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };
    runtime = createApi(config, { database, store: new MemoryWatchRoomStore() });

    const response = await runtime.app.inject({ method: "GET", url: "/health/ready" });
    const body = HealthResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(body.checks).toContainEqual({ name: "database", status: "ok" });
  });

  it("protects aggregate metrics with a bearer token", async () => {
    const database: DatabaseHealth = {
      ping: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };
    const metricsConfig = {
      ...config,
      METRICS_BEARER_TOKEN: "test-metrics-token-with-enough-entropy",
    };
    runtime = createApi(metricsConfig, { database, store: new MemoryWatchRoomStore() });

    const denied = await runtime.app.inject({ method: "GET", url: "/metrics" });
    const allowed = await runtime.app.inject({
      method: "GET",
      url: "/metrics",
      headers: { authorization: "Bearer test-metrics-token-with-enough-entropy" },
    });

    expect(denied.statusCode).toBe(401);
    expect(allowed.statusCode).toBe(200);
    expect(allowed.headers["content-type"]).toContain("text/plain");
    expect(allowed.body).toContain("watchroom_websocket_connections");
    expect(allowed.body).not.toContain("userId");
  });

  it("rejects request bodies above the configured limit", async () => {
    const database: DatabaseHealth = {
      ping: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };
    runtime = createApi(config, { database, store: new MemoryWatchRoomStore() });

    const response = await runtime.app.inject({
      method: "POST",
      url: "/v1/auth/telegram",
      headers: { origin: config.WEB_ORIGIN },
      payload: { initData: "x".repeat(config.HTTP_BODY_LIMIT_BYTES + 1) },
    });

    expect(response.statusCode).toBe(413);
  });
});
