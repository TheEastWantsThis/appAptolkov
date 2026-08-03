"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/modules/audit/application/write-audit";
import { requirePermission } from "@/modules/auth/application/auth-context";
import {
  hashPassword,
  passwordSchema,
} from "@/modules/auth/application/password";
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  userStatusSchema,
} from "@/modules/auth/application/schemas";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { SYSTEM_ROLES } from "@/modules/auth/domain/roles";
import type { ActionResult } from "@/shared/actions/action-result";
import { validationActionError } from "@/shared/actions/action-result";
import { handleActionError } from "@/shared/actions/handle-action-error";
import { isValidNormalizedPhone, normalizePhone } from "@/shared/domain/phone";

async function assertRoleIds(roleIds: readonly string[]) {
  const count = await prisma.role.count({
    where: { id: { in: [...new Set(roleIds)] }, isActive: true },
  });
  if (count !== new Set(roleIds).size) {
    throw new Error("В списке есть недоступная роль");
  }
}

async function wouldRemoveLastAdmin(
  userId: string,
  nextRoleIds?: readonly string[],
) {
  const adminRole = await prisma.role.findUnique({
    where: { code: SYSTEM_ROLES.ADMIN },
  });
  if (!adminRole) {
    return false;
  }

  const targetHasAdmin = await prisma.userRole.findUnique({
    where: { userId_roleId: { userId, roleId: adminRole.id } },
  });
  if (!targetHasAdmin) {
    return false;
  }

  if (nextRoleIds?.includes(adminRole.id)) {
    return false;
  }

  const activeAdmins = await prisma.user.count({
    where: {
      isActive: true,
      blockedAt: null,
      archivedAt: null,
      roles: { some: { roleId: adminRole.id } },
    },
  });
  return activeAdmins <= 1;
}

export async function createUserAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return validationActionError(parsed.error);
  }

  try {
    const context = await requirePermission(PERMISSIONS.USER_PASSWORD_MANAGE);
    await requirePermission(PERMISSIONS.USER_MANAGE);
    const phoneNormalized = normalizePhone(parsed.data.phone);
    if (!isValidNormalizedPhone(phoneNormalized)) {
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: "Введите корректный номер телефона",
        },
      };
    }
    const duplicatePhone = await prisma.user.findUnique({
      where: { phoneNormalized },
      select: { id: true },
    });
    if (duplicatePhone) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Этот номер телефона уже используется",
        },
      };
    }
    const roleIds = [...new Set(parsed.data.roleIds)];
    await assertRoleIds(roleIds);

    const duplicateLogin = await prisma.user.findFirst({
      where: {
        login: { equals: parsed.data.login, mode: "insensitive" },
        archivedAt: null,
      },
      select: { id: true },
    });
    if (duplicateLogin) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Пользователь с таким ФИО уже существует",
        },
      };
    }
    const passwordHash = await hashPassword(parsed.data.password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: parsed.data.login,
          email: parsed.data.email ?? null,
          phone: parsed.data.phone,
          phoneNormalized,
          login: parsed.data.login,
          passwordHash,
          mustChangePassword: false,
          roles: {
            create: roleIds.map((roleId) => ({
              roleId,
              assignedById: context.userId,
            })),
          },
        },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "USER_CREATE",
          entityType: "User",
          entityId: created.id,
          summary: `Создан пользователь ${created.login}`,
          afterData: {
            name: created.name,
            email: created.email,
            phoneLast4: phoneNormalized.slice(-4),
            login: created.login,
            roleIds,
          },
        },
        tx,
      );
      return created;
    });

    revalidatePath("/users");
    return { ok: true, data: { id: user.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function updateUserAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return validationActionError(parsed.error);
  }

  try {
    const context = await requirePermission(PERMISSIONS.USER_MANAGE);
    const phoneNormalized = normalizePhone(parsed.data.phone);
    if (!isValidNormalizedPhone(phoneNormalized)) {
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: "Введите корректный номер телефона",
        },
      };
    }
    if (context.userId === parsed.data.id) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Собственные данные изменяются на странице профиля",
        },
      };
    }

    const roleIds = [...new Set(parsed.data.roleIds)];
    await assertRoleIds(roleIds);
    if (await wouldRemoveLastAdmin(parsed.data.id, roleIds)) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Нельзя снять роль у последнего активного администратора",
        },
      };
    }

    const before = await prisma.user.findFirst({
      where: { id: parsed.data.id, archivedAt: null },
      include: { roles: true },
    });
    if (!before) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Пользователь не найден" },
      };
    }

    const duplicatePhone = await prisma.user.findFirst({
      where: {
        id: { not: parsed.data.id },
        phoneNormalized,
      },
      select: { id: true },
    });
    if (duplicatePhone) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Этот номер телефона уже используется",
        },
      };
    }

    const duplicateLogin = await prisma.user.findFirst({
      where: {
        id: { not: parsed.data.id },
        login: { equals: parsed.data.login, mode: "insensitive" },
        archivedAt: null,
      },
      select: { id: true },
    });
    if (duplicateLogin) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Пользователь с таким ФИО уже существует",
        },
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: parsed.data.id },
        data: {
          name: parsed.data.login,
          email: parsed.data.email ?? null,
          phone: parsed.data.phone,
          phoneNormalized,
          login: parsed.data.login,
          sessionVersion: { increment: 1 },
        },
      });
      await tx.userRole.deleteMany({ where: { userId: parsed.data.id } });
      await tx.userRole.createMany({
        data: roleIds.map((roleId) => ({
          userId: parsed.data.id,
          roleId,
          assignedById: context.userId,
        })),
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "USER_UPDATE",
          entityType: "User",
          entityId: parsed.data.id,
          summary: `Изменён пользователь ${parsed.data.login}`,
          beforeData: {
            name: before.name,
            email: before.email,
            login: before.login,
            roleIds: before.roles.map(({ roleId }) => roleId),
          },
          afterData: {
            name: parsed.data.login,
            email: parsed.data.email ?? null,
            phoneLast4: phoneNormalized.slice(-4),
            login: parsed.data.login,
            roleIds,
          },
        },
        tx,
      );
    });

    revalidatePath("/users");
    revalidatePath(`/users/${parsed.data.id}/edit`);
    return { ok: true, data: { id: parsed.data.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function blockUserAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = userStatusSchema.safeParse(input);
  if (!parsed.success) {
    return validationActionError(parsed.error);
  }

  try {
    const context = await requirePermission(PERMISSIONS.USER_MANAGE);
    if (context.userId === parsed.data.id) {
      return {
        ok: false,
        error: { code: "CONFLICT", message: "Нельзя заблокировать себя" },
      };
    }
    if (await wouldRemoveLastAdmin(parsed.data.id)) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Нельзя заблокировать последнего активного администратора",
        },
      };
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: parsed.data.id },
        data: {
          isActive: false,
          blockedAt: new Date(),
          blockedReason: parsed.data.reason ?? "Заблокирован администратором",
          sessionVersion: { increment: 1 },
        },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "USER_BLOCK",
          entityType: "User",
          entityId: updated.id,
          summary: `Заблокирован пользователь ${updated.login}`,
          afterData: { reason: updated.blockedReason },
        },
        tx,
      );
      return updated;
    });

    revalidatePath("/users");
    return { ok: true, data: { id: user.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function unblockUserAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return validationActionError(parsed.error);
  }

  try {
    const context = await requirePermission(PERMISSIONS.USER_MANAGE);
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: parsed.data.id },
        data: {
          isActive: true,
          blockedAt: null,
          blockedReason: null,
          sessionVersion: { increment: 1 },
        },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "USER_UNBLOCK",
          entityType: "User",
          entityId: updated.id,
          summary: `Разблокирован пользователь ${updated.login}`,
        },
        tx,
      );
      return updated;
    });
    revalidatePath("/users");
    return { ok: true, data: { id: user.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function resetUserPasswordAction(
  input: unknown,
): Promise<ActionResult<{ temporaryPassword: string }>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return validationActionError(parsed.error);
  }

  try {
    const context = await requirePermission(PERMISSIONS.USER_PASSWORD_MANAGE);
    const temporaryPassword = randomBytes(6).toString("base64url").slice(0, 6);
    const validPassword = passwordSchema.parse(temporaryPassword);
    const passwordHash = await hashPassword(validPassword);

    await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: parsed.data.id },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          mustChangePassword: false,
          sessionVersion: { increment: 1 },
        },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "USER_PASSWORD_RESET",
          entityType: "User",
          entityId: updated.id,
          summary: `Сброшен пароль пользователя ${updated.login}`,
        },
        tx,
      );
    });

    return { ok: true, data: { temporaryPassword } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
