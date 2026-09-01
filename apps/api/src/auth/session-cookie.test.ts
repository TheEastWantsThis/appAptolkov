import { describe, expect, it } from "vitest";

import { sessionCookieOptions } from "./session-cookie.js";

describe("session cookie topology", () => {
  it("uses a secure partitioned cross-site cookie in production", () => {
    expect(sessionCookieOptions("production")).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
      path: "/",
    });
  });

  it("keeps local development compatible with HTTP", () => {
    expect(sessionCookieOptions("development")).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      partitioned: false,
      path: "/",
    });
  });
});
