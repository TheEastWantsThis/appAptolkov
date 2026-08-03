import type { Metadata } from "next";
import { ShieldCheck, UsersRound } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { RolePermissionsForm } from "@/components/roles/role-permissions-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePagePermission } from "@/modules/auth/application/page-access";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";
import { listPermissionCatalog } from "@/modules/roles/application/catalog-query";
import { listRolesWithPermissions } from "@/modules/roles/application/queries";

export const metadata: Metadata = { title: "Роли и разрешения" };

export default async function RolesPage() {
  const context = await requirePagePermission(PERMISSIONS.ROLE_READ);
  const [roles, permissions] = await Promise.all([
    listRolesWithPermissions(),
    listPermissionCatalog(),
  ]);
  const canManage = hasPermission(context.permissions, PERMISSIONS.ROLE_MANAGE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Роли и разрешения"
        description="Разрешения объединяются для нескольких ролей. Пользовательский DENY имеет приоритет над ALLOW."
        action={
          <Badge variant={canManage ? "success" : "outline"}>
            {canManage ? "Редактирование доступно" : "Только просмотр"}
          </Badge>
        }
      />
      <div className="grid items-start gap-4 xl:grid-cols-2">
        {roles.map((role) => (
          <Card key={role.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="bg-secondary text-primary flex size-10 items-center justify-center rounded-xl">
                  <ShieldCheck />
                </div>
                <Badge variant="secondary">
                  <UsersRound className="mr-1 size-3" /> {role._count.users}
                </Badge>
              </div>
              <CardTitle>{role.name}</CardTitle>
              <CardDescription>{role.description}</CardDescription>
              <div>
                <Badge variant="outline" className="font-mono">
                  {role.code}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <RolePermissionsForm
                roleId={role.id}
                roleCode={role.code}
                initialPermissionIds={role.permissions.map(
                  ({ permission }) => permission.id,
                )}
                permissions={permissions}
                canManage={canManage}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
