import { syncReferencesFromCaseRows } from "./consumerReference";
import { refreshSavedSaleRowsFromCaseSheets } from "./saleCaseSync";
import { erpGetItem, erpSetItem } from "./erpStorage";

const STORAGE_KEY = "dhatterwal_cash_case_rows";
export const CASH_CASE_SYNC_EVENT = "dhatterwal-cash-case-sync";

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function loadCashCaseRows() {
  const stored = safeParse(erpGetItem(STORAGE_KEY), null);
  if (!Array.isArray(stored)) return [];
  return stored.filter((r) => !r.isBackupEntry);
}

export function saveCashCaseRows(rows) {
  const main = rows.filter((r) => !r.isBackupEntry);
  try {
    erpSetItem(STORAGE_KEY, JSON.stringify(main));
  } catch {
    /* ignore */
  }
  syncReferencesFromCaseRows(main, "cash");
  window.dispatchEvent(new Event(CASH_CASE_SYNC_EVENT));
  refreshSavedSaleRowsFromCaseSheets();
}
