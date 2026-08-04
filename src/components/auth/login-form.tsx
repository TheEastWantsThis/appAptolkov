"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Phone } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRussianPhoneInput, normalizePhone } from "@/shared/domain/phone";

const loginFormSchema = z.object({
  phone: z.string().refine(
    (value) => {
      const normalized = normalizePhone(value);
      return normalized.length === 11 && normalized.startsWith("7");
    },
    { message: "Введите номер телефона полностью" },
  ),
  password: z.string().min(1, "Введите пароль").max(128),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { phone: "+7", password: "" },
  });
  const phoneField = register("phone");

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    const result = await signIn("credentials", {
      phone: values.phone,
      password: values.password,
      redirect: false,
    });

    if (result?.error) {
      setServerError(
        "Неверный номер телефона или пароль. Проверьте данные и повторите попытку",
      );
      return;
    }
    window.location.assign("/dashboard");
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      {serverError ? <Alert>{serverError}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="phone">Номер телефона</Label>
        <div className="relative">
          <Phone className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={18}
            className="pl-10"
            aria-invalid={Boolean(errors.phone)}
            placeholder="+7 (999) 123-45-67"
            {...phoneField}
            onChange={(event) => {
              event.target.value = formatRussianPhoneInput(event.target.value);
              void phoneField.onChange(event);
            }}
          />
        </div>
        {errors.phone ? (
          <p className="text-destructive text-xs">{errors.phone.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Пароль</Label>
        <div className="relative">
          <LockKeyhole className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="px-10"
            aria-invalid={Boolean(errors.password)}
            placeholder="Введите пароль"
            {...register("password")}
          />
          <button
            type="button"
            className="text-muted-foreground hover:bg-muted absolute top-1/2 right-2.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
        {errors.password ? (
          <p className="text-destructive text-xs">{errors.password.message}</p>
        ) : null}
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <LockKeyhole />
        )}
        {isSubmitting ? "Проверяем…" : "Войти в систему"}
      </Button>
    </form>
  );
}
