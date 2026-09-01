import type { ApiConfig } from "../config.js";

export function sessionCookieOptions(environment: ApiConfig["NODE_ENV"]) {
  const production = environment === "production";
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? ("none" as const) : ("lax" as const),
    partitioned: production,
    path: "/",
  };
}
