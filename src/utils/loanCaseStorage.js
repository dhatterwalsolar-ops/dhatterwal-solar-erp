import { LOAN_CASE_SAMPLE_ROWS } from "../constants/loanCase";
import { syncAllLoanDisbursements } from "./loanDisbursementSync";
import { refreshSavedSaleRowsFromCaseSheets } from "./saleCaseSync";

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
  const stored = safeParse(localStorage.getItem(STORAGE_KEY), null);
  if (Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  return LOAN_CASE_SAMPLE_ROWS.map((row) => ({ ...row }));
}

export function saveLoanCaseRows(rows) {
  const main = rows.filter((r) => !r.isBackupEntry);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(main));
  } catch {
    /* ignore */
  }
  syncAllLoanDisbursements(main);
  window.dispatchEvent(new Event(LOAN_CASE_SYNC_EVENT));
  refreshSavedSaleRowsFromCaseSheets();
}
