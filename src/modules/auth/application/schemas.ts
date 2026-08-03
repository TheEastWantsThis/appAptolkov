import { z } from "zod";

import { passwordSchema } from "@/modules/auth/application/password";

export const loginSchema = z.object({
  phone: z.string().trim().min(10, "Введите номер телефона").max(32),
  password: z.string().min(1, "Введите пароль").max(128),
});

const emailSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .trim()
    .email("Введите корректный email")
    .max(254)
    .transform((value) => value.toLowerCase())
    .optional(),
);

const loginNameSchema = z
  .string()
  .trim()
  .min(5, "Укажите фамилию и имя")
  .max(160, "ФИО не должно превышать 160 символов")
  .regex(
    /^\p{L}+(?:[-']\p{L}+)*(?: \p{L}+(?:[-']\p{L}+)*){1,2}$/u,
    "Введите фамилию, имя и при наличии отчество через пробел",
  )
  .transform((value) => value.replace(/\s+/gu, " "));

export const createUserSchema = z.object({
  phone: z.string().trim().min(10, "Введите номер телефона").max(32),
  email: emailSchema,
  login: loginNameSchema,
  password: passwordSchema,
  roleIds: z.array(z.string().uuid()).min(1, "Назначьте хотя бы одну роль"),
});

export const updateUserSchema = z.object({
  id: z.string().uuid(),
  phone: z.string().trim().min(10, "Введите номер телефона").max(32),
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
