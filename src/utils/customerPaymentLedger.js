import { parseAmountValue } from "../constants/customerDetail";
import { ensureCustomerDetailRow } from "./customerDetailStorage";

const STORAGE_KEY = "dhatterwal_customer_payment_ledger";

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

function readAll() {
  return safeParse(localStorage.getItem(STORAGE_KEY), []);
}

function writeAll(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export const PAYMENT_CATEGORIES = {
  NAME_LOAD: "name-load",
  SALE: "sale",
  RECEIVED_MANUAL: "received-manual",
  LOAN_CREDIT: "loan-credit",
  LOAN_MARGIN: "loan-margin",
};

export function addCustomerPayment(entry) {
  const key = normalizeConsumerNo(entry.consumerNo);
  if (!key || !(Number(entry.amount) > 0)) return null;

  const record = {
    id: entry.id || `pay-${Date.now()}`,
    consumerNo: key,
    date: entry.date || new Date().toLocaleDateString("en-GB"),
    amount: Number(entry.amount) || 0,
    category: entry.category || "name-load",
    label: entry.label || "",
    reference: entry.reference || "",
    applicationNo: entry.applicationNo || "",
    sourceRef: entry.sourceRef || "",
    createdAt: new Date().toISOString(),
  };

  const list = readAll();
  if (entry.sourceRef) {
    const idx = list.findIndex((p) => p.sourceRef === entry.sourceRef);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...record, id: list[idx].id };
      writeAll(list);
      ensureCustomerDetailRow(key);
      return list[idx];
    }
  }

  list.unshift(record);
  writeAll(list);
  ensureCustomerDetailRow(key);
  return record;
}

export function listCustomerPayments(consumerNo) {
  const key = normalizeConsumerNo(consumerNo);
  if (!key) return [];
  return readAll().filter((p) => normalizeConsumerNo(p.consumerNo) === key);
}

export function listAllPayments() {
  return readAll();
}

export function removePaymentBySourceRef(sourceRef) {
  if (!sourceRef) return;
  const list = readAll().filter((p) => p.sourceRef !== sourceRef);
  writeAll(list);
}

export function sumPaymentsByCategory(consumerNo, category) {
  return listCustomerPayments(consumerNo)
    .filter((p) => p.category === category)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

export function sumAllLedgerPayments(consumerNo) {
  return listCustomerPayments(consumerNo).reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0,
  );
}

export function computeGrandCustomerPayments(row) {
  const key = normalizeConsumerNo(row?.consumerNo);
  const manualReceived =
    parseAmountValue(row?.receivedAmount) + parseAmountValue(row?.secondReceivedAmount);
  const nameLoad = sumPaymentsByCategory(key, PAYMENT_CATEGORIES.NAME_LOAD);
  const sale = sumPaymentsByCategory(key, PAYMENT_CATEGORIES.SALE);
  const receivedManual = sumPaymentsByCategory(key, PAYMENT_CATEGORIES.RECEIVED_MANUAL);
  const grandTotal = manualReceived + nameLoad + sale + receivedManual;
  return { manualReceived, nameLoad, sale, receivedManual, grandTotal };
}

export const CUSTOMER_PAYMENT_SYNC_EVENT = "dhatterwal-customer-payment-sync";

export function notifyPaymentSync() {
  window.dispatchEvent(new Event(CUSTOMER_PAYMENT_SYNC_EVENT));
}
