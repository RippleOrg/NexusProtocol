import type { PrismaClient } from "@prisma/client";

declare global {
  var __nexusPrisma: PrismaClient | undefined;
}

export async function getPrismaClient(): Promise<PrismaClient> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!global.__nexusPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    global.__nexusPrisma = new PrismaClient();
  }

  return global.__nexusPrisma;
}
