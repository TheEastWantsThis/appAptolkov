export const PERMISSIONS = {
  DASHBOARD_READ: "dashboard.read",
  USER_READ: "user.read",
  USER_MANAGE: "user.manage",
  ROLE_READ: "role.read",
  ROLE_MANAGE: "role.manage",
  AUDIT_READ: "audit.read",
  PROFILE_READ: "profile.read",
  PROFILE_UPDATE: "profile.update",
  LEAD_CREATE: "lead.create",
  LEAD_OWN_READ: "lead.own.read",
  LEAD_READ: "lead.read",
  LEAD_MANAGE: "lead.manage",
  PROJECT_READ: "project.read",
  PROJECT_MANAGE: "project.manage",
  CUSTOMER_PHONE_READ: "customer.phone.read",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const definition = (
  code: PermissionCode,
  name: string,
  description: string,
  category: string,
) => ({ code, name, description, category });

export const PERMISSION_DEFINITIONS: ReadonlyArray<{
  code: PermissionCode;
  name: string;
  description: string;
  category: string;
}> = [
  definition(
    PERMISSIONS.DASHBOARD_READ,
    "Просмотр главной панели",
    "Доступ к общей рабочей панели",
    "Рабочее пространство",
  ),
  definition(
    PERMISSIONS.USER_READ,
    "Просмотр пользователей",
    "Просмотр списка и карточек пользователей",
    "Администрирование",
  ),
  definition(
    PERMISSIONS.USER_MANAGE,
    "Управление пользователями",
    "Создание, изменение, блокировка и сброс пароля",
    "Администрирование",
  ),
  definition(
    PERMISSIONS.ROLE_READ,
    "Просмотр ролей",
    "Просмотр ролей и назначенных разрешений",
    "Администрирование",
  ),
  definition(
    PERMISSIONS.ROLE_MANAGE,
    "Управление ролями",
    "Изменение набора разрешений ролей",
    "Администрирование",
  ),
  definition(
    PERMISSIONS.AUDIT_READ,
    "Просмотр журнала действий",
    "Доступ к аудиту важных изменений",
    "Безопасность",
  ),
  definition(
    PERMISSIONS.PROFILE_READ,
    "Просмотр профиля",
    "Просмотр собственного профиля",
    "Профиль",
  ),
  definition(
    PERMISSIONS.PROFILE_UPDATE,
    "Изменение профиля",
    "Изменение имени и собственного пароля",
    "Профиль",
  ),
  definition(
    PERMISSIONS.LEAD_CREATE,
    "Создание лидов",
    "Быстрое создание новой заявки",
    "Лиды",
  ),
  definition(
    PERMISSIONS.LEAD_OWN_READ,
    "Свои лиды",
    "Просмотр только собственных заявок",
    "Лиды",
  ),
  definition(
    PERMISSIONS.LEAD_READ,
    "Просмотр лидов",
    "Просмотр операторской очереди и карточек лидов",
    "Лиды",
  ),
  definition(
    PERMISSIONS.LEAD_MANAGE,
    "Обработка лидов",
    "Звонки, задачи, замеры, отказы и квалификация",
    "Лиды",
  ),
  definition(
    PERMISSIONS.PROJECT_READ,
    "Просмотр проектов",
    "Просмотр списка и карточек клиентских проектов",
    "Проекты",
  ),
  definition(
    PERMISSIONS.PROJECT_MANAGE,
    "Управление проектами",
    "Статусы, ответственные, задачи и события проекта",
    "Проекты",
  ),
  definition(
    PERMISSIONS.CUSTOMER_PHONE_READ,
    "Полный телефон клиента",
    "Серверный доступ к полному номеру телефона клиента",
    "Персональные данные",
  ),
];
