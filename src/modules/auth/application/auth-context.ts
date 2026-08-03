import "server-only";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { PermissionCode } from "@/modules/auth/domain/permissions";
import { hasPermission, resolvePermissions } from "@/modules/auth/domain/rbac";

export interface AuthContext {
  userId: string;
  name: string;
  email: string;
  login: string;
  mustChangePassword: boolean;
  roleCodes: readonly string[];
  permissions: ReadonlySet<string>;
}

export class AuthenticationError extends Error {
  constructor() {
    super("Необходимо войти в систему");
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor() {
    super("Недостаточно прав для выполнения действия");
    this.name = "AuthorizationError";
  }
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      roles: {
        where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
      permissionOverrides: {
        where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        include: { permission: true },
      },
    },
  });

  if (
    !user ||
    !user.isActive ||
    user.blockedAt ||
    user.archivedAt ||
    user.sessionVersion !== session.user.sessionVersion
  ) {
    return null;
  }

  const rolePermissions = user.roles.flatMap(({ role }) =>
    role.isActive
      ? role.permissions.map(({ permission }) => permission.code)
      : [],
  );
  const overrides = user.permissionOverrides.map(
    ({ permission, effect, expiresAt }) => ({
      code: permission.code,
      effect,
      expiresAt,
    }),
  );

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    login: user.login,
    mustChangePassword: user.mustChangePassword,
    roleCodes: user.roles
      .filter(({ role }) => role.isActive)
      .map(({ role }) => role.code),
    permissions: resolvePermissions({ rolePermissions, overrides, now }),
  };
}

export async function requireAuthContext() {
  const context = await getAuthContext();
  if (!context) {
    throw new AuthenticationError();
  }
  return context;
}

export async function requirePermission(permission: PermissionCode) {
  const context = await requireAuthContext();
  if (!hasPermission(context.permissions, permission)) {
    throw new AuthorizationError();
  }
  return context;
}
