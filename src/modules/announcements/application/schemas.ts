import { z } from "zod";

export const announcementSchema = z.object({
  title: z.string().trim().min(1, "Введите заголовок").max(160),
  content: z.string().trim().min(1, "Введите текст объявления").max(2000),
});

export const announcementIdSchema = z.object({
  id: z.string().uuid(),
});

export const updateAnnouncementSchema = announcementSchema.extend({
  id: z.string().uuid(),
});
