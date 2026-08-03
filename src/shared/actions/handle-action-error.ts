import { Prisma } from "@/generated/prisma/client";
import {
  AuthenticationError,
  AuthorizationError,
} from "@/modules/auth/application/auth-context";
import type { ActionResult } from "@/shared/actions/action-result";

export function handleActionError(error: unknown): ActionResult<never> {
  if (error instanceof AuthenticationError) {
    return {
      ok: false,
      error: { code: "UNAUTHENTICATED", message: error.message },
    };
  }

  if (error instanceof AuthorizationError) {
    return { ok: false, error: { code: "FORBIDDEN", message: error.message } };
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Пользователь с таким email или логином уже существует",
      },
    };
  }

  console.error("Необработанная ошибка Server Action", error);
  return {
    ok: false,
    error: {
      code: "INTERNAL",
      message: "Не удалось выполнить действие. Повторите попытку позже",
    },
  };
}
