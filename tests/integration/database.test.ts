import "dotenv/config";

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "../../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL не задан");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const token = randomUUID().slice(0, 8);
const login = "integration_" + token;
let userId = "";
let customerId = "";
let projectId = "";
let inventoryId = "";
let locationId = "";
let balanceId = "";
let requirementId = "";

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: login + "@example.local",
      login,
      name: "Integration Test",
      passwordHash: "integration-test-only",
    },
  });
  userId = user.id;
  const customer = await prisma.customer.create({
    data: {
      name: "Integration Customer",
      phone: "+7 900 000-00-00",
      phoneNormalized: "7900" + token.replace(/\D/g, "").padEnd(7, "0"),
    },
  });
  customerId = customer.id;
  const project = await prisma.project.create({
    data: {
      number: "INT-" + token,
      customerId,
      source: "OTHER",
      address: "Integration address",
      createdById: userId,
    },
  });
  projectId = project.id;
  const location = await prisma.inventoryLocation.create({
    data: { code: "INT-LOC-" + token, name: "Integration location" },
  });
  locationId = location.id;
  const inventory = await prisma.inventoryItem.create({
    data: {
      code: "INT-" + token,
      name: "Integration material",
      unit: "шт.",
      quantity: 10,
      minimumQuantity: 2,
      defaultLocationId: location.id,
    },
  });
  inventoryId = inventory.id;
  const balance = await prisma.inventoryBalance.create({
    data: { itemId: inventory.id, locationId: location.id, quantity: 10 },
  });
  balanceId = balance.id;
  const requirement = await prisma.projectMaterialRequirement.create({
    data: {
      projectId,
      itemId: inventory.id,
      required: 8,
      issued: 5,
      status: "ISSUED",
    },
  });
  requirementId = requirement.id;
});

afterAll(async () => {
  if (projectId) await prisma.project.deleteMany({ where: { id: projectId } });
  if (inventoryId)
    await prisma.inventoryItem.deleteMany({ where: { id: inventoryId } });
  if (locationId)
    await prisma.inventoryLocation.deleteMany({ where: { id: locationId } });
  if (customerId)
    await prisma.customer.deleteMany({ where: { id: customerId } });
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("PostgreSQL invariants", () => {
  it("не допускает две финансовые карточки одного проекта", async () => {
    await prisma.projectFinance.create({
      data: { projectId, updatedById: userId },
    });
    await expect(
      prisma.projectFinance.create({
        data: { projectId, updatedById: userId },
      }),
    ).rejects.toBeDefined();
  });

  it("разрешает только один из двух конкурентных резервов", async () => {
    const current = await prisma.inventoryBalance.findUniqueOrThrow({
      where: { id: balanceId },
    });
    const reserve = () =>
      prisma.inventoryBalance.updateMany({
        where: {
          id: balanceId,
          version: current.version,
          quantity: { gte: 8 },
        },
        data: { reserved: { increment: 8 }, version: { increment: 1 } },
      });
    const [first, second] = await Promise.all([reserve(), reserve()]);
    expect([first.count, second.count].sort()).toEqual([0, 1]);
  });

  it("не допускает двойное списание выданного материала", async () => {
    const current = await prisma.projectMaterialRequirement.findUniqueOrThrow({
      where: { id: requirementId },
    });
    const consume = () =>
      prisma.projectMaterialRequirement.updateMany({
        where: {
          id: requirementId,
          version: current.version,
          issued: { gte: 3 },
        },
        data: {
          issued: { decrement: 3 },
          consumed: { increment: 3 },
          version: { increment: 1 },
        },
      });
    const [first, second] = await Promise.all([consume(), consume()]);
    expect([first.count, second.count].sort()).toEqual([0, 1]);
  });

  it("выдаёт системное право управления паролями только администратору", async () => {
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { code: "user.password.manage" },
      include: { roles: { include: { role: { select: { code: true } } } } },
    });
    expect(permission.roles.map(({ role }) => role.code).sort()).toEqual([
      "ADMIN",
    ]);
  });
});
