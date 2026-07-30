import { PrismaClient } from "@prisma/client";
import { getDatabaseUrl, usePrismaPostgres } from "./dbUrl.js";

export { getDatabaseUrl } from "./dbUrl.js";

let prisma = null;

export function getPrisma() {
  if (!usePrismaPostgres()) {
    throw new Error("Prisma Postgres tabhi jab DATABASE_URL=postgresql://... ho.");
  }
  if (!prisma) {
    const url = getDatabaseUrl();
    prisma = new PrismaClient({
      datasources: { db: { url } },
      transactionOptions: {
        maxWait: 20_000,
        timeout: 120_000,
      },
    });
  }
  return prisma;
}

export async function initDb() {
  const db = getPrisma();
  await db.erpMeta.upsert({
    where: { id: 1 },
    create: { id: 1, updatedAt: null },
    update: {},
  });
  return db;
}

export async function closeDb() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
