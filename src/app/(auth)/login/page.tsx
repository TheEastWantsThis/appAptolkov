import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookOpenCheck, CheckCircle2, ShieldCheck } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthContext } from "@/modules/auth/application/auth-context";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage() {
  const context = await getAuthContext();
  if (context) {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="mesh-panel relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute -top-36 -right-24 size-96 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white/12">
            <BookOpenCheck className="size-6 text-cyan-200" />
          </div>
          <div>
            <div className="text-lg font-bold">Aпотолков CRM</div>
            <div className="text-xs text-blue-100/65">
              Внутреннее рабочее пространство
            </div>
          </div>
        </div>

        <div className="relative max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-xs font-semibold text-cyan-100">
            <ShieldCheck className="size-3.5" />
            Серверная проверка доступа
          </div>
          <h1 className="text-4xl leading-tight font-extrabold tracking-tight xl:text-5xl">
            Все рабочие процессы команды — в одном защищённом контуре.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-blue-100/70">
            Каркас управления пользователями, ролями и аудитом готов к
            подключению CRM, замеров, склада и финансов.
          </p>
        </div>

        <div className="relative flex gap-6 text-xs text-blue-100/65">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-cyan-200" /> RBAC
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-cyan-200" /> AuditLog
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-cyan-200" /> Mobile first
          </span>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-2xl">
              <BookOpenCheck className="size-5" />
            </div>
            <div>
              <div className="font-extrabold">Aпотолков CRM</div>
              <div className="text-muted-foreground text-xs">
                Рабочее пространство
              </div>
            </div>
          </div>
          <Card className="border-0 shadow-[0_20px_70px_oklch(0.2_0.03_260/0.11)] sm:border">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">Добро пожаловать</CardTitle>
              <CardDescription>
                Используйте номер телефона сотрудника и пароль.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>
          <p className="text-muted-foreground mt-6 text-center text-xs leading-relaxed">
            Доступ предназначен только для сотрудников компании. Действия
            пользователей записываются в журнал.
          </p>
        </div>
      </section>
    </main>
  );
}
