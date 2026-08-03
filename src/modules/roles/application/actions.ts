"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/modules/audit/application/write-audit";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { SYSTEM_ROLES } from "@/modules/auth/domain/roles";
import type { ActionResult } from "@/shared/actions/action-result";
import { validationActionError } from "@/shared/actions/action-result";
import { handleActionError } from "@/shared/actions/handle-action-error";

const schema = z.object({
  roleId: z.string().uuid(),
  permissionIds: z.array(z.string().uuid()),
});

export async function updateRolePermissionsAction(
  input: unknown,
): Promise<ActionResult<{ roleId: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return validationActionError(parsed.error);
  }

  try {
    const context = await requirePermission(PERMISSIONS.ROLE_MANAGE);
    const role = await prisma.role.findUnique({
      where: { id: parsed.data.roleId },
      include: { permissions: true },
    });
    if (!role || !role.isActive) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Роль не найдена" },
      };
    }
    if (role.code === SYSTEM_ROLES.ADMIN) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Системный набор разрешений ADMIN защищён от изменения",
        },
      };
    }

    const permissionIds = [...new Set(parsed.data.permissionIds)];
    const validCount = await prisma.permission.count({
      where: { id: { in: permissionIds } },
    });
    if (validCount !== permissionIds.length) {
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: "Выбрано неизвестное разрешение",
        },
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
        });
      }
      await tx.user.updateMany({
        where: { roles: { some: { roleId: role.id } } },
        data: { sessionVersion: { increment: 1 } },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "ROLE_PERMISSIONS_UPDATE",
          entityType: "Role",
          entityId: role.id,
          summary: `Изменены разрешения роли ${role.name}`,
          beforeData: {
            permissionIds: role.permissions.map(
              ({ permissionId }) => permissionId,
            ),
          },
          afterData: { permissionIds },
        },
        tx,
      );
    });

    revalidatePath("/roles");
    return { ok: true, data: { roleId: role.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
