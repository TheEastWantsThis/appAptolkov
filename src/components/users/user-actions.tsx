"use client";

import Link from "next/link";
import {
  Ban,
  CheckCircle2,
  Copy,
  KeyRound,
  LoaderCircle,
  Pencil,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  blockUserAction,
  resetUserPasswordAction,
  unblockUserAction,
} from "@/modules/users/application/actions";

export function UserActions({
  userId,
  active,
  canManage,
  isCurrentUser,
}: {
  userId: string;
  active: boolean;
  canManage: boolean;
  isCurrentUser: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null,
  );

  if (!canManage || isCurrentUser) {
    return isCurrentUser ? (
      <span className="text-muted-foreground text-xs">Это вы</span>
    ) : null;
  }

  function changeStatus() {
    const reason = active
      ? window.prompt(
          "Укажите причину блокировки",
          "Заблокирован администратором",
        )
      : null;
    if (active && (!reason || reason.trim().length < 3)) {
      return;
    }
    startTransition(async () => {
      const result = active
        ? await blockUserAction({ id: userId, reason: reason?.trim() })
        : await unblockUserAction({ id: userId });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        active ? "Пользователь заблокирован" : "Пользователь разблокирован",
      );
      router.refresh();
    });
  }

  function resetPassword() {
    if (
      !window.confirm(
        "Сбросить пароль и завершить все активные сессии пользователя?",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await resetUserPasswordAction({ id: userId });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setTemporaryPassword(result.data.temporaryPassword);
      toast.success("Создан временный пароль");
    });
  }

  async function copyPassword() {
    if (!temporaryPassword) return;
    await navigator.clipboard.writeText(temporaryPassword);
    toast.success("Пароль скопирован");
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/users/${userId}/edit`}>
            <Pencil /> Изменить
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetPassword}
          disabled={pending}
        >
          <KeyRound /> Пароль
        </Button>
        <Button
          variant={active ? "ghost" : "secondary"}
          size="sm"
          onClick={changeStatus}
          disabled={pending}
        >
          {pending ? (
            <LoaderCircle className="animate-spin" />
          ) : active ? (
            <Ban />
          ) : (
            <CheckCircle2 />
          )}
          {active ? "Блокировать" : "Разблокировать"}
        </Button>
      </div>
      {temporaryPassword ? (
        <button
          type="button"
          onClick={copyPassword}
          className="flex max-w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 font-mono text-xs text-amber-900"
          title="Скопировать временный пароль"
        >
          <span className="truncate">{temporaryPassword}</span>
          <Copy className="size-3.5 shrink-0" />
        </button>
      ) : null}
    </div>
  );
}
