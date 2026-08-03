import { z } from "zod";

import { httpsUrlSchema } from "@/shared/validation/https-url";

const n = z.coerce.number().finite().min(0).max(100000);
const integer = z.coerce.number().int().min(0).max(10000);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

export const measurementRoomSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Укажите название").max(160),
  areaMode: z.enum(["AUTO", "MANUAL"]),
  length: n.optional(),
  width: n.optional(),
  area: n,
  perimeter: n,
  height: n.optional(),
  corners: integer,
  canvasType: optionalText(100),
  manufacturer: optionalText(120),
  color: optionalText(100),
  texture: optionalText(100),
  profileType: optionalText(100),
  profileLength: n.optional(),
  insertLength: n.optional(),
  pipes: integer,
  lights: integer,
  chandeliers: integer,
  tracks: n,
  cornices: n,
  niches: n,
  ventilation: integer,
  sensors: integer,
  cabinetBypass: n,
  additionalWorks: optionalText(2000),
  additionalWorkUnits: n,
  complexityCoefficient: z.coerce.number().finite().min(1).max(5),
  comment: optionalText(2000),
  photos: z.array(httpsUrlSchema).max(20),
  drawing: z
    .string()
    .url()
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined),
});

export const saveMeasurementSchema = z.object({
  measurementId: z.string().uuid(),
  status: z.enum(["DRAFT", "IN_PROGRESS", "COMPLETED"]),
  rooms: z.array(measurementRoomSchema).min(1, "Добавьте помещение").max(100),
});

export const scheduleProjectMeasurementSchema = z.object({
  projectId: z.string().uuid(),
  measurerId: z.string().uuid(),
  scheduledAt: z.coerce.date(),
  district: optionalText(160),
  objectType: optionalText(120),
  operatorComment: optionalText(2000),
  requiredDocuments: z.array(z.string().trim().min(1).max(200)).max(20),
});
