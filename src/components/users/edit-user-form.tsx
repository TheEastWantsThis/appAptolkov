"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUserAction } from "@/modules/users/application/actions";

const schema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2, "Укажите имя").max(160),
  email: z.string().trim().email("Введите корректный email").max(254),
  login: z
    .string()
    .trim()
    .min(3, "Минимум 3 символа")
    .max(64)
    .regex(
      /^[a-z0-9._-]+$/u,
      "Только латинские буквы, цифры, точка, дефис и _",
    ),
  roleIds: z.array(z.string().uuid()).min(1, "Назначьте хотя бы одну роль"),
});

type Values = z.infer<typeof schema>;
type RoleOption = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

export function EditUserForm({
  user,
  roles,
}: {
  user: Values;
  roles: readonly RoleOption[];
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: user });

  async function onSubmit(values: Values) {
    setServerError(null);
    const result = await updateUserAction(values);
    if (!result.ok) {
      setServerError(result.error.message);
      return;
    }
    toast.success("Изменения сохранены. Активные сессии пользователя отозваны");
    router.push("/users");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <input type="hidden" {...register("id")} />
      {serverError ? <Alert>{serverError}</Alert> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Имя" error={errors.name?.message}>
          <Input aria-invalid={Boolean(errors.name)} {...register("name")} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input
            type="email"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
        </Field>
        <Field label="Логин" error={errors.login?.message}>
          <Input
            autoCapitalize="none"
            aria-invalid={Boolean(errors.login)}
            {...register("login")}
          />
        </Field>
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-bold">Роли пользователя</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {roles.map((role) => (
            <label
              key={role.id}
              className="bg-card has-checked:border-primary has-checked:bg-primary/4 flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors"
            >
              <input
                type="checkbox"
                value={role.id}
                className="mt-0.5 size-4 accent-[var(--primary)]"
                {...register("roleIds")}
              />
              <span>
                <span className="block text-sm font-bold">{role.name}</span>
                <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
                  {role.description}
                </span>
              </span>
            </label>
          ))}
        </div>
        {errors.roleIds ? (
          <p className="text-destructive text-xs">{errors.roleIds.message}</p>
        ) : null}
      </fieldset>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Отмена
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="animate-spin" /> : <Save />}{" "}
          Сохранить
        </Button>
      </div>
    </form>
  );
}

function Field({
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
