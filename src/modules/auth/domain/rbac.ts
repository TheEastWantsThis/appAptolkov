import type { PermissionCode } from "@/modules/auth/domain/permissions";

export type PermissionEffectValue = "ALLOW" | "DENY";

export interface PermissionOverrideValue {
  code: string;
  effect: PermissionEffectValue;
  expiresAt?: Date | null;
}

export interface PermissionResolutionInput {
  rolePermissions: readonly string[];
  overrides?: readonly PermissionOverrideValue[];
  now?: Date;
}

export function resolvePermissions({
  rolePermissions,
  overrides = [],
  now = new Date(),
}: PermissionResolutionInput): ReadonlySet<string> {
  const allowed = new Set(rolePermissions);
  const denied = new Set<string>();

  for (const override of overrides) {
    if (override.expiresAt && override.expiresAt <= now) {
      continue;
    }

    if (override.effect === "DENY") {
      denied.add(override.code);
      allowed.delete(override.code);
    } else if (!denied.has(override.code)) {
      allowed.add(override.code);
    }
  }

  for (const code of denied) {
    allowed.delete(code);
  }

  return allowed;
}

export function hasPermission(
  permissions: ReadonlySet<string> | readonly string[],
  permission: PermissionCode,
) {
  return new Set<string>(permissions).has(permission);
}
