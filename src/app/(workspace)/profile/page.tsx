import type { Metadata } from "next";
import { KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { ProfileNameForm } from "@/components/profile/profile-forms";
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

export const metadata: Metadata = { title: "Профиль" };

export default async function ProfilePage() {
  const context = await requirePagePermission(PERMISSIONS.PROFILE_READ);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Профиль"
        description="Личные данные и безопасность вашей учётной записи."
      />
      <div className="grid items-start gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <div className="bg-secondary text-primary flex size-12 items-center justify-center rounded-2xl">
              <UserRound />
            </div>
            <CardTitle>{context.name}</CardTitle>
            <CardDescription>Логин: {context.login}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {context.email ? (
              <div className="flex items-center gap-3">
                <Mail className="text-muted-foreground size-4" />
                <span>{context.email}</span>
              </div>
            ) : null}
            <div className="flex items-start gap-3">
              <ShieldCheck className="text-muted-foreground mt-0.5 size-4" />
              <div className="flex flex-wrap gap-1">
                {context.roleCodes.map((role) => (
                  <Badge key={role} variant="secondary">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
            <Badge variant="success">
              <KeyRound className="mr-1 size-3" /> Пароль назначен
              администратором
            </Badge>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Основные данные</CardTitle>
              <CardDescription>
                Изменение имени записывается в AuditLog.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileNameForm name={context.name} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Управление паролем</CardTitle>
              <CardDescription>
                Самостоятельная смена пароля отключена. Новый пароль назначает
                администратор; действующий пароль никому не отображается.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
