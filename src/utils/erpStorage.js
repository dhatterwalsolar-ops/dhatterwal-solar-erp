/**
 * Shared ERP storage — memory + local cache + server sync.
 * All PCs with same API see the same business data.
 */

const TOKEN_KEY = "dhatterwal_erp_api_token";
const SYNC_EVENT = "dhatterwal-erp-cloud-sync";

const memory = new Map();
let hydrated = false;
let pushTimer = null;
const pendingPush = new Map();
let lastServerUpdatedAt = null;
let pollTimer = null;

export function getApiBase() {
  const fromEnv = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    /* Dev: Vite on 5173, API on 8787 */
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${protocol}//${hostname}:8787`;
    }
  }
  return "";
}

export function getApiToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setApiToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function isCloudEnabled() {
  return Boolean(getApiBase() && getApiToken());
}

export function isHydrated() {
  return hydrated;
}

/** Storage key → sheet events. Poll pe sirf changed keys ke events — Sale Sheet lag kam. */
const KEY_SYNC_EVENTS = {
  dhatterwal_loan_case_rows: ["dhatterwal-loan-case-sync", "dhatterwal-sale-case-sync"],
  dhatterwal_cash_case_rows: ["dhatterwal-cash-case-sync", "dhatterwal-sale-case-sync"],
  dhatterwal_sale_case_rows: ["dhatterwal-sale-case-sync"],
  dhatterwal_bom_sheet_files: ["dhatterwal-sale-bom-sync", "dhatterwal-sale-setup-detail-sync"],
  dhatterwal_invoice_file: ["dhatterwal-invoice-file-sync"],
  dhatterwal_stock_balances: ["dhatterwal-stock-sync"],
  dhatterwal_stock_ledger: ["dhatterwal-stock-sync"],
  dhatterwal_payment_received: ["dhatterwal-payment-mgmt-sync"],
  dhatterwal_payment_given: ["dhatterwal-payment-mgmt-sync"],
  dhatterwal_payment_accounts: ["dhatterwal-payment-accounts-sync"],
  dhatterwal_customer_payments: ["dhatterwal-customer-payment-sync"],
  dhatterwal_purchase_history: ["dhatterwal-purchase-history-sync"],
  dhatterwal_site_orders: ["dhatterwal-site-order-sync"],
  dhatterwal_backup_entries: ["dhatterwal-backup-entry-sync"],
  dhatterwal_credit_facilities: ["dhatterwal-credit-facility-sync"],
  dhatterwal_credit_facility_txns: ["dhatterwal-credit-facility-sync"],
  dhatterwal_customer_detail_rows: ["dhatterwal-customer-detail-sale-sync"],
  dhatterwal_erp_settings: ["dhatterwal-invoice-format-sync"],
  dhatterwal_labour_team_mapping: ["dhatterwal-labour-sync"],
  dhatterwal_sale_team_leader_map: ["dhatterwal-labour-sync"],
};

const ALL_SHEET_EVENTS = [
  "dhatterwal-sale-case-sync",
  "dhatterwal-sale-bom-sync",
  "dhatterwal-loan-case-sync",
  "dhatterwal-cash-case-sync",
  "dhatterwal-invoice-file-sync",
  "dhatterwal-stock-sync",
  "dhatterwal-payment-mgmt-sync",
  "dhatterwal-payment-accounts-sync",
  "dhatterwal-customer-payment-sync",
  "dhatterwal-purchase-history-sync",
  "dhatterwal-site-order-sync",
  "dhatterwal-backup-entry-sync",
  "dhatterwal-credit-facility-sync",
  "dhatterwal-customer-detail-sale-sync",
  "dhatterwal-invoice-format-sync",
];

function notifySync(changedKeys = null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SYNC_EVENT));
  const events = new Set();
  if (!changedKeys || !changedKeys.length) {
    ALL_SHEET_EVENTS.forEach((e) => events.add(e));
  } else {
    changedKeys.forEach((key) => {
      (KEY_SYNC_EVENTS[key] || []).forEach((e) => events.add(e));
    });
  }
  events.forEach((name) => window.dispatchEvent(new Event(name)));
}

export { SYNC_EVENT };

async function apiFetch(path, options = {}) {
  const base = getApiBase();
  if (!base) throw new Error("API URL missing (VITE_API_URL).");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getApiToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `API error ${res.status}`);
  }
  return data;
}

export async function loginToApi({ userId, password, role }) {
  const data = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ userId, password, role }),
  });
  setApiToken(data.token);
  return data.user;
}

export async function hydrateFromServer({ uploadLocalIfEmpty = true } = {}) {
  if (!getApiToken()) {
    hydrated = true;
    return { ok: false, reason: "no-token" };
  }

  const data = await apiFetch("/api/sync");
  const serverKeys = data.keys || {};
  const serverEmpty = Object.keys(serverKeys).length === 0;
  lastServerUpdatedAt = data.updatedAt || null;

  if (serverEmpty && uploadLocalIfEmpty) {
    const localEntries = {};
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith("dhatterwal_")) {
          localEntries[key] = localStorage.getItem(key);
        }
      }
    } catch {
      /* ignore */
    }
    if (Object.keys(localEntries).length) {
      const bulk = await apiFetch("/api/sync/bulk", {
        method: "POST",
        body: JSON.stringify({ entries: localEntries }),
      });
      lastServerUpdatedAt = bulk.updatedAt || lastServerUpdatedAt;
      Object.entries(localEntries).forEach(([k, v]) => memory.set(k, v));
      hydrated = true;
      startPolling();
      notifySync();
      return { ok: true, seededFromLocal: true };
    }
  }

  memory.clear();
  Object.entries(serverKeys).forEach(([key, value]) => {
    if (typeof value === "string") {
      memory.set(key, value);
      try {
        localStorage.setItem(key, value);
      } catch {
        /* quota */
      }
    }
  });

  hydrated = true;
  startPolling();
  notifySync();
  return { ok: true, seededFromLocal: false, keyCount: Object.keys(serverKeys).length };
}

function schedulePush(key, value) {
  if (!isCloudEnabled()) return;
  pendingPush.set(key, value);
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(flushPush, 350);
}

async function flushPush() {
  pushTimer = null;
  if (!pendingPush.size || !isCloudEnabled()) return;
  const entries = Object.fromEntries(pendingPush.entries());
  pendingPush.clear();
  try {
    const data = await apiFetch("/api/sync/bulk", {
      method: "POST",
      body: JSON.stringify({ entries }),
    });
    lastServerUpdatedAt = data.updatedAt || lastServerUpdatedAt;
  } catch (err) {
    console.warn("[erpStorage] sync push failed", err);
    Object.entries(entries).forEach(([k, v]) => pendingPush.set(k, v));
    if (!pushTimer) pushTimer = setTimeout(flushPush, 2000);
  }
}

/** Delete / critical saves — pending push turant server pe bhejo (poll race avoid). */
export function flushErpPushNow() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  return flushPush();
}

export function erpGetItem(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) memory.set(key, raw);
    return raw;
  } catch {
    return null;
  }
}

export function erpSetItem(key, value) {
  const str = String(value);
  memory.set(key, str);
  try {
    localStorage.setItem(key, str);
  } catch {
    /* quota — still keep memory + try server */
  }
  schedulePush(key, str);
}

export function erpRemoveItem(key) {
  memory.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  if (isCloudEnabled()) {
    pendingPush.set(key, null);
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(flushPush, 350);
  }
}

export function startPolling(intervalMs = 5000) {
  stopPolling();
  if (!isCloudEnabled()) return;
  pollTimer = setInterval(async () => {
    try {
      const data = await apiFetch("/api/sync");
      if (!data.updatedAt || data.updatedAt === lastServerUpdatedAt) return;
      lastServerUpdatedAt = data.updatedAt;
      const keys = data.keys || {};
      const changedKeys = [];
      Object.entries(keys).forEach(([key, value]) => {
        if (typeof value !== "string") return;
        /* Local pending write ko server ke purane data se overwrite mat karo */
        if (pendingPush.has(key)) return;
        if (memory.get(key) === value) return;
        memory.set(key, value);
        try {
          localStorage.setItem(key, value);
        } catch {
          /* ignore */
        }
        changedKeys.push(key);
      });
      if (changedKeys.length) notifySync(changedKeys);
    } catch {
      /* offline */
    }
  }, intervalMs);
}

export function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function logoutCloud() {
  stopPolling();
  setApiToken("");
  pendingPush.clear();
  hydrated = false;
}
