import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { EditUserForm } from "@/components/users/edit-user-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requirePagePermission } from "@/modules/auth/application/page-access";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import {
  getUserForEdit,
  listAssignableRoles,
} from "@/modules/users/application/queries";

export const metadata: Metadata = { title: "Редактирование пользователя" };

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission(PERMISSIONS.USER_MANAGE);
  const { id } = await params;
  const [user, roles] = await Promise.all([
    getUserForEdit(id),
    listAssignableRoles(),
  ]);
  if (!user) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={user.login}
        description="Изменение ФИО или ролей отзывает текущие сессии."
        action={
          <Badge
            variant={
              user.isActive && !user.blockedAt ? "success" : "destructive"
            }
          >
            {user.isActive && !user.blockedAt ? "Активен" : "Заблокирован"}
          </Badge>
        }
      />
      <Card>
        <CardContent className="pt-5 sm:pt-6">
          <EditUserForm
            user={{
              id: user.id,
              phone: user.phone ?? "",
              email: user.email ?? "",
              login: user.login,
              roleIds: user.roles.map(({ roleId }) => roleId),
            }}
            roles={roles}
          />
        </CardContent>
      </Card>
    </div>
  );
}
