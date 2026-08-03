import type { Metadata } from "next";
import Link from "next/link";
import { Plus, UserRound } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { UserActions } from "@/components/users/user-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, initials } from "@/lib/utils";
import { requirePagePermission } from "@/modules/auth/application/page-access";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";
import { listUsers } from "@/modules/users/application/queries";

export const metadata: Metadata = { title: "Пользователи" };

export default async function UsersPage() {
  const context = await requirePagePermission(PERMISSIONS.USER_READ);
  const users = await listUsers();
  const canManage = hasPermission(context.permissions, PERMISSIONS.USER_MANAGE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Пользователи"
        description="Учётные записи, роли, блокировки и управление доступом сотрудников."
        action={
          canManage ? (
            <Button asChild className="w-full sm:w-auto">
              <Link href="/users/new">
                <Plus /> Добавить пользователя
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 md:hidden">
        {users.map((user) => (
          <Card key={user.id}>
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <div className="bg-secondary text-primary flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold">
                  {initials(user.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{user.name}</span>
                    <Badge
                      variant={
                        user.isActive && !user.blockedAt
                          ? "success"
                          : "destructive"
                      }
                    >
                      {user.isActive && !user.blockedAt
                        ? "Активен"
                        : "Заблокирован"}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground mt-1 truncate text-xs">
                    @{user.login} · {user.email}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {user.roles.map(({ role }) => (
                      <Badge key={role.id} variant="secondary">
                        {role.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 border-t pt-3">
                <UserActions
                  userId={user.id}
                  active={user.isActive && !user.blockedAt}
                  canManage={canManage}
                  isCurrentUser={user.id === context.userId}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Сотрудник</TableHead>
              <TableHead>Роли</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Последний вход</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="bg-secondary text-primary flex size-9 items-center justify-center rounded-xl text-xs font-extrabold">
                      {initials(user.name)}
                    </div>
                    <div>
                      <div className="font-bold">{user.name}</div>
                      <div className="text-muted-foreground text-xs">
                        @{user.login} · {user.email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {user.roles.map(({ role }) => (
                      <Badge key={role.id} variant="secondary">
                        {role.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      user.isActive && !user.blockedAt
                        ? "success"
                        : "destructive"
                    }
                  >
                    {user.isActive && !user.blockedAt
                      ? "Активен"
                      : "Заблокирован"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {user.lastLoginAt
                    ? formatDateTime(user.lastLoginAt)
                    : "Ещё не входил"}
                </TableCell>
                <TableCell className="text-right">
                  <UserActions
                    userId={user.id}
                    active={user.isActive && !user.blockedAt}
                    canManage={canManage}
                    isCurrentUser={user.id === context.userId}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {users.length === 0 ? (
        <div className="text-muted-foreground rounded-2xl border border-dashed py-16 text-center">
          <UserRound className="mx-auto mb-3 size-8" />
          Пользователей пока нет
        </div>
      ) : null}
    </div>
  );
}
