import "server-only";

import { redirect } from "next/navigation";

import { getAuthContext } from "@/modules/auth/application/auth-context";
import type { PermissionCode } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";

export async function requirePageAuth() {
  const context = await getAuthContext();
  if (!context) {
    redirect("/login");
  }
  return context;
}

export async function requirePagePermission(permission: PermissionCode) {
  const context = await requirePageAuth();
  if (!hasPermission(context.permissions, permission)) {
    redirect("/403");
  }
  return context;
}
