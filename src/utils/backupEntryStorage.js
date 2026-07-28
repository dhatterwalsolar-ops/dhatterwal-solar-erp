import { BACKUP_ENTRY_SYNC_EVENT, createEmptyBackupEntry } from "../constants/backupEntry";

const STORAGE_KEY = "dhatterwal_backup_entries";

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readAll() {
  return safeParse(localStorage.getItem(STORAGE_KEY), []);
}

function writeAll(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function listBackupEntries() {
  return readAll();
}

export function getBackupEntryById(id) {
  return readAll().find((e) => e.id === id) ?? null;
}

export function upsertBackupEntry(partial) {
  if (!partial?.id) return null;
  const list = readAll();
  const idx = list.findIndex((e) => e.id === partial.id);
  const merged = {
    ...(idx >= 0 ? list[idx] : createEmptyBackupEntry({ id: partial.id })),
    ...partial,
    id: partial.id,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) list[idx] = merged;
  else list.unshift(merged);
  writeAll(list);
  notifyBackupEntrySync();
  return merged;
}

export function addBackupEntry(entry = {}) {
  const record = createEmptyBackupEntry(entry);
  const list = readAll();
  list.unshift(record);
  writeAll(list);
  notifyBackupEntrySync();
  return record;
}

export function deleteBackupEntry(id) {
  writeAll(readAll().filter((e) => e.id !== id));
  notifyBackupEntrySync();
}

export function notifyBackupEntrySync() {
  window.dispatchEvent(new Event(BACKUP_ENTRY_SYNC_EVENT));
}

export function normalizeConsumerNo(value) {
  return String(value || "").trim().toUpperCase();
}

export function findBackupByConsumerNo(consumerNo) {
  const key = normalizeConsumerNo(consumerNo);
  if (!key) return null;
  return readAll().find((e) => normalizeConsumerNo(e.consumerNo) === key) ?? null;
}

/** Map stored backup → sheet row (with flags). */
export function backupToLoanRow(entry) {
  return {
    date: entry.date || "",
    consumerNo: entry.consumerNo || "",
    customerName: entry.customerName || "",
    fatherName: entry.fatherName || "",
    address: entry.address || "",
    mobile: entry.mobile || "",
    setupKw: entry.setupKw || "",
    reference: entry.reference || "",
    seva: entry.seva || "",
    loanPayment: entry.loanPayment || "",
    marginMoney: entry.marginMoney || "",
    bankName: entry.bankName || "",
    bankIfsc: entry.bankIfsc || "",
    loanCreditAmount: entry.loanCreditAmount || "",
    loanCreditDate: entry.loanCreditDate || "",
    loanCreditMargin: entry.loanCreditMargin || "",
    loanCreditRemark: entry.loanCreditRemark || "",
    isBackupEntry: true,
    entryId: entry.id,
  };
}

export function backupToCashRow(entry) {
  return {
    date: entry.date || "",
    consumerNo: entry.consumerNo || "",
    customerName: entry.customerName || "",
    fatherName: entry.fatherName || "",
    address: entry.address || "",
    mobile: entry.mobile || "",
    setupKw: entry.setupKw || "",
    reference: entry.reference || "",
    seva: entry.seva || "",
    isBackupEntry: true,
    entryId: entry.id,
  };
}

export function backupToSaleRow(entry) {
  return {
    date: entry.date || "",
    consumerNo: entry.consumerNo || "",
    customerName: entry.customerName || "",
    fatherName: entry.fatherName || "",
    address: entry.address || "",
    mobile: entry.mobile || "",
    setupKw: entry.setupKw || "",
    teamWork: entry.teamWork || "",
    setupDetail: entry.setupDetail || "",
    amount: entry.amount || "",
    isBackupEntry: true,
    entryId: entry.id,
  };
}

export function backupToCustomerRow(entry) {
  return {
    consumerNo: entry.consumerNo || "",
    customerName: entry.customerName || "",
    fatherName: entry.fatherName || "",
    address: entry.address || "",
    mobile: entry.mobile || "",
    amount: entry.amount || "",
    amountType: entry.amountType || entry.caseType || "",
    receivedAmount: entry.receivedAmount || "",
    receivedDate: entry.receivedDate || "",
    receivedRemark: entry.receivedRemark || "",
    secondReceivedAmount: entry.secondReceivedAmount || "",
    secondReceivedDate: entry.secondReceivedDate || "",
    secondPaymentRemark: entry.secondPaymentRemark || "",
    isBackupEntry: true,
    entryId: entry.id,
  };
}

export function patchBackupFromLoanRow(row) {
  return {
    id: row.entryId,
    date: row.date,
    consumerNo: row.consumerNo,
    customerName: row.customerName,
    fatherName: row.fatherName,
    address: row.address,
    mobile: row.mobile,
    setupKw: row.setupKw,
    reference: row.reference,
    seva: row.seva,
    loanPayment: row.loanPayment,
    marginMoney: row.marginMoney,
    bankName: row.bankName,
    bankIfsc: row.bankIfsc,
    loanCreditAmount: row.loanCreditAmount,
    loanCreditDate: row.loanCreditDate,
    loanCreditMargin: row.loanCreditMargin,
    loanCreditRemark: row.loanCreditRemark,
    caseType: row.caseType || "Loan",
  };
}

export function patchBackupFromCashRow(row) {
  return {
    id: row.entryId,
    date: row.date,
    consumerNo: row.consumerNo,
    customerName: row.customerName,
    fatherName: row.fatherName,
    address: row.address,
    mobile: row.mobile,
    setupKw: row.setupKw,
    reference: row.reference,
    seva: row.seva,
    caseType: row.caseType || "Cash",
  };
}

export function patchBackupFromSaleRow(row) {
  return {
    id: row.entryId,
    date: row.date,
    consumerNo: row.consumerNo,
    customerName: row.customerName,
    fatherName: row.fatherName,
    address: row.address,
    mobile: row.mobile,
    setupKw: row.setupKw,
    teamWork: row.teamWork,
    setupDetail: row.setupDetail,
    amount: row.amount,
  };
}

export function patchBackupFromCustomerRow(row) {
  return {
    id: row.entryId,
    consumerNo: row.consumerNo,
    customerName: row.customerName,
    fatherName: row.fatherName,
    address: row.address,
    mobile: row.mobile,
    amount: row.amount,
    amountType: row.amountType,
    caseType: row.amountType,
    receivedAmount: row.receivedAmount,
    receivedDate: row.receivedDate,
    receivedRemark: row.receivedRemark,
    secondReceivedAmount: row.secondReceivedAmount,
    secondReceivedDate: row.secondReceivedDate,
    secondPaymentRemark: row.secondPaymentRemark,
  };
}

export function mergeLoanRowsWithBackup(mainRows) {
  const backups = listBackupEntries().map(backupToLoanRow);
  return [...mainRows.filter((r) => !r.isBackupEntry), ...backups];
}

export function mergeCashRowsWithBackup(mainRows) {
  const backups = listBackupEntries().map(backupToCashRow);
  return [...mainRows.filter((r) => !r.isBackupEntry), ...backups];
}

export function mergeSaleRowsWithBackup(mainRows) {
  const backups = listBackupEntries().map(backupToSaleRow);
  return [...mainRows.filter((r) => !r.isBackupEntry), ...backups];
}

export function mergeCustomerRowsWithBackup(mainRows) {
  const backups = listBackupEntries().map(backupToCustomerRow);
  return [...mainRows.filter((r) => !r.isBackupEntry), ...backups];
}
