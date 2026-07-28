import { REFERRAL_COMMISSION_PERCENT, GIVEN_PENDING_SOURCES, isSelfReference } from "../constants/paymentGivenPending";
import { parseAmountValue } from "../constants/customerDetail";
import { computeEmployeeBalance } from "../constants/labourEmployeeForm";
import { loadCustomerDetailRows } from "./customerDetailStorage";
import { getLabourEmployees } from "./labourEmployeeStorage";
import { loadLoanCaseRows } from "./loanCaseStorage";
import { loadCashCaseRows } from "./cashCaseStorage";
import { loadSaleCaseRows } from "./saleCaseStorage";
import {
  listPaymentGiven,
} from "./paymentManagementStorage";
import { loadPurchaseHistory, normalizePurchaseInvoiceNo } from "./purchaseHistoryStorage";

function parseMoney(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return parseAmountValue(value);
}

function normalizePartyName(value) {
  return String(value || "").trim().toLowerCase();
}

function sumGivenToParty({ partyType, partyName, referenceNo = "" }) {
  const nameKey = normalizePartyName(partyName);
  const refKey = referenceNo ? normalizePurchaseInvoiceNo(referenceNo) : "";
  return listPaymentGiven()
    .filter((g) => {
      if (partyType && g.partyType !== partyType) return false;
      if (nameKey && normalizePartyName(g.partyName) !== nameKey) return false;
      if (refKey) {
        return normalizePurchaseInvoiceNo(g.referenceNo) === refKey;
      }
      return true;
    })
    .reduce((s, g) => s + (Number(g.amount) || 0), 0);
}

function isPurchaseCreditPending(purchase) {
  const mode = String(purchase.paymentMode || "Credit").toLowerCase();
  if (mode.includes("cash") || mode.includes("upi")) return false;
  return true;
}

function buildPurchaseGivenPendingRows() {
  const rows = [];
  for (const p of loadPurchaseHistory()) {
    const payable = Number(p.grandTotal ?? p.totalAmount) || 0;
    if (payable <= 0) continue;
    if (!isPurchaseCreditPending(p)) continue;

    const paid = sumGivenToParty({
      partyType: "Supplier",
      partyName: p.supplier,
      referenceNo: p.invoiceNo,
    });
    const pending = Math.max(0, payable - paid);
    if (pending <= 0) continue;

    rows.push({
      id: `pgp-pur-${p.id}`,
      source: GIVEN_PENDING_SOURCES.PURCHASE,
      partyType: "Supplier",
      partyName: p.supplier || "Supplier",
      referenceLabel: p.invoiceNo,
      invoiceOrRef: p.invoiceNo,
      date: p.invoiceDate || "",
      consumerNo: "",
      customerName: "",
      payable,
      paid,
      pending,
      detail: `${p.paymentMode || "Credit"} — Purchase bill`,
    });
  }
  return rows;
}

function buildLabourGivenPendingRows() {
  const rows = [];
  for (const emp of getLabourEmployees()) {
    if (emp.status === "Inactive") continue;
    const payable = computeEmployeeBalance(emp);
    if (payable <= 0) continue;

    const paid = sumGivenToParty({
      partyType: "Labour",
      partyName: emp.name,
    });
    const pending = Math.max(0, payable - paid);
    if (pending <= 0) continue;

    rows.push({
      id: `pgp-lab-${emp.id}`,
      source: GIVEN_PENDING_SOURCES.LABOUR,
      partyType: "Labour",
      partyName: emp.name,
      referenceLabel: emp.mobile || emp.role,
      invoiceOrRef: emp.role || "",
      date: "",
      consumerNo: "",
      customerName: "",
      payable,
      paid,
      pending,
      detail: emp.salaryType === "daily-wages" ? "Daily wages balance" : "Salary / wages balance",
    });
  }
  return rows;
}

function customerAmountByConsumerNo() {
  const map = new Map();
  loadCustomerDetailRows().forEach((row) => {
    const key = String(row.consumerNo || "").trim().toUpperCase();
    if (!key) return;
    map.set(key, parseMoney(row.amount));
  });
  loadSaleCaseRows().forEach((row) => {
    const key = String(row.consumerNo || "").trim().toUpperCase();
    if (!key) return;
    const amt = parseMoney(row.amount);
    if (amt > 0) map.set(key, amt);
  });
  return map;
}

function collectReferenceCases() {
  const cases = [];
  const push = (row, caseType) => {
    if (isSelfReference(row.reference)) return;
    const ref = String(row.reference || "").trim();
    if (!ref) return;
    cases.push({
      caseType,
      consumerNo: row.consumerNo,
      customerName: row.customerName,
      reference: ref,
      seva: row.seva || "",
      date: row.date || "",
      loanPayment: row.loanPayment,
    });
  };
  loadLoanCaseRows().filter((r) => !r.isBackupEntry).forEach((r) => push(r, "Loan"));
  loadCashCaseRows().filter((r) => !r.isBackupEntry).forEach((r) => push(r, "Cash"));
  return cases;
}

function buildReferenceCommissionPendingRows() {
  const amountByConsumer = customerAmountByConsumerNo();
  const rows = [];
  const seen = new Set();

  for (const c of collectReferenceCases()) {
    const dedupeKey = `${normalizePartyName(c.reference)}|${String(c.consumerNo).toUpperCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const cn = String(c.consumerNo || "").trim().toUpperCase();
    let base =
      (cn && amountByConsumer.get(cn)) ||
      parseMoney(c.loanPayment) ||
      0;
    if (base <= 0) base = 0;

    const payable = Math.round((base * REFERRAL_COMMISSION_PERCENT) / 100);
    if (payable <= 0) continue;

    const paid = sumGivenToParty({
      partyType: "Reference",
      partyName: c.reference,
      referenceNo: cn,
    });
    const pending = Math.max(0, payable - paid);
    if (pending <= 0) continue;

    rows.push({
      id: `pgp-ref-${dedupeKey}`,
      source: GIVEN_PENDING_SOURCES.REFERENCE,
      partyType: "Reference",
      partyName: c.reference,
      referenceLabel: cn || c.customerName,
      invoiceOrRef: `${c.caseType} · ${cn}`,
      date: c.date,
      consumerNo: c.consumerNo,
      customerName: c.customerName,
      payable,
      paid,
      pending,
      detail: `Commission ${REFERRAL_COMMISSION_PERCENT}% · Seva: ${c.seva || "—"}`,
    });
  }
  return rows;
}

export function listAllGivenPendingRows() {
  return [
    ...buildPurchaseGivenPendingRows(),
    ...buildLabourGivenPendingRows(),
    ...buildReferenceCommissionPendingRows(),
  ].sort((a, b) => b.pending - a.pending);
}

export function getAllTotalGivenPendingPayment() {
  const rows = listAllGivenPendingRows();
  const totalPending = rows.reduce((s, r) => s + r.pending, 0);
  const bySource = rows.reduce(
    (acc, r) => {
      acc[r.source] = (acc[r.source] || 0) + r.pending;
      return acc;
    },
    {},
  );
  return {
    totalPending,
    partyCount: rows.length,
    rows,
    bySource,
  };
}
