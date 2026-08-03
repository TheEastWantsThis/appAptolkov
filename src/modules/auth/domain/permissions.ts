export const PERMISSIONS = {
  DASHBOARD_READ: "dashboard.read",
  USER_READ: "user.read",
  USER_MANAGE: "user.manage",
  ROLE_READ: "role.read",
  ROLE_MANAGE: "role.manage",
  AUDIT_READ: "audit.read",
  PROFILE_READ: "profile.read",
  PROFILE_UPDATE: "profile.update",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DEFINITIONS: ReadonlyArray<{
  code: PermissionCode;
  name: string;
  description: string;
  category: string;
}> = [
  {
    code: PERMISSIONS.DASHBOARD_READ,
    name: "Просмотр главной панели",
    description: "Доступ к общей рабочей панели",
    category: "Рабочее пространство",
  },
  {
    code: PERMISSIONS.USER_READ,
    name: "Просмотр пользователей",
    description: "Просмотр списка и карточек пользователей",
    category: "Администрирование",
  },
  {
    code: PERMISSIONS.USER_MANAGE,
    name: "Управление пользователями",
    description: "Создание, изменение, блокировка и сброс пароля",
    category: "Администрирование",
  },
  {
    code: PERMISSIONS.ROLE_READ,
    name: "Просмотр ролей",
    description: "Просмотр ролей и назначенных разрешений",
    category: "Администрирование",
  },
  {
    code: PERMISSIONS.ROLE_MANAGE,
    name: "Управление ролями",
    description: "Изменение набора разрешений ролей",
    category: "Администрирование",
  },
  {
    code: PERMISSIONS.AUDIT_READ,
    name: "Просмотр журнала действий",
    description: "Доступ к аудиту важных изменений",
    category: "Безопасность",
  },
  {
    code: PERMISSIONS.PROFILE_READ,
    name: "Просмотр профиля",
    description: "Просмотр собственного профиля",
    category: "Профиль",
  },
  {
    code: PERMISSIONS.PROFILE_UPDATE,
    name: "Изменение профиля",
    description: "Изменение имени и собственного пароля",
    category: "Профиль",
  },
];
