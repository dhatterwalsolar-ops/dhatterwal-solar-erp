import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPrisma, initDb as initPrismaDb } from "./db.js";
import { usePglite, usePrismaPostgres } from "./dbUrl.js";
import {
  closePglite,
  initPgliteDb,
  pgliteGetAllKeys,
  pgliteGetKey,
  pgliteRemoveKey,
  pgliteSetKey,
  pgliteSetMany,
} from "./pgliteStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "erp-store.json");

export async function initStore() {
  if (usePglite()) {
    await initPgliteDb();
    return { backend: "pglite" };
  }
  if (usePrismaPostgres()) {
    await initPrismaDb();
    return { backend: "postgresql" };
  }
  throw new Error(
    "Database set nahi hai.\n" +
      "Docker ke bina: server/.env me USE_PGLITE=true rakho\n" +
      "Ya Neon/Postgres: DATABASE_URL=postgresql://...",
  );
}

export async function getAllKeys() {
  if (usePglite()) return pgliteGetAllKeys();
  const rows = await getPrisma().erpKv.findMany({ select: { key: true, value: true } });
  const keys = {};
  for (const row of rows) keys[row.key] = row.value;
  const meta = await getPrisma().erpMeta.findUnique({ where: { id: 1 } });
  const updatedAt = meta?.updatedAt ? new Date(meta.updatedAt).toISOString() : null;
  return { keys, updatedAt };
}

export async function getKey(key) {
  if (usePglite()) return pgliteGetKey(key);
  const row = await getPrisma().erpKv.findUnique({ where: { key } });
  return row ? row.value : null;
}

export async function setKey(key, value) {
  if (usePglite()) return pgliteSetKey(key, value);
  return getPrisma().$transaction(async (tx) => {
    await tx.erpKv.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    const updatedAt = new Date();
    await tx.erpMeta.upsert({
      where: { id: 1 },
      create: { id: 1, updatedAt },
      update: { updatedAt },
    });
    return updatedAt.toISOString();
  });
}

export async function setMany(entries) {
  if (usePglite()) return pgliteSetMany(entries);

  const pairs = Object.entries(entries || {}).filter(([key]) => key);
  // Neon pooler: bade transaction timeout se bachne ke liye batches
  const chunkSize = 5;
  let updatedAt = new Date().toISOString();
  for (let i = 0; i < pairs.length; i += chunkSize) {
    const chunk = pairs.slice(i, i + chunkSize);
    updatedAt = await getPrisma().$transaction(
      async (tx) => {
        for (const [key, value] of chunk) {
          if (value === null) {
            await tx.erpKv.deleteMany({ where: { key } });
          } else {
            await tx.erpKv.upsert({
              where: { key },
              create: { key, value },
              update: { value },
            });
          }
        }
        const ts = new Date();
        await tx.erpMeta.upsert({
          where: { id: 1 },
          create: { id: 1, updatedAt: ts },
          update: { updatedAt: ts },
        });
        return ts.toISOString();
      },
      { maxWait: 20_000, timeout: 60_000 },
    );
  }
  return updatedAt;
}

export async function removeKey(key) {
  if (usePglite()) return pgliteRemoveKey(key);
  return getPrisma().$transaction(async (tx) => {
    await tx.erpKv.deleteMany({ where: { key } });
    const updatedAt = new Date();
    await tx.erpMeta.upsert({
      where: { id: 1 },
      create: { id: 1, updatedAt },
      update: { updatedAt },
    });
    return updatedAt.toISOString();
  });
}

export async function migrateJsonFileIfEmpty() {
  const { keys } = await getAllKeys();
  if (Object.keys(keys).length > 0) {
    return { migrated: false, reason: "db-already-has-data" };
  }
  if (!fs.existsSync(DATA_FILE)) {
    return { migrated: false, reason: "no-json-file" };
  }
  let fileDb;
  try {
    fileDb = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { migrated: false, reason: "json-parse-error" };
  }
  const fileKeys = fileDb?.keys || {};
  const n = Object.keys(fileKeys).length;
  if (!n) return { migrated: false, reason: "json-empty" };
  await setMany(fileKeys);
  return { migrated: true, count: n };
}

export async function closeStore() {
  if (usePglite()) await closePglite();
}

export function getJsonStorePath() {
  return DATA_FILE;
}

export function getStoreBackendName() {
  if (usePglite()) return "pglite";
  if (usePrismaPostgres()) return "postgresql";
  return "none";
}
