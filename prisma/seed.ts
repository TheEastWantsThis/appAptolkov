import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/modules/auth/application/password";
import {
  PERMISSION_DEFINITIONS,
  PERMISSIONS,
  type PermissionCode,
} from "../src/modules/auth/domain/permissions";
import {
  ROLE_DEFINITIONS,
  SYSTEM_ROLES,
} from "../src/modules/auth/domain/roles";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL не задан");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const BASIC_PERMISSIONS: PermissionCode[] = [
  PERMISSIONS.DASHBOARD_READ,
  PERMISSIONS.PROFILE_READ,
  PERMISSIONS.PROFILE_UPDATE,
];

const ROLE_PERMISSIONS: Record<string, readonly PermissionCode[]> = {
  [SYSTEM_ROLES.ADMIN]: PERMISSION_DEFINITIONS.map(({ code }) => code),
  [SYSTEM_ROLES.PROMOTER]: [
    ...BASIC_PERMISSIONS,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_OWN_READ,
  ],
  [SYSTEM_ROLES.AD_OPERATOR]: [
    ...BASIC_PERMISSIONS,
    PERMISSIONS.LEAD_OWN_READ,
    PERMISSIONS.LEAD_READ,
    PERMISSIONS.LEAD_MANAGE,
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_MANAGE,
    PERMISSIONS.CUSTOMER_PHONE_READ,
    PERMISSIONS.ESTIMATE_READ,
    PERMISSIONS.ESTIMATE_CLIENT_PRICE_READ,
    PERMISSIONS.ESTIMATE_CLIENT_PRICE_MANAGE,
  ],
  [SYSTEM_ROLES.MEASURER]: [
    ...BASIC_PERMISSIONS,
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.MEASUREMENT_ASSIGNED_READ,
    PERMISSIONS.MEASUREMENT_ASSIGNED_MANAGE,
    PERMISSIONS.ESTIMATE_READ,
    PERMISSIONS.ESTIMATE_CREATE,
  ],
  [SYSTEM_ROLES.INSTALLER]: [...BASIC_PERMISSIONS, PERMISSIONS.PROJECT_READ],
  [SYSTEM_ROLES.WAREHOUSE_MANAGER]: BASIC_PERMISSIONS,
  [SYSTEM_ROLES.FINANCE_MANAGER]: [
    ...BASIC_PERMISSIONS,
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.ESTIMATE_READ,
    PERMISSIONS.ESTIMATE_CLIENT_PRICE_READ,
    PERMISSIONS.ESTIMATE_INTERNAL_PRICE_READ,
  ],
  [SYSTEM_ROLES.MANAGER]: PERMISSION_DEFINITIONS.map(({ code }) => code),
};

const DEMO_USERS = [
  {
    role: SYSTEM_ROLES.PROMOTER,
    login: "promoter",
    email: "promoter@example.local",
    name: "Анна Промоутер",
  },
  {
    role: SYSTEM_ROLES.AD_OPERATOR,
    login: "operator",
    email: "operator@example.local",
    name: "Ольга Оператор",
  },
  {
    role: SYSTEM_ROLES.MEASURER,
    login: "measurer",
    email: "measurer@example.local",
    name: "Михаил Замерщик",
  },
  {
    role: SYSTEM_ROLES.INSTALLER,
    login: "installer",
    email: "installer@example.local",
    name: "Иван Монтажник",
  },
  {
    role: SYSTEM_ROLES.WAREHOUSE_MANAGER,
    login: "warehouse",
    email: "warehouse@example.local",
    name: "Сергей Кладовщик",
  },
  {
    role: SYSTEM_ROLES.FINANCE_MANAGER,
    login: "finance",
    email: "finance@example.local",
    name: "Елена Финансист",
  },
  {
    role: SYSTEM_ROLES.MANAGER,
    login: "manager",
    email: "manager@example.local",
    name: "Алексей Руководитель",
  },
] as const;

const TARIFFS = [
  ["CANVAS_BASE", "Полотно базовое", "Полотно", "M2", 350, 750],
  ["CANVAS_PREMIUM", "Полотно премиум", "Полотно", "M2", 620, 1250],
  ["PROFILE_BASE", "Профиль базовый", "Профиль", "M", 120, 290],
  ["PROFILE_SHADOW", "Теневой профиль", "Профиль", "M", 420, 850],
  ["INSERT", "Декоративная вставка", "Профиль", "M", 45, 120],
  ["CORNER", "Обработка угла", "Работы", "PCS", 45, 120],
  ["PIPE", "Обход трубы", "Работы", "PCS", 250, 550],
  ["LIGHT", "Монтаж светильника", "Освещение", "PCS", 300, 750],
  ["CHANDELIER", "Монтаж люстры", "Освещение", "PCS", 550, 1400],
  ["TRACK", "Трековая система", "Освещение", "M", 1100, 2300],
  ["CORNICE", "Скрытый карниз", "Конструкции", "M", 650, 1450],
  ["NICHE", "Ниша", "Конструкции", "M", 900, 1900],
  ["VENTILATION", "Вентиляционная решётка", "Инженерия", "PCS", 350, 850],
  ["SENSOR", "Обход датчика", "Инженерия", "PCS", 180, 450],
  ["CABINET_BYPASS", "Обход шкафа", "Работы", "M", 400, 950],
  ["ADDITIONAL_WORK", "Дополнительные работы", "Работы", "FIXED", 500, 1200],
  ["TRANSPORT_ZONE_1", "Транспортная зона 1", "Транспорт", "ZONE", 500, 1200],
  ["TRANSPORT_ZONE_2", "Транспортная зона 2", "Транспорт", "ZONE", 1200, 2600],
  ["COMPLEXITY_1_2", "Сложность 1.2", "Коэффициенты", "COEFFICIENT", 1.2, 1.2],
  ["COMPLEXITY_1_5", "Сложность 1.5", "Коэффициенты", "COEFFICIENT", 1.5, 1.5],
  ["COMPLEXITY_2", "Сложность 2.0", "Коэффициенты", "COEFFICIENT", 2, 2],
  ["MINIMUM", "Минимальная стоимость заказа", "Минимум", "FIXED", 0, 15000],
] as const;
async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "Demo123!";
  const [adminHash, demoHash] = await Promise.all([
    hashPassword(adminPassword),
    hashPassword(demoPassword),
  ]);

  for (const definition of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { code: definition.code },
      create: definition,
      update: {
        name: definition.name,
        description: definition.description,
        category: definition.category,
      },
    });
  }

  for (const [
    code,
    name,
    category,
    unit,
    internalPrice,
    clientPrice,
  ] of TARIFFS) {
    await prisma.tariff.upsert({
      where: { code },
      create: { code, name, category, unit, internalPrice, clientPrice },
      update: { name, category, unit, isActive: true },
    });
  }
  for (const definition of ROLE_DEFINITIONS) {
    await prisma.role.upsert({
      where: { code: definition.code },
      create: { ...definition, isSystem: true },
      update: {
        name: definition.name,
        description: definition.description,
        isActive: true,
      },
    });
  }

  const permissions = await prisma.permission.findMany();
  const roles = await prisma.role.findMany();
  const permissionByCode = new Map(
    permissions.map((permission) => [permission.code, permission.id]),
  );

  for (const role of roles) {
    const permissionCodes = ROLE_PERMISSIONS[role.code] ?? BASIC_PERMISSIONS;
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({
        data: permissionCodes.map((code) => ({
          roleId: role.id,
          permissionId: permissionByCode.get(code) as string,
        })),
      }),
    ]);
  }

  const admin = await prisma.user.upsert({
    where: { login: "admin" },
    create: {
      login: "admin",
      email: "admin@example.local",
      name: "Системный администратор",
      passwordHash: adminHash,
      mustChangePassword: false,
    },
    update: {
      name: "Системный администратор",
      passwordHash: adminHash,
      isActive: true,
      blockedAt: null,
      blockedReason: null,
    },
  });

  const adminRole = roles.find(({ code }) => code === SYSTEM_ROLES.ADMIN);
  if (!adminRole) {
    throw new Error("Роль ADMIN не создана");
  }
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    create: { userId: admin.id, roleId: adminRole.id },
    update: {},
  });

  for (const demo of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { login: demo.login },
      create: {
        login: demo.login,
        email: demo.email,
        name: demo.name,
        passwordHash: demoHash,
        mustChangePassword: false,
      },
      update: {
        email: demo.email,
        name: demo.name,
        passwordHash: demoHash,
        isActive: true,
        blockedAt: null,
        blockedReason: null,
      },
    });
    const role = roles.find(({ code }) => code === demo.role);
    if (!role) {
      throw new Error(`Роль ${demo.role} не создана`);
    }
    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId: user.id } }),
      prisma.userRole.create({
        data: { userId: user.id, roleId: role.id, assignedById: admin.id },
      }),
    ]);
  }

  const promoter = await prisma.user.findUniqueOrThrow({
    where: { login: "promoter" },
  });
  const operator = await prisma.user.findUniqueOrThrow({
    where: { login: "operator" },
  });
  const measurer = await prisma.user.findUniqueOrThrow({
    where: { login: "measurer" },
  });

  const demoLead = await prisma.lead.upsert({
    where: { phoneNormalized: "79991112233" },
    create: {
      clientName: "Мария Демонстрационная",
      phone: "+7 999 111-22-33",
      phoneNormalized: "79991112233",
      districtOrAddress: "Центральный район, ул. Примерная, 10",
      housingType: "APARTMENT",
      roomsApprox: 3,
      repairTimeline: "В течение двух месяцев",
      preferredCallTime: "После 18:00",
      adPoint: "Точка ТЦ Центральный",
      comment: "Интересуется натяжными потолками во всей квартире",
      contactConsent: true,
      source: "PROMOTER",
      status: "QUALIFIED",
      authorId: promoter.id,
      operatorId: operator.id,
      measurerId: measurer.id,
      measurementAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      qualifiedAt: new Date(),
    },
    update: {
      clientName: "Мария Демонстрационная",
      authorId: promoter.id,
      operatorId: operator.id,
      measurerId: measurer.id,
    },
  });
  await prisma.workTask.deleteMany({ where: { leadId: demoLead.id } });
  await prisma.workTask.create({
    data: {
      title: "Провести демонстрационный замер",
      type: "MEASUREMENT",
      leadId: demoLead.id,
      authorId: operator.id,
      assigneeId: measurer.id,
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const demoCustomer = await prisma.customer.upsert({
    where: { phoneNormalized: "79991112233" },
    create: {
      name: "Мария Демонстрационная",
      phone: "+7 999 111-22-33",
      phoneNormalized: "79991112233",
      address: "ул. Примерная, 10",
    },
    update: { name: "Мария Демонстрационная" },
  });
  const demoProject = await prisma.project.upsert({
    where: { number: "APT-DEMO-001" },
    create: {
      number: "APT-DEMO-001",
      customerId: demoCustomer.id,
      source: "PROMOTER",
      status: "QUALIFIED",
      address: "ул. Примерная, 10",
      description: "Демонстрационный проект трёхкомнатной квартиры",
      createdById: operator.id,
      responsibles: {
        create: { userId: operator.id, roleLabel: "Менеджер проекта" },
      },
      rooms: {
        create: [
          { name: "Гостиная", area: 21.5, sortOrder: 1 },
          { name: "Спальня", area: 14.2, sortOrder: 2 },
        ],
      },
      statusHistory: {
        create: {
          toStatus: "QUALIFIED",
          changedById: operator.id,
          comment: "Демонстрационный проект",
        },
      },
    },
    update: { customerId: demoCustomer.id, address: "ул. Примерная, 10" },
  });

  const existingMeasurement = await prisma.measurement.findFirst({
    where: { projectId: demoProject.id, measurerId: measurer.id },
  });
  const demoMeasurement = existingMeasurement
    ? await prisma.measurement.update({
        where: { id: existingMeasurement.id },
        data: {
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          district: "Центральный",
          objectType: "Квартира",
          operatorComment: "Уточнить расположение треков и скрытого карниза",
          requiredDocuments: ["План квартиры", "Фото помещения"],
          status: "SCHEDULED",
        },
      })
    : await prisma.measurement.create({
        data: {
          projectId: demoProject.id,
          measurerId: measurer.id,
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          district: "Центральный",
          objectType: "Квартира",
          operatorComment: "Уточнить расположение треков и скрытого карниза",
          requiredDocuments: ["План квартиры", "Фото помещения"],
        },
      });
  await prisma.projectRoom.updateMany({
    where: { projectId: demoProject.id, measurementId: null },
    data: { measurementId: demoMeasurement.id },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "SYSTEM_SEED",
      entityType: "System",
      summary:
        "Обновлены системные роли, разрешения и демонстрационные пользователи",
    },
  });

  console.log("Seed завершён: admin + 7 демонстрационных пользователей.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
