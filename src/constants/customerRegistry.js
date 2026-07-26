import { CASH_CASE_SAMPLE_ROWS } from "./cashCase";
import { LOAN_CASE_SAMPLE_ROWS } from "./loanCase";

function normalizeConsumerNo(value) {
  return String(value || "").trim().toUpperCase();
}

function loanPaymentRemark(row) {
  const bank = row.bankName?.trim() || "—";
  const ifsc = row.bankIfsc?.trim() || "—";
  return `Bank: ${bank}, IFSC: ${ifsc}`;
}

export function buildCustomerRegistry() {
  const registry = {};

  [...LOAN_CASE_SAMPLE_ROWS, ...CASH_CASE_SAMPLE_ROWS].forEach((row) => {
    const key = normalizeConsumerNo(row.consumerNo);
    if (!key) return;
    registry[key] = {
      consumerNo: row.consumerNo,
      customerName: row.customerName,
      fatherName: row.fatherName,
      address: row.address,
      setupKw: row.setupKw,
    };
  });

  return registry;
}

export const CUSTOMER_REGISTRY = buildCustomerRegistry();

export function lookupCustomer(consumerNo) {
  return CUSTOMER_REGISTRY[normalizeConsumerNo(consumerNo)] ?? null;
}

/** Loan Case entry wins if the same Consumer No. exists in both sheets. */
export function lookupCustomerDetailProfile(consumerNo) {
  const key = normalizeConsumerNo(consumerNo);
  if (!key) return null;

  const loanRow = LOAN_CASE_SAMPLE_ROWS.find(
    (row) => normalizeConsumerNo(row.consumerNo) === key,
  );
  if (loanRow) {
    const remark = loanPaymentRemark(loanRow);
    return {
      consumerNo: loanRow.consumerNo,
      customerName: loanRow.customerName,
      address: loanRow.address,
      amountType: "Loan",
      defaultPaymentRemark: remark,
    };
  }

  const cashRow = CASH_CASE_SAMPLE_ROWS.find(
    (row) => normalizeConsumerNo(row.consumerNo) === key,
  );
  if (cashRow) {
    return {
      consumerNo: cashRow.consumerNo,
      customerName: cashRow.customerName,
      address: cashRow.address,
      amountType: "Cash",
      defaultPaymentRemark: "",
    };
  }

  return null;
}
