import "server-only";

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL не задан"),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET должен содержать не менее 32 символов"),
  AUTH_TRUST_HOST: z.string().optional(),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
});
