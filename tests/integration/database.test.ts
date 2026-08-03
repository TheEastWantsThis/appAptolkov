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
  const inventory = await prisma.inventoryItem.create({
    data: {
      code: "INT-" + token,
      name: "Integration material",
      unit: "шт.",
      quantity: 10,
      minimumQuantity: 2,
    },
  });
  inventoryId = inventory.id;
});

afterAll(async () => {
  if (projectId) await prisma.project.deleteMany({ where: { id: projectId } });
  if (inventoryId)
    await prisma.inventoryItem.deleteMany({ where: { id: inventoryId } });
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

  it("отклоняет устаревшую конкурентную запись склада", async () => {
    const current = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: inventoryId },
    });
    const first = await prisma.inventoryItem.updateMany({
      where: { id: inventoryId, version: current.version },
      data: { quantity: 9, version: { increment: 1 } },
    });
    const stale = await prisma.inventoryItem.updateMany({
      where: { id: inventoryId, version: current.version },
      data: { quantity: 8, version: { increment: 1 } },
    });
    expect(first.count).toBe(1);
    expect(stale.count).toBe(0);
  });
});
