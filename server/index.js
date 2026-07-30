import cors from "cors";
import express from "express";
import { authMiddleware, ensureSeededLoginUsers, findUser, signToken } from "./auth.js";
import { testDatabaseConnection } from "./dbTest.js";
import { loadEnvFile } from "./loadEnv.js";
import {
  getAllKeys,
  getKey,
  getStoreBackendName,
  initStore,
  migrateJsonFileIfEmpty,
  removeKey,
  setKey,
  setMany,
} from "./store.js";

loadEnvFile();

const PORT = Number(process.env.PORT || 8787);
const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "40mb" }));

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "dhatterwal-erp-api",
    message: "Dhatterwal Solar ERP API is running.",
    health: "/health",
    apiHealth: "/api/health",
    dbTest: "/api/db/test",
    login: "POST /api/auth/login",
  });
});

app.get("/health", async (_req, res) => {
  try {
    const { keys, updatedAt } = await getAllKeys();
    res.json({
      ok: true,
      service: "dhatterwal-erp-api",
      database: getStoreBackendName(),
      keyCount: Object.keys(keys).length,
      updatedAt,
      time: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "dhatterwal-erp-api",
      database: getStoreBackendName(),
      error: err?.message || "db error",
    });
  }
});

app.get("/api/health", async (_req, res) => {
  try {
    const { keys, updatedAt } = await getAllKeys();
    res.json({
      ok: true,
      service: "dhatterwal-erp-api",
      database: getStoreBackendName(),
      keyCount: Object.keys(keys).length,
      updatedAt,
      time: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "dhatterwal-erp-api",
      database: getStoreBackendName(),
      error: err?.message || "db error",
    });
  }
});

app.get("/api/db/test", async (_req, res) => {
  try {
    const result = await testDatabaseConnection();
    res.status(result.ok ? 200 : 500).json(result);
  } catch (err) {
    res.status(500).json({
      ok: false,
      backend: getStoreBackendName(),
      error: err?.message || "Database test failed",
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { userId, password } = req.body || {};
    const user = await findUser(userId, password);
    if (!user) {
      res.status(401).json({
        ok: false,
        error:
          "Invalid User ID or password. Staff users: Staff tab use karein (jagdeep/randeep/ajaynain).",
      });
      return;
    }
    const token = signToken(user);
    res.json({
      ok: true,
      token,
      user: {
        userId: user.userId,
        role: user.role,
        roleLabel: user.roleLabel,
        displayName: user.displayName,
        accessProfile: user.accessProfile || "",
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "Login failed." });
  }
});

app.get("/api/sync", authMiddleware, async (_req, res) => {
  try {
    const { keys, updatedAt } = await getAllKeys();
    res.json({ ok: true, updatedAt, keys });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "sync failed" });
  }
});

app.get("/api/sync/:key", authMiddleware, async (req, res) => {
  try {
    const value = await getKey(req.params.key);
    res.json({ ok: true, key: req.params.key, value });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "sync failed" });
  }
});

app.put("/api/sync/:key", authMiddleware, async (req, res) => {
  try {
    const { value } = req.body || {};
    if (typeof value !== "string" && value !== null) {
      res.status(400).json({ ok: false, error: "value must be a JSON string (or null)." });
      return;
    }
    if (value === null) {
      const updatedAt = await removeKey(req.params.key);
      res.json({ ok: true, updatedAt });
      return;
    }
    const updatedAt = await setKey(req.params.key, value);
    res.json({ ok: true, updatedAt });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "sync failed" });
  }
});

app.post("/api/sync/bulk", authMiddleware, async (req, res) => {
  try {
    const { entries } = req.body || {};
    if (!entries || typeof entries !== "object") {
      res.status(400).json({ ok: false, error: "entries object required." });
      return;
    }
    const updatedAt = await setMany(entries);
    res.json({ ok: true, updatedAt });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "sync failed" });
  }
});

async function start() {
  const backend = await initStore();
  const mig = await migrateJsonFileIfEmpty();
  if (mig.migrated) {
    console.log(`Migrated ${mig.count} keys from erp-store.json → ${backend.backend}`);
  } else {
    console.log(`Database ready: ${backend.backend} (${mig.reason || "ok"})`);
  }

  await ensureSeededLoginUsers();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Dhatterwal ERP API listening on http://0.0.0.0:${PORT}`);
    console.log(`Database: ${backend.backend}`);
  });
}

start().catch((err) => {
  console.error("Failed to start API:", err?.message || err);
  process.exit(1);
});
