import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

export const createLeadSchema = z.object({
  clientName: optionalText(160),
  phone: z.string().trim().min(10, "Введите корректный телефон").max(32),
  districtOrAddress: optionalText(500),
  housingType: z
    .enum(["APARTMENT", "HOUSE", "COMMERCIAL", "NEW_BUILD", "OTHER"])
    .optional(),
  roomsApprox: z.coerce.number().int().min(1).max(50).optional(),
  repairTimeline: optionalText(160),
  preferredCallTime: optionalText(160),
  comment: optionalText(2000),
  adPoint: optionalText(200),
  contactConsent: z
    .boolean()
    .refine((value) => value, "Необходимо согласие клиента на связь"),
});

export const callLogSchema = z.object({
  leadId: z.string().uuid(),
  result: z.enum([
    "NO_ANSWER",
    "CALLBACK",
    "INTERESTED",
    "MEASUREMENT",
    "DECLINED",
    "WRONG_NUMBER",
  ]),
  note: optionalText(2000),
  nextContactAt: z.coerce.date().optional(),
  declineReason: optionalText(500),
});

export const measurementSchema = z.object({
  leadId: z.string().uuid(),
  measurerId: z.string().uuid(),
  measurementAt: z.coerce.date(),
  note: optionalText(1000),
});

export const createProjectFromLeadSchema = z.object({
  leadId: z.string().uuid(),
  customerName: z.string().trim().min(2, "Укажите имя клиента").max(160),
  address: z.string().trim().min(5, "Укажите адрес").max(500),
  description: optionalText(2000),
});

export const leadTaskSchema = z.object({
  leadId: z.string().uuid(),
  title: z.string().trim().min(2, "Укажите задачу").max(300),
  dueAt: z.coerce.date().optional(),
  description: z.string().trim().max(2000).optional(),
});
