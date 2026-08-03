import { describe, expect, it } from "vitest";

import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission, resolvePermissions } from "@/modules/auth/domain/rbac";

describe("серверное вычисление RBAC", () => {
  it("объединяет разрешения нескольких ролей", () => {
    const permissions = resolvePermissions({
      rolePermissions: [PERMISSIONS.DASHBOARD_READ, PERMISSIONS.USER_READ],
    });

    expect(permissions).toEqual(
      new Set([PERMISSIONS.DASHBOARD_READ, PERMISSIONS.USER_READ]),
    );
  });

  it("добавляет действующий пользовательский ALLOW", () => {
    const permissions = resolvePermissions({
      rolePermissions: [PERMISSIONS.DASHBOARD_READ],
      overrides: [{ code: PERMISSIONS.AUDIT_READ, effect: "ALLOW" }],
    });

    expect(hasPermission(permissions, PERMISSIONS.AUDIT_READ)).toBe(true);
  });

  it("пользовательский DENY имеет приоритет над ролью и ALLOW", () => {
    const permissions = resolvePermissions({
      rolePermissions: [PERMISSIONS.USER_READ],
      overrides: [
        { code: PERMISSIONS.USER_READ, effect: "ALLOW" },
        { code: PERMISSIONS.USER_READ, effect: "DENY" },
      ],
    });

    expect(hasPermission(permissions, PERMISSIONS.USER_READ)).toBe(false);
  });

  it("DENY сохраняет приоритет независимо от порядка overrides", () => {
    const permissions = resolvePermissions({
      rolePermissions: [],
      overrides: [
        { code: PERMISSIONS.ROLE_READ, effect: "DENY" },
        { code: PERMISSIONS.ROLE_READ, effect: "ALLOW" },
      ],
    });

    expect(hasPermission(permissions, PERMISSIONS.ROLE_READ)).toBe(false);
  });

  it("не учитывает истёкшие пользовательские разрешения", () => {
    const now = new Date("2026-08-03T09:00:00.000Z");
    const permissions = resolvePermissions({
      rolePermissions: [PERMISSIONS.DASHBOARD_READ],
      overrides: [
        {
          code: PERMISSIONS.DASHBOARD_READ,
          effect: "DENY",
          expiresAt: new Date("2026-08-03T08:59:59.000Z"),
        },
        {
          code: PERMISSIONS.AUDIT_READ,
          effect: "ALLOW",
          expiresAt: new Date("2026-08-03T08:59:59.000Z"),
        },
      ],
      now,
    });

    expect(hasPermission(permissions, PERMISSIONS.DASHBOARD_READ)).toBe(true);
    expect(hasPermission(permissions, PERMISSIONS.AUDIT_READ)).toBe(false);
  });

  it("учитывает override с будущим сроком действия", () => {
    const now = new Date("2026-08-03T09:00:00.000Z");
    const permissions = resolvePermissions({
      rolePermissions: [],
      overrides: [
        {
          code: PERMISSIONS.USER_MANAGE,
          effect: "ALLOW",
          expiresAt: new Date("2026-08-04T09:00:00.000Z"),
        },
      ],
      now,
    });

    expect(hasPermission(permissions, PERMISSIONS.USER_MANAGE)).toBe(true);
  });

  it("проверка неизвестного permission возвращает false", () => {
    const permissions = resolvePermissions({ rolePermissions: [] });
    expect(permissions.has("unknown.permission")).toBe(false);
  });
});
