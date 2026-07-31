import { erpGetItem, erpSetItem } from "./erpStorage";

const LOAN_KEY = "dhatterwal_loan_case_rows";
const CASH_KEY = "dhatterwal_cash_case_rows";
const BACKUP_KEY = "dhatterwal_backup_entries";

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

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

function readRows(key) {
  const parsed = safeParse(erpGetItem(key), null);
  return Array.isArray(parsed) ? parsed : [];
}

function writeRows(key, rows) {
  try {
    erpSetItem(key, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

function patchReferenceInList(list, consumerNo, reference) {
  const cn = normalizeConsumerNo(consumerNo);
  const ref = String(reference || "").trim();
  let changed = false;
  const next = list.map((row) => {
    if (normalizeConsumerNo(row.consumerNo) !== cn) return row;
    if (String(row.reference || "").trim() === ref) return row;
    changed = true;
    return { ...row, reference: ref };
  });
  return { next, changed };
}

/** Loan / Cash / Backup se consumer ka Reference nikaalo. */
export function getConsumerReference(consumerNo) {
  const cn = normalizeConsumerNo(consumerNo);
  if (!cn) return "";

  const loan = readRows(LOAN_KEY).find(
    (r) => !r.isBackupEntry && normalizeConsumerNo(r.consumerNo) === cn,
  );
  if (loan?.reference) return String(loan.reference).trim();

  const cash = readRows(CASH_KEY).find(
    (r) => !r.isBackupEntry && normalizeConsumerNo(r.consumerNo) === cn,
  );
  if (cash?.reference) return String(cash.reference).trim();

  const backup = readRows(BACKUP_KEY).find(
    (r) => normalizeConsumerNo(r.consumerNo) === cn,
  );
  if (backup?.reference) return String(backup.reference).trim();

  return "";
}

/**
 * Same Consumer No. par Loan + Cash (+ Backup) reference common rakho.
 * skip* = jis sheet se save aa raha hai usko dubara mat likho.
 */
export function setConsumerReference(
  consumerNo,
  reference,
  { skipLoan = false, skipCash = false } = {},
) {
  const cn = normalizeConsumerNo(consumerNo);
  if (!cn) return { changed: false };
  const ref = String(reference || "").trim();
  let changed = false;

  if (!skipLoan) {
    const loan = readRows(LOAN_KEY);
    const patched = patchReferenceInList(loan, cn, ref);
    if (patched.changed) {
      writeRows(LOAN_KEY, patched.next);
      changed = true;
    }
  }

  if (!skipCash) {
    const cash = readRows(CASH_KEY);
    const patched = patchReferenceInList(cash, cn, ref);
    if (patched.changed) {
      writeRows(CASH_KEY, patched.next);
      changed = true;
    }
  }

  const backup = readRows(BACKUP_KEY);
  const patchedBackup = patchReferenceInList(backup, cn, ref);
  if (patchedBackup.changed) {
    writeRows(BACKUP_KEY, patchedBackup.next);
    changed = true;
  }

  return { changed };
}

/** Loan ya Cash save ke baad dusri sheet me reference mirror karo. */
export function syncReferencesFromCaseRows(rows, source) {
  const skipLoan = source === "loan";
  const skipCash = source === "cash";
  const byConsumer = new Map();

  (rows || []).forEach((row) => {
    if (row?.isBackupEntry) return;
    const cn = normalizeConsumerNo(row.consumerNo);
    if (!cn) return;
    byConsumer.set(cn, String(row.reference || "").trim());
  });

  let any = false;
  byConsumer.forEach((ref, cn) => {
    const result = setConsumerReference(cn, ref, { skipLoan, skipCash });
    if (result.changed) any = true;
  });
  return { changed: any };
}

export function consumerMatchesReference(consumerNo, referenceFilter, storedReference = "") {
  const want = norm(referenceFilter);
  if (!want) return true;
  const ref = norm(storedReference || getConsumerReference(consumerNo));
  return ref === want;
}

/** Reference text se match — exact ya partial (search). */
export function rowMatchesReferenceSearch(consumerNo, storedReference, query) {
  const q = norm(query);
  if (!q) return true;
  const ref = norm(storedReference || getConsumerReference(consumerNo));
  return ref.includes(q);
}

export function countCustomersForReference(rows, referenceQuery) {
  const q = norm(referenceQuery);
  if (!q) return 0;
  return (rows || []).filter((row) => {
    const ref = norm(row.reference || getConsumerReference(row.consumerNo));
    return ref === q || ref.includes(q);
  }).length;
}
