import { describe, expect, it } from "vitest";

import { HealthResponseSchema } from "./health.js";

describe("HealthResponseSchema", () => {
  it("accepts the shared health contract", () => {
    const result = HealthResponseSchema.safeParse({
      status: "ok",
      service: "watchroom-api",
      version: "0.0.0",
      timestamp: "2026-08-29T12:00:00.000Z",
      checks: [{ name: "database", status: "ok" }],
    });

    expect(result.success).toBe(true);
  });

  it("rejects an unknown status", () => {
    const result = HealthResponseSchema.safeParse({
      status: "unknown",
      service: "watchroom-api",
      version: "0.0.0",
      timestamp: "2026-08-29T12:00:00.000Z",
      checks: [],
    });

    expect(result.success).toBe(false);
  });
});
