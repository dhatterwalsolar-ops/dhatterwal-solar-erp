import { loadCashCaseRows } from "./cashCaseStorage";
import { loadLoanCaseRows } from "./loanCaseStorage";
import { listBackupEntries } from "./backupEntryStorage";

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

/** Loan / Cash / Backup se consumer ka Reference nikaalo. */
export function getConsumerReference(consumerNo) {
  const cn = String(consumerNo || "").trim().toUpperCase();
  if (!cn) return "";

  const loan = loadLoanCaseRows().find(
    (r) => String(r.consumerNo || "").trim().toUpperCase() === cn,
  );
  if (loan?.reference) return String(loan.reference).trim();

  const cash = loadCashCaseRows().find(
    (r) => String(r.consumerNo || "").trim().toUpperCase() === cn,
  );
  if (cash?.reference) return String(cash.reference).trim();

  const backup = listBackupEntries().find(
    (r) => String(r.consumerNo || "").trim().toUpperCase() === cn,
  );
  if (backup?.reference) return String(backup.reference).trim();

  return "";
}

export function consumerMatchesReference(consumerNo, referenceFilter) {
  const want = norm(referenceFilter);
  if (!want) return true;
  return norm(getConsumerReference(consumerNo)) === want;
}
