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

const DEMO_PURCHASES = [
  {
    id: "pur-demo-1",
    invoiceNo: "PINV-2407-018",
    invoiceDate: "24/07/2025",
    supplier: "Waaree Energies Ltd",
    taxableAmount: 196000,
    gstAmount: 23520,
    totalAmount: 219520,
    roundOff: -280,
    grandTotal: 219240,
    paymentMode: "Credit",
    savedAt: "2025-07-24T10:00:00.000Z",
  },
  {
    id: "pur-demo-2",
    invoiceNo: "PINV-2407-017",
    invoiceDate: "22/07/2025",
    supplier: "Growatt India",
    taxableAmount: 88000,
    gstAmount: 10560,
    totalAmount: 98560,
    roundOff: -60,
    grandTotal: 98500,
    paymentMode: "Credit",
    savedAt: "2025-07-22T10:00:00.000Z",
  },
];

export function loadPurchaseHistory() {
  const stored = safeParse(localStorage.getItem(HISTORY_KEY), null);
  if (Array.isArray(stored) && stored.length > 0) return stored;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(DEMO_PURCHASES));
  return DEMO_PURCHASES;
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
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 200)));
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
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    return { ok: false, reason: "storage_error" };
  }
  notifyPurchaseHistorySync();
  return { ok: true, record };
}
