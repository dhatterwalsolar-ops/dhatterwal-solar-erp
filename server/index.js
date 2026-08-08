import cors from "cors";
import express from "express";
import { authMiddleware, ensureSeededLoginUsers, findUser, signToken } from "./auth.js";
import { testDatabaseConnection } from "./dbTest.js";
import { loadEnvFile } from "./loadEnv.js";
import { messagingStatus } from "./messaging/config.js";
import { issueOtp, verifyOtp } from "./messaging/otpStore.js";
import { sendQueryAlertWhatsApp, sendWhatsAppMessage } from "./messaging/whatsapp.js";
import {
  applyGoogleFormToBomAndSale,
  getGoogleFormWebhookSecret,
} from "./googleFormBom.js";
import { applySiteFormToServer } from "./siteFormBom.js";
import {
  generateEwayBill,
  generateGstEinvoice,
  getGstStatus,
} from "./gst/gstService.js";
import {
  getAllKeys,
  getKey,
  getStoreBackendName,
  initStore,
  migrateJsonFileIfEmpty,
  removeKey,
  setKey,
  setMany,
  wipeBusinessData,
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
    googleFormBom: "POST /api/public/google-form-bom",
    siteFormSubmit: "POST /api/public/site-form-submit",
    gstStatus: "GET /api/gst/status",
    ewayGenerate: "POST /api/gst/eway/generate",
    einvoiceGenerate: "POST /api/gst/einvoice/generate",
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

app.get("/api/messaging/status", (_req, res) => {
  res.json(messagingStatus());
});

app.post("/api/otp/send", authMiddleware, async (req, res) => {
  try {
    const purpose = String(req.body?.purpose || "settings").trim();
    const mobile = req.body?.mobile;
    const result = await issueOtp({ purpose, mobile });
    res.json(result);
  } catch (err) {
    res.status(400).json({ ok: false, error: err?.message || "OTP send fail" });
  }
});

app.post("/api/otp/verify", authMiddleware, async (req, res) => {
  try {
    const purpose = String(req.body?.purpose || "settings").trim();
    const code = String(req.body?.code || "").trim();
    const result = verifyOtp({ purpose, code });
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    res.status(400).json({ ok: false, error: err?.message || "OTP verify fail" });
  }
});

app.post("/api/messaging/whatsapp", authMiddleware, async (req, res) => {
  try {
    const to = String(req.body?.to || "").trim();
    const text = String(req.body?.text || "").trim();
    if (!to || !text) {
      res.status(400).json({ ok: false, error: "to + text required" });
      return;
    }
    const result = await sendWhatsAppMessage(to, text);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err?.message || "WhatsApp send fail" });
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

/**
 * Admin only — wipe all demo/business data for live go-live.
 * Body: { confirm: "WIPE_LIVE_DATA" }
 * Login users rahega. VPS pe ek baar call karein, phir env/script hata dein.
 */
app.post("/api/admin/wipe-business", authMiddleware, async (req, res) => {
  try {
    if (String(req.user?.role || "").toLowerCase() !== "admin") {
      res.status(403).json({ ok: false, error: "Admin only." });
      return;
    }
    if (String(req.body?.confirm || "") !== "WIPE_LIVE_DATA") {
      res.status(400).json({
        ok: false,
        error: 'confirm: "WIPE_LIVE_DATA" required.',
      });
      return;
    }
    const result = await wipeBusinessData({ keepLoginUsers: true });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "wipe failed" });
  }
});

/** GST API status (demo / http GSP) — login required. */
app.get("/api/gst/status", authMiddleware, (_req, res) => {
  res.json(getGstStatus());
});

/** E-Way Bill generate — Sale Sheet se. */
app.post("/api/gst/eway/generate", authMiddleware, async (req, res) => {
  try {
    const result = await generateEwayBill(req.body || {});
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "E-Way generate fail" });
  }
});

/** GST E-Invoice (IRN) — With GST invoice ke sath. */
app.post("/api/gst/einvoice/generate", authMiddleware, async (req, res) => {
  try {
    const result = await generateGstEinvoice(req.body || {});
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "E-Invoice generate fail" });
  }
});

/**
 * Google Apps Script (Form submit) → BOM Sheet + Sale Setup Detail.
 * Header: X-Webhook-Secret: <GOOGLE_FORM_WEBHOOK_SECRET>
 * Or body.secret / ?secret=
 */
app.post("/api/public/google-form-bom", async (req, res) => {
  try {
    const expected = getGoogleFormWebhookSecret();
    if (!expected) {
      res.status(503).json({
        ok: false,
        error: "GOOGLE_FORM_WEBHOOK_SECRET server/.env me set nahi hai.",
      });
      return;
    }
    const provided = String(
      req.get("x-webhook-secret") ||
        req.body?.secret ||
        req.query?.secret ||
        "",
    ).trim();
    if (!provided || provided !== expected) {
      res.status(401).json({ ok: false, error: "Invalid webhook secret." });
      return;
    }

    const payload = { ...(req.body || {}) };
    delete payload.secret;
    const result = await applyGoogleFormToBomAndSale(payload);
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "Google Form BOM sync fail" });
  }
});

/**
 * Team Leader site form (no ERP login) → BOM Sheet + Sale Setup + site order on server.
 * Office PCs poll sync se BOM dekhte hain.
 */
app.post("/api/public/site-form-submit", async (req, res) => {
  try {
    const body = req.body || {};
    const order = body.order || {};
    const form = body.form || body.formPayload || {};
    if (!order.consumerNo && form.consumerNo) {
      order.consumerNo = form.consumerNo;
    }
    const result = await applySiteFormToServer({ order, form });
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "Site form BOM sync fail" });
  }
});

/** Public website — customer query (no login). Appends to erp_kv query sheet. */
app.post("/api/public/query", async (req, res) => {
  try {
    const body = req.body || {};
    const customerName = String(body.customerName || "").trim();
    const mobile = String(body.mobile || "").replace(/\D/g, "").slice(-10);
    const kind = String(body.kind || "").trim().toLowerCase();
    const isConsultation = kind === "consultation";
    let address = String(body.address || "").trim();
    if (!address && isConsultation) {
      address = "Website consultation — address call pe confirm";
    }
    const queryAbout = String(body.queryAbout || "").trim();
    let detail = String(body.detail || "").trim();
    if (!detail && isConsultation && queryAbout) {
      detail = `Free consultation from main website.\nRequirement: ${queryAbout}`;
    }
    const consumerNo = String(body.consumerNo || "").trim();
    let customerPhotoData = String(body.customerPhotoData || "").trim();
    const customerPhotoName = String(body.customerPhotoName || "").trim();
    if (customerPhotoData && !customerPhotoData.startsWith("data:image/")) {
      customerPhotoData = "";
    }
    if (customerPhotoData.length > 6_500_000) {
      res.status(400).json({
        ok: false,
        error: "Photo bahut badi hai — chhoti image (under ~5MB) try karein.",
      });
      return;
    }

    if (!customerName || mobile.length !== 10 || !address || !queryAbout || !detail) {
      res.status(400).json({
        ok: false,
        error: "Name, 10-digit mobile, address, query about aur detail zaroori hain.",
      });
      return;
    }

    const KEY = "dhatterwal_query_sheet";
    let list = [];
    try {
      const raw = await getKey(KEY);
      list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
    } catch {
      list = [];
    }

    const pad = (n) => String(n).padStart(2, "0");
    const now = new Date();
    const entry = {
      id: `qry-web-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`,
      consumerNo,
      customerName,
      mobile,
      address,
      queryAbout,
      detail,
      status: "Pending",
      source: "public",
      createdBy: isConsultation ? "Website Consultation" : "Website",
      kind: isConsultation ? "consultation" : "query",
      createdAt: now.toISOString(),
      assignedTeamWork: "",
      assignedLeaderName: "",
      assignedLeaderMobile: "",
      assignedAt: "",
      customerPhotoData,
      customerPhotoName: customerPhotoData ? customerPhotoName || "customer-site.jpg" : "",
      photoData: "",
      photoName: "",
      photoUploadedAt: "",
      photoUploadedBy: "",
      closeRemark: "",
      closedBy: "",
      closedAt: "",
      closedVia: "",
      staffAlertSent: false,
      staffAlertSentAt: "",
    };

    list.unshift(entry);
    if (list.length > 500) list = list.slice(0, 500);

    /** Live WhatsApp API configured ho to Jagdeep ko server se auto alert */
    let whatsappAlert = { attempted: false };
    try {
      const alertText = [
        isConsultation
          ? "*Dhatterwal Solar — Website Consultation*"
          : "*Dhatterwal Solar — New Website Query*",
        "",
        `*Customer:* ${customerName}`,
        `*Mobile:* ${mobile}`,
        `*Address:* ${address}`,
        consumerNo ? `*Consumer No.:* ${consumerNo}` : null,
        "",
        `*${isConsultation ? "Requirement" : "Query about"}:* ${queryAbout}`,
        `*Detail:*`,
        detail,
        customerPhotoData
          ? "📷 Customer ne site/inverter photo upload ki — ERP Query Sheet me dekhein."
          : null,
        "",
        "ERP → Query Sheet me dikhega — Team Leader transfer karein.",
      ]
        .filter((x) => x !== null)
        .join("\n");

      whatsappAlert = { attempted: true, ...(await sendQueryAlertWhatsApp(alertText)) };
      if (whatsappAlert.live) {
        entry.staffAlertSent = true;
        entry.staffAlertSentAt = now.toISOString();
      }
    } catch (waErr) {
      whatsappAlert = {
        attempted: true,
        live: false,
        error: waErr?.message || "WhatsApp alert fail",
      };
    }

    const updatedAt = await setKey(KEY, JSON.stringify(list));
    res.json({ ok: true, id: entry.id, updatedAt, whatsappAlert });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "Query save fail" });
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

  if (String(process.env.WIPE_BUSINESS_DATA_ONCE || "").toLowerCase() === "true") {
    const wipe = await wipeBusinessData({ keepLoginUsers: true });
    console.log(
      `[live-prep] Business data wiped (removed ${wipe.removed} keys). Remove WIPE_BUSINESS_DATA_ONCE from env.`,
    );
    await ensureSeededLoginUsers();
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Dhatterwal ERP API listening on http://0.0.0.0:${PORT}`);
    console.log(`Database: ${backend.backend}`);
  });
}

start().catch((err) => {
  console.error("Failed to start API:", err?.message || err);
  process.exit(1);
});
