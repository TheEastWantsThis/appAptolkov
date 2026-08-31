import { z } from "zod";

export const HealthCheckSchema = z.object({
  name: z.string().min(1),
  status: z.enum(["ok", "error"]),
});

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.enum(["watchroom-api", "watchroom-web"]),
  version: z.string().min(1),
  timestamp: z.iso.datetime({ offset: true }),
  checks: z.array(HealthCheckSchema).default([]),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
