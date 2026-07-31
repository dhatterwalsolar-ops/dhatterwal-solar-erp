import { syncAllLoanDisbursements } from "./loanDisbursementSync";
import { refreshSavedSaleRowsFromCaseSheets } from "./saleCaseSync";
import { erpGetItem, erpSetItem } from "./erpStorage";

const STORAGE_KEY = "dhatterwal_loan_case_rows";
export const LOAN_CASE_SYNC_EVENT = "dhatterwal-loan-case-sync";

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function loadLoanCaseRows() {
  const stored = safeParse(erpGetItem(STORAGE_KEY), null);
  return Array.isArray(stored) ? stored : [];
}

export function saveLoanCaseRows(rows) {
  const main = rows.filter((r) => !r.isBackupEntry);
  try {
    erpSetItem(STORAGE_KEY, JSON.stringify(main));
  } catch {
    /* ignore */
  }
  syncAllLoanDisbursements(main);
  window.dispatchEvent(new Event(LOAN_CASE_SYNC_EVENT));
  refreshSavedSaleRowsFromCaseSheets();
}
