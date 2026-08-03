"use client";

import { LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { updateRolePermissionsAction } from "@/modules/roles/application/actions";

interface PermissionOption {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
}

export function RolePermissionsForm({
  roleId,
  roleCode,
  initialPermissionIds,
  permissions,
  canManage,
}: {
  roleId: string;
  roleCode: string;
  initialPermissionIds: readonly string[];
  permissions: readonly PermissionOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set(initialPermissionIds));
  const [pending, startTransition] = useTransition();
  const protectedRole = roleCode === "ADMIN";

  const grouped = Map.groupBy(permissions, (permission) => permission.category);

  function toggle(permissionId: string) {
    if (!canManage || protectedRole) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const result = await updateRolePermissionsAction({
        roleId,
        permissionIds: [...selected],
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        "Разрешения роли обновлены. Сессии её пользователей отозваны",
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {protectedRole ? (
        <div className="bg-secondary text-secondary-foreground flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold">
          <ShieldCheck className="size-4" /> Системный набор ADMIN защищён от
          случайной блокировки.
        </div>
      ) : null}
      {[...grouped.entries()].map(([category, values]) => (
        <div key={category}>
          <div className="text-muted-foreground mb-2 text-xs font-extrabold tracking-wide uppercase">
            {category}
          </div>
          <div className="space-y-1.5">
            {values.map((permission) => {
              const checked = selected.has(permission.id);
              return (
                <label
                  key={permission.id}
                  className="has-checked:border-primary/40 has-checked:bg-primary/3 flex items-start gap-3 rounded-xl border p-3"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!canManage || protectedRole}
                    onChange={() => toggle(permission.id)}
                    className="mt-0.5 size-4 accent-[var(--primary)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-bold">
                      {permission.name}
                      <Badge
                        variant="outline"
                        className="font-mono normal-case"
                      >
                        {permission.code}
                      </Badge>
                    </span>
                    <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">
                      {permission.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      {canManage && !protectedRole ? (
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : <Save />}{" "}
          Сохранить разрешения
        </Button>
      ) : null}
    </div>
  );
}
