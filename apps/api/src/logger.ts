import type { ApiConfig } from "./config.js";

const sensitivePaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers.x-room-grant",
  "res.headers.set-cookie",
  "*.authorization",
  "*.cookie",
  "*.initData",
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.grantToken",
  "*.botToken",
  "*.telegramBotToken",
  "*.client_secret",
] as const;

interface RequestLogValue {
  hostname?: unknown;
  method?: unknown;
  remoteAddress?: unknown;
  url?: unknown;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function serializeRequest(request: RequestLogValue): Record<string, string | undefined> {
  const url = asString(request.url);

  return {
    method: asString(request.method),
    path: url?.split("?", 1)[0],
    hostname: asString(request.hostname),
    remoteAddress: asString(request.remoteAddress),
  };
}

export function createLoggerOptions(config: ApiConfig) {
  return {
    level: config.LOG_LEVEL,
    redact: {
      paths: [...sensitivePaths],
      censor: "[REDACTED]",
    },
    serializers: {
      req: serializeRequest,
    },
  };
}
