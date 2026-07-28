import { parseAmountValue } from "../constants/customerDetail";

const STORAGE_KEY = "dhatterwal_customer_detail_rows";

function normalizeConsumerNo(value) {
  return String(value || "").trim().toUpperCase();
}

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function loadCustomerDetailRows() {
  const stored = safeParse(localStorage.getItem(STORAGE_KEY), null);
  if (Array.isArray(stored)) {
    return stored;
  }
  return [];
}

export function saveCustomerDetailRows(rows) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

/** Row must already exist from Sale Sheet sync — no orphan rows created here. */
export function ensureCustomerDetailRow(consumerNo) {
  const key = normalizeConsumerNo(consumerNo);
  if (!key) return null;

  const rows = loadCustomerDetailRows();
  return rows.find((r) => normalizeConsumerNo(r.consumerNo) === key) || null;
}

export function parseAmountValueExport(value) {
  return parseAmountValue(value);
}
