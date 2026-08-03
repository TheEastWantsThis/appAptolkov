import { z } from "zod";

export const projectStatusSchema = z.object({
  projectId: z.string().uuid(),
  status: z.enum([
    "QUALIFIED",
    "MEASUREMENT_SCHEDULED",
    "MEASURED",
    "ESTIMATE_PREPARATION",
    "CONTRACT_PENDING",
    "CONTRACT_SIGNED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
  ]),
  comment: z.string().trim().max(1000).optional(),
});
export const projectCommentSchema = z.object({
  projectId: z.string().uuid(),
  body: z.string().trim().min(1, "Введите комментарий").max(3000),
});
export const projectTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(2).max(300),
  description: z.string().trim().max(2000).optional(),
  assigneeId: z.string().uuid().optional(),
  dueAt: z.coerce.date().optional(),
});
export const projectEventSchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum([
    "CALL",
    "MEASUREMENT",
    "MEETING",
    "INSTALLATION",
    "DEADLINE",
    "OTHER",
  ]),
  title: z.string().trim().min(2).max(300),
  startsAt: z.coerce.date(),
  assigneeId: z.string().uuid().optional(),
  note: z.string().trim().max(1000).optional(),
});
export const projectRoomSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  area: z.coerce.number().positive().max(10000).optional(),
  description: z.string().trim().max(1000).optional(),
});
export const assignmentSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  roleLabel: z.string().trim().min(2).max(100),
});

export const projectFileSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  storageKey: z.string().trim().url("Укажите корректную ссылку").max(500),
  mimeType: z.string().trim().max(120).default("application/octet-stream"),
});

export const taskStatusSchema = z.object({
  taskId: z.string().uuid(),
  projectId: z.string().uuid(),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"]),
});
