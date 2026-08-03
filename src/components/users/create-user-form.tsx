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
import { clientPasswordSchema } from "@/modules/auth/domain/password-policy";
import { createUserAction } from "@/modules/users/application/actions";

const fullNameSchema = z
  .string()
  .trim()
  .min(5, "Укажите фамилию и имя")
  .max(160, "ФИО не должно превышать 160 символов")
  .regex(
    /^\p{L}+(?:[-']\p{L}+)*(?: \p{L}+(?:[-']\p{L}+)*){1,2}$/u,
    "Введите фамилию, имя и при наличии отчество через пробел",
  );

const schema = z.object({
  phone: z.string().trim().min(10, "Введите номер телефона").max(32),
  email: z
    .union([
      z.literal(""),
      z.string().trim().email("Введите корректный email").max(254),
    ])
    .optional(),
  login: fullNameSchema,
  password: clientPasswordSchema,
  roleIds: z.array(z.string().uuid()).min(1, "Назначьте хотя бы одну роль"),
});

type Values = z.infer<typeof schema>;
type RoleOption = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

export function CreateUserForm({ roles }: { roles: readonly RoleOption[] }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: "",
      email: "",
      login: "",
      password: "",
      roleIds: [],
    },
  });

  async function onSubmit(values: Values) {
    setServerError(null);
    const result = await createUserAction(values);
    if (!result.ok) {
      setServerError(result.error.message);
      return;
    }
    toast.success("Пользователь создан");
    router.push("/users");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {serverError ? <Alert>{serverError}</Alert> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="ФИО" error={errors.login?.message}>
          <Input
            aria-label="ФИО"
            autoComplete="name"
            aria-invalid={Boolean(errors.login)}
            placeholder="Иванов Иван Иванович"
            {...register("login")}
          />
        </Field>
        <Field label="Номер телефона" error={errors.phone?.message}>
          <Input
            aria-label="Номер телефона"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            aria-invalid={Boolean(errors.phone)}
            placeholder="+7 999 123-45-67"
            {...register("phone")}
          />
        </Field>
        <Field label="Email (необязательно)" error={errors.email?.message}>
          <Input
            aria-label="Email (необязательно)"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            placeholder="Можно оставить пустым"
            {...register("email")}
          />
        </Field>
        <Field label="Пароль из 6 символов" error={errors.password?.message}>
          <Input
            aria-label="Пароль из 6 символов"
            type="password"
            autoComplete="new-password"
            maxLength={6}
            aria-invalid={Boolean(errors.password)}
            placeholder="6 символов"
            {...register("password")}
          />
        </Field>
      </div>
      <RoleFields
        roles={roles}
        register={register}
        error={errors.roleIds?.message}
      />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Отмена
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="animate-spin" /> : <Save />}{" "}
          Создать пользователя
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

function RoleFields({
  roles,
  register,
  error,
}: {
  roles: readonly RoleOption[];
  register: ReturnType<typeof useForm<Values>>["register"];
  error?: string;
}) {
  return (
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
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </fieldset>
  );
}
