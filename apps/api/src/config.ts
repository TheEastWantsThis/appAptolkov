import { z } from "zod";

const PortSchema = z.coerce.number().int().min(1).max(65_535);
const PositiveMillisecondsSchema = z.coerce.number().int().min(1_000).max(60_000);
const HttpsUrlSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:", "Требуется HTTPS URL");
const WssUrlSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "wss:", "Требуется WSS URL");

export const ApiConfigSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_HOST: z.string().min(1).default("0.0.0.0"),
    API_PORT: PortSchema.default(4_000),
    DATABASE_URL: z.string().url().startsWith("postgresql://"),
    WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
    PUBLIC_APP_URL: HttpsUrlSchema.optional(),
    API_URL: HttpsUrlSchema.optional(),
    WS_URL: WssUrlSchema.optional(),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    SHUTDOWN_TIMEOUT_MS: PositiveMillisecondsSchema.default(10_000),
    HTTP_BODY_LIMIT_BYTES: z.coerce.number().int().min(16_384).max(262_144).default(65_536),
    METRICS_BEARER_TOKEN: z.string().min(32).max(256).optional(),
    OPERATIONS_BEARER_TOKEN: z.string().min(32).max(256).optional(),
    TELEGRAM_BOT_TOKEN: z.string().min(20).optional(),
    TELEGRAM_WEBHOOK_SECRET: z.string().min(32).max(256).optional(),
    TELEGRAM_AUTH_MAX_AGE_SECONDS: z.coerce.number().int().min(60).max(3_600).default(300),
    TELEGRAM_AUTH_FUTURE_SKEW_SECONDS: z.coerce.number().int().min(0).max(300).default(30),
    SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(86_400).default(43_200),
    ROOM_GRANT_TTL_SECONDS: z.coerce.number().int().min(300).max(86_400).default(14_400),
    TELEGRAM_BOT_USERNAME: z
      .string()
      .trim()
      .regex(/^[A-Za-z][A-Za-z0-9_]{4,31}$/)
      .default("watchroom_bot"),
    TELEGRAM_APP_SHORT_NAME: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{3,64}$/)
      .default("watchroom"),
    MOCK_TELEGRAM_AUTH: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    MOCK_TELEGRAM_ID: z.coerce
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER)
      .default(900_000_001),
    MOCK_TELEGRAM_FIRST_NAME: z.string().trim().min(1).max(64).default("Локальный автор"),
    YOUTUBE_API_KEY: z.string().trim().min(10).optional(),
    TWITCH_CLIENT_ID: z.string().trim().min(5).optional(),
    TWITCH_CLIENT_SECRET: z.string().trim().min(10).optional(),
    PROVIDER_METADATA_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
    PROVIDER_METADATA_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(120).default(20),
    REALTIME_HEARTBEAT_TIMEOUT_MS: z.coerce.number().int().min(10_000).max(120_000).default(45_000),
    REALTIME_PRESENCE_GRACE_MS: z.coerce.number().int().min(0).max(30_000).default(8_000),
    CHAT_CLEANUP_INTERVAL_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(60_000),
    CREATE_ROOM_RATE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).max(100).default(10),
    SOURCE_CHANGE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(120).default(20),
    CHAT_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(120).default(20),
    REACTION_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(240).default(60),
    ABUSE_REPORT_RATE_LIMIT_PER_DAY: z.coerce.number().int().min(1).max(20).default(5),
  })
  .superRefine((config, context) => {
    if (config.NODE_ENV === "production" && config.MOCK_TELEGRAM_AUTH) {
      context.addIssue({
        code: "custom",
        path: ["MOCK_TELEGRAM_AUTH"],
        message: "MOCK_TELEGRAM_AUTH запрещён в production",
      });
    }
    if (config.NODE_ENV === "production") {
      for (const key of ["PUBLIC_APP_URL", "API_URL", "WS_URL"] as const) {
        if (!config[key])
          context.addIssue({
            code: "custom",
            path: [key],
            message: `${key} обязателен в production`,
          });
      }
      if (!config.METRICS_BEARER_TOKEN)
        context.addIssue({
          code: "custom",
          path: ["METRICS_BEARER_TOKEN"],
          message: "METRICS_BEARER_TOKEN обязателен в production",
        });
      if (!config.OPERATIONS_BEARER_TOKEN)
        context.addIssue({
          code: "custom",
          path: ["OPERATIONS_BEARER_TOKEN"],
          message: "OPERATIONS_BEARER_TOKEN обязателен в production",
        });
      if (!config.TELEGRAM_WEBHOOK_SECRET)
        context.addIssue({
          code: "custom",
          path: ["TELEGRAM_WEBHOOK_SECRET"],
          message: "TELEGRAM_WEBHOOK_SECRET обязателен в production",
        });
      if (config.PUBLIC_APP_URL && new URL(config.PUBLIC_APP_URL).origin !== config.WEB_ORIGIN)
        context.addIssue({
          code: "custom",
          path: ["WEB_ORIGIN"],
          message: "WEB_ORIGIN должен совпадать с origin PUBLIC_APP_URL",
        });
      if (
        config.API_URL &&
        config.WS_URL &&
        new URL(config.API_URL).hostname !== new URL(config.WS_URL).hostname
      )
        context.addIssue({
          code: "custom",
          path: ["WS_URL"],
          message: "API_URL и WS_URL должны использовать один hostname",
        });
    }
    if (!config.MOCK_TELEGRAM_AUTH && !config.TELEGRAM_BOT_TOKEN) {
      context.addIssue({
        code: "custom",
        path: ["TELEGRAM_BOT_TOKEN"],
        message: "TELEGRAM_BOT_TOKEN обязателен без mock-аутентификации",
      });
    }
    if (Boolean(config.TWITCH_CLIENT_ID) !== Boolean(config.TWITCH_CLIENT_SECRET)) {
      context.addIssue({
        code: "custom",
        path: ["TWITCH_CLIENT_ID"],
        message: "TWITCH_CLIENT_ID и TWITCH_CLIENT_SECRET задаются вместе",
      });
    }
  });

export type ApiConfig = z.infer<typeof ApiConfigSchema>;

export function loadApiConfig(environment: NodeJS.ProcessEnv): ApiConfig {
  return ApiConfigSchema.parse(environment);
}
