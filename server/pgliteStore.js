import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const PGLITE_DIR = path.join(DATA_DIR, "pglite");

let db = null;

export async function getPglite() {
  if (db) return db;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new PGlite(PGLITE_DIR);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS erp_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS erp_meta (
      id SMALLINT PRIMARY KEY DEFAULT 1,
      updated_at TIMESTAMPTZ
    );
    INSERT INTO erp_meta (id, updated_at)
    VALUES (1, NULL)
    ON CONFLICT (id) DO NOTHING;
  `);
  return db;
}

async function touchMeta(client) {
  const updatedAt = new Date().toISOString();
  await client.query(
    `INSERT INTO erp_meta (id, updated_at) VALUES (1, $1::timestamptz)
     ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at`,
    [updatedAt],
  );
  return updatedAt;
}

export async function initPgliteDb() {
  return getPglite();
}

export async function pgliteGetAllKeys() {
  const client = await getPglite();
  const { rows } = await client.query(`SELECT key, value FROM erp_kv`);
  const keys = {};
  for (const row of rows) keys[row.key] = row.value;
  const meta = await client.query(`SELECT updated_at FROM erp_meta WHERE id = 1`);
  const v = meta.rows[0]?.updated_at;
  const updatedAt = v ? new Date(v).toISOString() : null;
  return { keys, updatedAt };
}

export async function pgliteGetKey(key) {
  const client = await getPglite();
  const { rows } = await client.query(`SELECT value FROM erp_kv WHERE key = $1`, [key]);
  return rows[0] ? rows[0].value : null;
}

export async function pgliteSetKey(key, value) {
  const client = await getPglite();
  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO erp_kv (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value],
    );
    const updatedAt = await touchMeta(client);
    await client.query("COMMIT");
    return updatedAt;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function pgliteSetMany(entries) {
  const client = await getPglite();
  await client.query("BEGIN");
  try {
    for (const [key, value] of Object.entries(entries || {})) {
      if (!key) continue;
      if (value === null) {
        await client.query(`DELETE FROM erp_kv WHERE key = $1`, [key]);
      } else {
        await client.query(
          `INSERT INTO erp_kv (key, value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value, updated_at = NOW()`,
          [key, value],
        );
      }
    }
    const updatedAt = await touchMeta(client);
    await client.query("COMMIT");
    return updatedAt;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function pgliteRemoveKey(key) {
  const client = await getPglite();
  await client.query("BEGIN");
  try {
    await client.query(`DELETE FROM erp_kv WHERE key = $1`, [key]);
    const updatedAt = await touchMeta(client);
    await client.query("COMMIT");
    return updatedAt;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function closePglite() {
  if (db) {
    await db.close();
    db = null;
  }
}
