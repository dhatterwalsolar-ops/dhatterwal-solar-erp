import { refreshSavedSaleRowsFromCaseSheets } from "./saleCaseSync";
import { erpGetItem, erpRemoveItem, erpSetItem } from "./erpStorage";

const STORAGE_KEY = "dhatterwal_update_name_load_rows";
const OVERRIDE_KEY = "dhatterwal_update_name_load";

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

export function loadUpdateNameLoadRows() {
  return safeParse(erpGetItem(STORAGE_KEY), []);
}

export function saveUpdateNameLoadRows(rows) {
  try {
    erpSetItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

export function loadNameLoadOverrides() {
  return safeParse(erpGetItem(OVERRIDE_KEY), {});
}

export function saveNameLoadOverride(consumerNo, patch) {
  const key = normalizeConsumerNo(consumerNo);
  if (!key) return;
  const map = loadNameLoadOverrides();
  map[key] = {
    ...map[key],
    ...patch,
    consumerNo: key,
    updatedAt: new Date().toLocaleString("en-IN"),
  };
  try {
    erpSetItem(OVERRIDE_KEY, JSON.stringify(map));
    refreshSavedSaleRowsFromCaseSheets();
  } catch {
    /* ignore */
  }
}

export function getNameLoadOverride(consumerNo) {
  const key = normalizeConsumerNo(consumerNo);
  if (!key) return null;
  return loadNameLoadOverrides()[key] ?? null;
}

export function upsertUpdateNameLoadRow(row) {
  const list = loadUpdateNameLoadRows();
  const idx = list.findIndex((r) => r.id === row.id);
  const next = { ...row, savedAt: new Date().toISOString() };
  if (idx >= 0) {
    list[idx] = next;
  } else {
    list.unshift(next);
  }
  saveUpdateNameLoadRows(list);
  return next;
}

export { normalizeConsumerNo };
