import { getPrisma, initDb } from "./db.js";
import { usePrismaPostgres, usePglite } from "./dbUrl.js";

/** Neon / Postgres connection check for Express. */
export async function testDatabaseConnection() {
  if (usePglite()) {
    return {
      ok: true,
      backend: "pglite",
      message: "Local PGlite active (not Neon). Set USE_PGLITE=false + DATABASE_URL for Neon.",
    };
  }

  if (!usePrismaPostgres()) {
    return {
      ok: false,
      backend: "none",
      message: "DATABASE_URL missing or invalid. Use postgresql://... from Neon.",
    };
  }

  const prisma = getPrisma();
  const started = Date.now();
  await prisma.$queryRaw`SELECT 1 AS ok`;
  await initDb();

  const counts = {
    customers: await prisma.customer.count(),
    products: await prisma.product.count(),
    invoices: await prisma.invoice.count(),
    stockBalances: await prisma.stockBalance.count(),
    paymentReceived: await prisma.paymentReceived.count(),
    paymentGiven: await prisma.paymentGiven.count(),
    saleCases: await prisma.saleCase.count(),
    cashCases: await prisma.cashCase.count(),
    loanCases: await prisma.loanCase.count(),
    erpKv: await prisma.erpKv.count(),
  };

  return {
    ok: true,
    backend: "postgresql",
    provider: "neon",
    latencyMs: Date.now() - started,
    counts,
    message: "Neon PostgreSQL connected via Prisma.",
  };
}
