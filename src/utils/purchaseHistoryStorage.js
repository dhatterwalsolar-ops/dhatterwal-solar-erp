import { erpGetItem, erpRemoveItem, erpSetItem } from "./erpStorage";
const HISTORY_KEY = "dhatterwal_purchase_history";

export const PURCHASE_HISTORY_SYNC_EVENT = "dhatterwal-purchase-history-sync";

export function notifyPurchaseHistorySync() {
  window.dispatchEvent(new Event(PURCHASE_HISTORY_SYNC_EVENT));
}

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Known demo ids — purged once on login; never auto-injected again. */
export const DEMO_PURCHASE_IDS = ["pur-demo-1", "pur-demo-2"];

export function loadPurchaseHistory() {
  const stored = safeParse(erpGetItem(HISTORY_KEY), null);
  return Array.isArray(stored) ? stored : [];
}

export function normalizePurchaseInvoiceNo(value) {
  return String(value || "").trim().toUpperCase();
}

export function findPurchaseHistoryByInvoiceNo(invoiceNo) {
  const key = normalizePurchaseInvoiceNo(invoiceNo);
  if (!key) return null;
  return (
    loadPurchaseHistory().find((p) => normalizePurchaseInvoiceNo(p.invoiceNo) === key) ?? null
  );
}

export function savePurchaseHistoryRecord(record) {
  const key = normalizePurchaseInvoiceNo(record?.invoiceNo);
  if (!key) {
    return { ok: false, reason: "missing_invoice" };
  }

  const list = loadPurchaseHistory();
  const existing = list.find((p) => normalizePurchaseInvoiceNo(p.invoiceNo) === key);
  if (existing) {
    return { ok: false, reason: "duplicate", existing };
  }

  list.unshift(record);
  try {
    erpSetItem(HISTORY_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    return { ok: false, reason: "storage_error" };
  }
  notifyPurchaseHistorySync();
  return { ok: true };
}

export function deletePurchaseHistoryRecord(id) {
  if (!id) return { ok: false, reason: "missing_id" };
  const list = loadPurchaseHistory();
  const record = list.find((p) => p.id === id);
  if (!record) return { ok: false, reason: "not_found" };

  const next = list.filter((p) => p.id !== id);
  try {
    erpSetItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    return { ok: false, reason: "storage_error" };
  }
  notifyPurchaseHistorySync();
  return { ok: true, record };
}
