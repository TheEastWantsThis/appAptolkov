import { z } from "zod";

export const createEstimateSchema = z.object({
  measurementId: z.string().uuid(),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  transportZoneCode: z.string().trim().max(100).optional(),
});

export const tariffUpdateSchema = z.object({
  id: z.string().uuid(),
  internalPrice: z.coerce.number().finite().min(0).max(100000000),
  clientPrice: z.coerce.number().finite().min(0).max(100000000),
  isActive: z.boolean(),
});
