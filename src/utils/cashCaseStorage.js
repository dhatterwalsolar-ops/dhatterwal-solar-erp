import { CASH_CASE_SAMPLE_ROWS } from "../constants/cashCase";
import { refreshSavedSaleRowsFromCaseSheets } from "./saleCaseSync";
import { erpGetItem, erpRemoveItem, erpSetItem } from "./erpStorage";

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
  if (Array.isArray(stored) && stored.length > 0) {
    return stored.filter((r) => !r.isBackupEntry);
  }
  return CASH_CASE_SAMPLE_ROWS.map((row) => ({ ...row }));
}

export function saveCashCaseRows(rows) {
  const main = rows.filter((r) => !r.isBackupEntry);
  try {
    erpSetItem(STORAGE_KEY, JSON.stringify(main));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(CASH_CASE_SYNC_EVENT));
  refreshSavedSaleRowsFromCaseSheets();
}
