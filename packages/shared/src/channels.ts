import { z } from "zod";

export const ChannelSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Адрес должен содержать минимум 3 символа")
  .max(48, "Адрес не должен превышать 48 символов")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Используйте латиницу, цифры и дефисы");

const HttpsUrlSchema = z
  .string()
  .url("Введите корректную ссылку")
  .startsWith("https://", "Ссылка должна начинаться с https://")
  .max(2048, "Ссылка слишком длинная")
  .refine((value) => {
    const hostname = new URL(value).hostname.toLowerCase();
    return (
      hostname === "i.ytimg.com" ||
      hostname === "static-cdn.jtvnw.net" ||
      hostname.endsWith(".twitch.tv") ||
      hostname.endsWith(".telegram.org")
    );
  }, "Домен изображения не разрешён политикой безопасности");
const OptionalAvatarSchema = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) => value === undefined || value === "" || HttpsUrlSchema.safeParse(value).success,
    "Нужна HTTPS-ссылка на изображение с YouTube, Twitch или Telegram",
  );

export const CreateChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Название должно содержать минимум 2 символа")
    .max(80, "Название не должно превышать 80 символов"),
  slug: ChannelSlugSchema,
  description: z
    .string()
    .trim()
    .max(500, "Описание не должно превышать 500 символов")
    .optional()
    .default(""),
  avatarUrl: OptionalAvatarSchema,
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
});

export const UpdateChannelSchema = CreateChannelSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Нужно изменить хотя бы одно поле",
);

export const ChannelSchema = z.object({
  id: z.string().uuid(),
  publicId: z.string().min(20).max(24),
  slug: ChannelSlugSchema,
  ownerId: z.string().uuid(),
  name: z.string().min(2).max(80),
  description: z.string().max(500),
  avatarUrl: HttpsUrlSchema.nullable(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  role: z.enum(["OWNER", "MODERATOR", "MEMBER"]).nullable(),
  memberCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ChannelListSchema = z.object({ channels: z.array(ChannelSchema) });

export const ChannelMemberRoleSchema = z.enum(["OWNER", "MODERATOR", "MEMBER"]);

export const ChannelMemberSchema = z.object({
  userId: z.string().uuid(),
  username: z.string().max(32).nullable(),
  firstName: z.string().min(1).max(64),
  photoUrl: z.string().url().max(2048).nullable(),
  role: ChannelMemberRoleSchema,
  createdAt: z.string().datetime(),
});

export const ChannelMembersSchema = z.object({ members: z.array(ChannelMemberSchema) });

export const AddChannelMemberSchema = z.object({
  username: z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, "").toLowerCase())
    .pipe(z.string().regex(/^[a-z0-9_]{5,32}$/)),
  role: z.enum(["MODERATOR", "MEMBER"]).default("MEMBER"),
});

export const UpdateChannelMemberSchema = z.object({
  role: z.enum(["MODERATOR", "MEMBER"]),
});

export type CreateChannelInput = z.infer<typeof CreateChannelSchema>;
export type UpdateChannelInput = z.infer<typeof UpdateChannelSchema>;
export type ChannelDto = z.infer<typeof ChannelSchema>;
export type ChannelMemberDto = z.infer<typeof ChannelMemberSchema>;
export type AddChannelMemberInput = z.infer<typeof AddChannelMemberSchema>;
export type UpdateChannelMemberInput = z.infer<typeof UpdateChannelMemberSchema>;
