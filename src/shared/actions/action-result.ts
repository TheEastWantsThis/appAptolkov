import { ZodError } from "zod";

export type ActionErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: ActionErrorCode;
        message: string;
        fieldErrors?: Record<string, string[]>;
      };
    };

export function validationActionError(error: ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? String(issue.path[0]) : "_form";
    fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
  }

  return {
    ok: false,
    error: {
      code: "VALIDATION",
      message: fieldErrors._form?.[0] ?? "Проверьте заполнение формы",
      fieldErrors,
    },
  };
}
