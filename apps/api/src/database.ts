import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client.js";

export interface DatabaseHealth {
  ping(): Promise<void>;
  close(): Promise<void>;
}

export interface DatabaseRuntime extends DatabaseHealth {
  prisma: PrismaClient;
}

class PostgresDatabase implements DatabaseRuntime {
  readonly prisma: PrismaClient;

  constructor(connectionString: string) {
    const adapter = new PrismaPg({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 3_000,
      idleTimeoutMillis: 30_000,
    });
    this.prisma = new PrismaClient({ adapter });
  }

  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export function createPostgresDatabase(connectionString: string): DatabaseRuntime {
  return new PostgresDatabase(connectionString);
}
