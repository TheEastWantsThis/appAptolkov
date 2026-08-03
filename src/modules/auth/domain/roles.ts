export const SYSTEM_ROLES = {
  ADMIN: "ADMIN",
  PROMOTER: "PROMOTER",
  AD_OPERATOR: "AD_OPERATOR",
  MEASURER: "MEASURER",
  INSTALLER: "INSTALLER",
  WAREHOUSE_MANAGER: "WAREHOUSE_MANAGER",
  FINANCE_MANAGER: "FINANCE_MANAGER",
  MANAGER: "MANAGER",
} as const;

export type SystemRoleCode = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

export const ROLE_DEFINITIONS: ReadonlyArray<{
  code: SystemRoleCode;
  name: string;
  description: string;
}> = [
  {
    code: SYSTEM_ROLES.ADMIN,
    name: "Администратор",
    description: "Полный доступ к каркасу системы",
  },
  {
    code: SYSTEM_ROLES.PROMOTER,
    name: "Промоутер",
    description: "Первичное создание лидов",
  },
  {
    code: SYSTEM_ROLES.AD_OPERATOR,
    name: "Оператор рекламы",
    description: "Обработка заявок и звонков",
  },
  {
    code: SYSTEM_ROLES.MEASURER,
    name: "Замерщик",
    description: "Назначенные замеры и технические данные",
  },
  {
    code: SYSTEM_ROLES.INSTALLER,
    name: "Монтажник",
    description: "Назначенные монтажи",
  },
  {
    code: SYSTEM_ROLES.WAREHOUSE_MANAGER,
    name: "Заведующий складом",
    description: "Материалы, резервы и движения",
  },
  {
    code: SYSTEM_ROLES.FINANCE_MANAGER,
    name: "Финансовый менеджер",
    description: "Платежи, расходы и финансовая отчётность",
  },
  {
    code: SYSTEM_ROLES.MANAGER,
    name: "Руководитель",
    description: "Управление работой и аналитика",
  },
];
