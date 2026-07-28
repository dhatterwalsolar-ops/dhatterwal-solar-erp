import { CASH_CASE_SAMPLE_ROWS } from "./cashCase";
import { LOAN_CASE_SAMPLE_ROWS } from "./loanCase";
import { getNameLoadOverride } from "../utils/updateNameLoadStorage";
import { findBackupByConsumerNo } from "../utils/backupEntryStorage";
import { loadLoanCaseRows } from "../utils/loanCaseStorage";
import { loadCashCaseRows } from "../utils/cashCaseStorage";

function normalizeConsumerNo(value) {
  return String(value || "").trim().toUpperCase();
}

function loanPaymentRemark(row) {
  const bank = row.bankName?.trim() || "—";
  const ifsc = row.bankIfsc?.trim() || "—";
  return `Bank: ${bank}, IFSC: ${ifsc}`;
}

function caseRowToCustomer(row) {
  return {
    consumerNo: row.consumerNo,
    customerName: row.customerName || "",
    fatherName: row.fatherName || "",
    address: row.address || "",
    setupKw: row.setupKw || "",
    mobile: row.mobile || "",
  };
}

/** Loan Case sheet (saved rows) — backup rows excluded. */
export function findLoanCaseRowByConsumerNo(consumerNo) {
  const key = normalizeConsumerNo(consumerNo);
  if (!key) return null;
  return (
    loadLoanCaseRows().find(
      (row) => !row.isBackupEntry && normalizeConsumerNo(row.consumerNo) === key,
    ) ?? null
  );
}

/** Cash Case sheet (saved rows) — backup rows excluded. */
export function findCashCaseRowByConsumerNo(consumerNo) {
  const key = normalizeConsumerNo(consumerNo);
  if (!key) return null;
  return (
    loadCashCaseRows().find(
      (row) => !row.isBackupEntry && normalizeConsumerNo(row.consumerNo) === key,
    ) ?? null
  );
}

/** Loan wins when the same Consumer No. exists in both sheets. */
export function findCaseRowByConsumerNo(consumerNo) {
  return findLoanCaseRowByConsumerNo(consumerNo) || findCashCaseRowByConsumerNo(consumerNo);
}

export function buildCustomerRegistry() {
  const registry = {};

  [...LOAN_CASE_SAMPLE_ROWS, ...CASH_CASE_SAMPLE_ROWS].forEach((row) => {
    const key = normalizeConsumerNo(row.consumerNo);
    if (!key) return;
    registry[key] = caseRowToCustomer(row);
  });

  return registry;
}

export const CUSTOMER_REGISTRY = buildCustomerRegistry();

export function getBaseCustomer(consumerNo) {
  const key = normalizeConsumerNo(consumerNo);
  if (!key) return null;

  const live = findCaseRowByConsumerNo(consumerNo);
  if (live) return caseRowToCustomer(live);

  return CUSTOMER_REGISTRY[key] ?? null;
}

export function lookupCustomer(consumerNo) {
  const key = normalizeConsumerNo(consumerNo);
  if (!key) return null;

  const backup = findBackupByConsumerNo(consumerNo);
  if (backup) {
    return {
      consumerNo: backup.consumerNo,
      customerName: backup.customerName,
      fatherName: backup.fatherName,
      address: backup.address,
      setupKw: backup.setupKw || "",
      mobile: backup.mobile || "",
      isBackupEntry: true,
    };
  }

  const base = getBaseCustomer(consumerNo);
  if (!base) return null;

  const override = getNameLoadOverride(key);
  if (!override) return base;

  return {
    ...base,
    customerName: override.customerName?.trim() || base.customerName,
    setupKw: override.setupKw?.trim() || base.setupKw,
  };
}

/** Loan Case entry wins if the same Consumer No. exists in both sheets. */
export function lookupCustomerDetailProfile(consumerNo) {
  const key = normalizeConsumerNo(consumerNo);
  if (!key) return null;

  const backup = findBackupByConsumerNo(consumerNo);
  if (backup) {
    return {
      consumerNo: backup.consumerNo,
      customerName: backup.customerName,
      fatherName: backup.fatherName || "",
      address: backup.address,
      mobile: backup.mobile || "",
      amountType: backup.caseType || backup.amountType || "Backup",
      defaultPaymentRemark: backup.receivedRemark || "",
    };
  }

  const loanRow = findLoanCaseRowByConsumerNo(consumerNo);
  if (loanRow) {
    const remark = loanPaymentRemark(loanRow);
    const live = lookupCustomer(consumerNo);
    return {
      consumerNo: loanRow.consumerNo,
      customerName: live?.customerName || loanRow.customerName,
      fatherName: live?.fatherName || loanRow.fatherName || "",
      address: live?.address || loanRow.address,
      mobile: live?.mobile || loanRow.mobile || "",
      amountType: "Loan",
      defaultPaymentRemark: remark,
    };
  }

  const cashRow = findCashCaseRowByConsumerNo(consumerNo);
  if (cashRow) {
    const live = lookupCustomer(consumerNo);
    return {
      consumerNo: cashRow.consumerNo,
      customerName: live?.customerName || cashRow.customerName,
      fatherName: live?.fatherName || cashRow.fatherName || "",
      address: live?.address || cashRow.address,
      mobile: live?.mobile || cashRow.mobile || "",
      amountType: "Cash",
      defaultPaymentRemark: "",
    };
  }

  return null;
}
