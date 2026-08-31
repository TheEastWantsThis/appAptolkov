import { randomBytes } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../apps/api/src/generated/prisma/client.js";

if (process.env.NODE_ENV === "production") throw new Error("Seed запрещён в production");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL обязателен для seed");

async function main(): Promise<void> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const telegramId = BigInt(process.env.MOCK_TELEGRAM_ID ?? "900000001");
    const user = await prisma.user.upsert({
      where: { telegramId },
      create: {
        telegramId,
        firstName: process.env.MOCK_TELEGRAM_FIRST_NAME ?? "Локальный автор",
        username: "watchroom_dev",
      },
      update: {},
    });
    await prisma.channel.upsert({
      where: { slug: "demo-watchroom" },
      create: {
        publicId: randomBytes(16).toString("base64url"),
        slug: "demo-watchroom",
        ownerId: user.id,
        name: "Демо-канал",
        description: "Канал для локальной разработки",
        visibility: "PUBLIC",
        members: { create: { userId: user.id, role: "OWNER" } },
      },
      update: {},
    });
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? `Seed failed: ${error.name}` : "Seed failed");
  process.exitCode = 1;
});
