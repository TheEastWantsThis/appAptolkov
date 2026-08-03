import { z } from "zod";

import { INSTALLATION_STATUSES } from "@/modules/installations/domain/state-machine";

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.string().trim().max(max).optional(),
  );
const dateValue = z.coerce.date();
const urlList = z
  .array(z.string().trim().url("Укажите корректную ссылку"))
  .max(40);

export const scheduleInstallationSchema = z
  .object({
    projectId: z.string().uuid(),
    startsAt: dateValue,
    durationMinutes: z.coerce.number().int().min(30).max(1440),
    installerIds: z.array(z.string().uuid()).min(1).max(20),
    foremanId: z.string().uuid(),
    vehicle: optionalText(200),
    schedulerComment: optionalText(2000),
    plannedMaterials: z.array(z.string().trim().min(1).max(300)).max(100),
    plannedTools: z.array(z.string().trim().min(1).max(300)).max(100),
    technicalBrief: z.string().trim().min(3).max(5000),
    specialConditions: optionalText(2000),
    crewComment: optionalText(2000),
    allowConflicts: z.boolean().default(false),
  })
  .refine((data) => data.installerIds.includes(data.foremanId), {
    path: ["foremanId"],
    message: "Бригадир должен входить в состав монтажников",
  });

const materialUsageSchema = z.object({
  name: z.string().trim().min(1).max(255),
  quantity: z.coerce.number().positive().max(100000),
  unit: z.string().trim().min(1).max(32),
});

export const updateInstallationProgressSchema = z.object({
  installationId: z.string().uuid(),
  status: z.enum(INSTALLATION_STATUSES),
  actualStartedAt: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    dateValue.optional(),
  ),
  actualEndedAt: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    dateValue.optional(),
  ),
  beforePhotos: urlList,
  processPhotos: urlList,
  afterPhotos: urlList,
  usedMaterials: z.array(materialUsageSchema).max(100),
  workComment: optionalText(3000),
  issues: optionalText(3000),
  responsibleSignature: optionalText(1000),
  accepted: z.boolean(),
});

export const repeatInstallationSchema = z.object({
  installationId: z.string().uuid(),
  startsAt: dateValue,
  durationMinutes: z.coerce.number().int().min(30).max(1440),
  allowConflicts: z.boolean().default(false),
});
