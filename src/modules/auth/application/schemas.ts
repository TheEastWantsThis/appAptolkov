import { z } from "zod";

import { passwordSchema } from "@/modules/auth/application/password";

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Введите email или логин").max(254),
  password: z.string().min(1, "Введите пароль").max(128),
});

const emailSchema = z
  .string()
  .trim()
  .email("Введите корректный email")
  .max(254)
  .transform((value) => value.toLowerCase());

const loginNameSchema = z
  .string()
  .trim()
  .min(3, "Логин должен содержать не менее 3 символов")
  .max(64)
  .regex(
    /^[a-z0-9._-]+$/u,
    "Допустимы латинские буквы, цифры, точка, дефис и подчёркивание",
  )
  .transform((value) => value.toLowerCase());

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(160),
  email: emailSchema,
  login: loginNameSchema,
  password: passwordSchema,
  roleIds: z.array(z.string().uuid()).min(1, "Назначьте хотя бы одну роль"),
});

export const updateUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2, "Укажите имя").max(160),
  email: emailSchema,
  login: loginNameSchema,
  roleIds: z.array(z.string().uuid()).min(1, "Назначьте хотя бы одну роль"),
});

export const userStatusSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(3, "Укажите причину").max(500).optional(),
});

export const resetPasswordSchema = z.object({
  id: z.string().uuid(),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(160),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Введите текущий пароль").max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "Новый пароль должен отличаться от текущего",
    path: ["newPassword"],
  });
