import { z } from "zod";

const NullableUrlSchema = z.string().url().max(2048).nullable();

export const UserSchema = z.object({
  id: z.string().uuid(),
  telegramId: z.string().regex(/^\d+$/),
  username: z.string().max(32).nullable(),
  firstName: z.string().min(1).max(64),
  lastName: z.string().max(64).nullable(),
  photoUrl: NullableUrlSchema,
  status: z.enum(["ACTIVE", "BLOCKED"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});

export const TelegramAuthRequestSchema = z.object({
  initData: z.string().max(16_384),
});

export const AuthResponseSchema = z.object({
  csrfToken: z.string().min(32),
  user: UserSchema,
});

export type UserDto = z.infer<typeof UserSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
