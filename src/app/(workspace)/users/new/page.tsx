import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { CreateUserForm } from "@/components/users/create-user-form";
import { Card, CardContent } from "@/components/ui/card";
import { requirePagePermission } from "@/modules/auth/application/page-access";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { listAssignableRoles } from "@/modules/users/application/queries";

export const metadata: Metadata = { title: "Новый пользователь" };

export default async function NewUserPage() {
  await requirePagePermission(PERMISSIONS.USER_MANAGE);
  await requirePagePermission(PERMISSIONS.USER_PASSWORD_MANAGE);
  const roles = await listAssignableRoles();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Новый пользователь"
        description="Укажите ФИО и обязательный номер телефона для входа. Email необязателен, пароль состоит из 6 символов."
      />
      <Card>
        <CardContent className="pt-5 sm:pt-6">
          <CreateUserForm roles={roles} />
        </CardContent>
      </Card>
    </div>
  );
}
