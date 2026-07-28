import { parseAmountValue } from "../constants/customerDetail";
import {
  addCustomerPayment,
  notifyPaymentSync,
  PAYMENT_CATEGORIES,
  removePaymentBySourceRef,
} from "./customerPaymentLedger";
import {
  ensureCustomerDetailRow,
  loadCustomerDetailRows,
  saveCustomerDetailRows,
} from "./customerDetailStorage";
import { syncCustomerDetailFromSaleSheet } from "./customerDetailSaleSync";

function normalizeConsumerNo(value) {
  return String(value || "").trim().toUpperCase();
}

function loanBankRemark(row) {
  const bank = row.bankName?.trim() || "";
  const ifsc = row.bankIfsc?.trim() || "";
  if (!bank && !ifsc) return "";
  return `Bank: ${bank || "—"}, IFSC: ${ifsc || "—"}`;
}

/** Loan sheet par credit / margin bharne par Customer Detail + payment history sync. */
export function syncLoanDisbursementFromLoanRow(row) {
  if (row?.isBackupEntry) return;

  const consumerNo = String(row?.consumerNo || "").trim();
  const key = normalizeConsumerNo(consumerNo);
  if (!key) return;

  const creditAmt = parseAmountValue(row.loanCreditAmount);
  const marginAmt = parseAmountValue(row.loanCreditMargin);
  const totalSanction = parseAmountValue(row.loanPayment) + parseAmountValue(row.marginMoney);

  syncCustomerDetailFromSaleSheet({ dispatchEvent: false });

  ensureCustomerDetailRow(consumerNo);

  const detailRows = loadCustomerDetailRows();
  const idx = detailRows.findIndex((r) => normalizeConsumerNo(r.consumerNo) === key);
  if (idx < 0) return;

  const bankRemark = loanBankRemark(row);
  const userRemark = String(row.loanCreditRemark || "").trim();
  const receivedRemark = [userRemark, bankRemark].filter(Boolean).join(" · ") || bankRemark;

  detailRows[idx] = {
    ...detailRows[idx],
    consumerNo: row.consumerNo,
    customerName: row.customerName || detailRows[idx].customerName,
    fatherName: row.fatherName || detailRows[idx].fatherName,
    address: row.address || detailRows[idx].address,
    mobile: row.mobile || detailRows[idx].mobile,
    amountType: "Loan",
    amount: totalSanction > 0 ? String(totalSanction) : detailRows[idx].amount,
    receivedAmount: creditAmt > 0 ? String(creditAmt) : detailRows[idx].receivedAmount,
    receivedDate: row.loanCreditDate || detailRows[idx].receivedDate,
    receivedRemark: creditAmt > 0 ? receivedRemark : detailRows[idx].receivedRemark,
    secondReceivedAmount:
      marginAmt > 0 ? String(marginAmt) : detailRows[idx].secondReceivedAmount,
    secondReceivedDate: row.loanCreditDate || detailRows[idx].secondReceivedDate,
    secondPaymentRemark:
      marginAmt > 0
        ? userRemark
          ? `Margin — ${userRemark}`
          : "Margin Money (Loan Case)"
        : detailRows[idx].secondPaymentRemark,
  };

  saveCustomerDetailRows(detailRows);

  if (creditAmt > 0) {
    addCustomerPayment({
      sourceRef: `loan-credit-${key}`,
      consumerNo,
      amount: creditAmt,
      date: row.loanCreditDate,
      category: PAYMENT_CATEGORIES.LOAN_CREDIT,
      label: "Loan Amount (Bank Credit)",
      reference: userRemark || bankRemark,
    });
  } else {
    removePaymentBySourceRef(`loan-credit-${key}`);
  }

  if (marginAmt > 0) {
    addCustomerPayment({
      sourceRef: `loan-margin-${key}`,
      consumerNo,
      amount: marginAmt,
      date: row.loanCreditDate,
      category: PAYMENT_CATEGORIES.LOAN_MARGIN,
      label: "Margin Money (Loan Case)",
      reference: userRemark,
    });
  } else {
    removePaymentBySourceRef(`loan-margin-${key}`);
  }

  notifyPaymentSync();
}

export function syncAllLoanDisbursements(rows) {
  if (!Array.isArray(rows)) return;
  rows.filter((r) => !r.isBackupEntry).forEach(syncLoanDisbursementFromLoanRow);
}
