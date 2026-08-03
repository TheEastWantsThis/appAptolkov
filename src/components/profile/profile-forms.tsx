"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, LoaderCircle, UserRound } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clientPasswordSchema } from "@/modules/auth/domain/password-policy";
import {
  changePasswordAction,
  updateProfileAction,
} from "@/modules/profile/application/actions";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(160),
});
const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Введите текущий пароль"),
    newPassword: clientPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "Новый пароль должен отличаться",
    path: ["newPassword"],
  });

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordFormSchema>;

export function ProfileNameForm({ name }: { name: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name },
  });
  async function onSubmit(values: ProfileValues) {
    setServerError(null);
    const result = await updateProfileAction(values);
    if (!result.ok) return setServerError(result.error.message);
    toast.success("Имя обновлено");
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError ? <Alert>{serverError}</Alert> : null}
      <div className="space-y-2">
        <Label htmlFor="profile-name">Имя</Label>
        <Input
          id="profile-name"
          {...register("name")}
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name ? (
          <p className="text-destructive text-xs">{errors.name.message}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <UserRound />
        )}{" "}
        Сохранить имя
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  async function onSubmit(values: PasswordValues) {
    setServerError(null);
    const result = await changePasswordAction(values);
    if (!result.ok) return setServerError(result.error.message);
    toast.success("Пароль изменён. Выполняется повторный вход");
    await signOut({ redirect: false });
    window.location.assign("/login");
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError ? <Alert>{serverError}</Alert> : null}
      <PasswordField
        label="Текущий пароль"
        error={errors.currentPassword?.message}
      >
        <Input
          type="password"
          autoComplete="current-password"
          {...register("currentPassword")}
        />
      </PasswordField>
      <PasswordField label="Новый пароль" error={errors.newPassword?.message}>
        <Input
          type="password"
          autoComplete="new-password"
          {...register("newPassword")}
        />
      </PasswordField>
      <PasswordField
        label="Повторите новый пароль"
        error={errors.confirmPassword?.message}
      >
        <Input
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
      </PasswordField>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <KeyRound />
        )}{" "}
        Сменить пароль
      </Button>
    </form>
  );
}

function PasswordField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
