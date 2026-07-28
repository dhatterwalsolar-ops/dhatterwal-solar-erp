import {
  CREDIT_FACILITY_SYNC_EVENT,
  createEmptyCreditFacility,
} from "../constants/creditFacility";
import { addPaymentGiven, formatPaymentDate } from "./paymentManagementStorage";

const FACILITIES_KEY = "dhatterwal_credit_facilities";
const TXN_KEY = "dhatterwal_credit_facility_txns";

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readFacilities() {
  return safeParse(localStorage.getItem(FACILITIES_KEY), []);
}

function writeFacilities(list) {
  try {
    localStorage.setItem(FACILITIES_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  notifyCreditSync();
}

function readTxns() {
  return safeParse(localStorage.getItem(TXN_KEY), []);
}

function writeTxns(list) {
  try {
    localStorage.setItem(TXN_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  notifyCreditSync();
}

export function notifyCreditSync() {
  window.dispatchEvent(new Event(CREDIT_FACILITY_SYNC_EVENT));
}

export function listCreditFacilities() {
  return readFacilities();
}

export function getCreditFacility(id) {
  return readFacilities().find((f) => f.id === id) ?? null;
}

export function upsertCreditFacility(partial) {
  if (!partial?.id) return null;
  const list = readFacilities();
  const idx = list.findIndex((f) => f.id === partial.id);
  const merged = {
    ...(idx >= 0 ? list[idx] : createEmptyCreditFacility()),
    ...partial,
    id: partial.id,
    limitAmount: Number(partial.limitAmount) || 0,
    usedAmount: Number(partial.usedAmount) || 0,
    billDueAmount: Number(partial.billDueAmount) || 0,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) list[idx] = merged;
  else list.unshift(merged);
  writeFacilities(list);
  return merged;
}

export function deleteCreditFacility(id) {
  writeFacilities(readFacilities().filter((f) => f.id !== id));
  writeTxns(readTxns().filter((t) => t.facilityId !== id));
}

export function availableCredit(facility) {
  const limit = Number(facility?.limitAmount) || 0;
  const used = Number(facility?.usedAmount) || 0;
  return Math.max(0, limit - used);
}

function appendTxn(entry) {
  const list = readTxns();
  list.unshift({
    id: entry.id || `cft-${Date.now()}`,
    ...entry,
    createdAt: new Date().toISOString(),
  });
  writeTxns(list.slice(0, 200));
}

export function recordCreditUsage({
  facilityId,
  amount,
  date,
  partyName,
  partyType,
  referenceNo,
  remarks,
}) {
  const amt = Number(amount) || 0;
  if (!(amt > 0)) return { ok: false, message: "Amount invalid." };

  const list = readFacilities();
  const idx = list.findIndex((f) => f.id === facilityId);
  if (idx < 0) return { ok: false, message: "Credit facility not found." };

  const facility = list[idx];
  const avail = availableCredit(facility);
  if (amt > avail) {
    return { ok: false, message: `Limit kam hai. Available: ₹${avail.toLocaleString("en-IN")}` };
  }

  list[idx] = {
    ...facility,
    usedAmount: (Number(facility.usedAmount) || 0) + amt,
    updatedAt: new Date().toISOString(),
  };
  writeFacilities(list);

  appendTxn({
    facilityId,
    facilityName: facility.name,
    type: "usage",
    amount: amt,
    date: date || formatPaymentDate(),
    partyName: partyName || "",
    partyType: partyType || "",
    referenceNo: referenceNo || "",
    remarks: remarks || "",
  });

  return { ok: true, facility: list[idx] };
}

export function payCreditBill({
  facilityId,
  amount,
  date,
  payFromAccount,
  referenceNo,
  remarks,
}) {
  const amt = Number(amount) || 0;
  if (!(amt > 0)) return { ok: false, message: "Amount invalid." };
  if (!payFromAccount?.trim()) return { ok: false, message: "Pay from account select karein." };

  const list = readFacilities();
  const idx = list.findIndex((f) => f.id === facilityId);
  if (idx < 0) return { ok: false, message: "Credit facility not found." };

  const facility = list[idx];
  const used = Number(facility.usedAmount) || 0;
  const pay = Math.min(amt, used);
  if (pay <= 0) return { ok: false, message: "Koi outstanding use nahi hai is facility par." };

  list[idx] = {
    ...facility,
    usedAmount: used - pay,
    billDueAmount: Math.max(0, (Number(facility.billDueAmount) || 0) - pay),
    updatedAt: new Date().toISOString(),
  };
  writeFacilities(list);

  appendTxn({
    facilityId,
    facilityName: facility.name,
    type: "bill-payment",
    amount: pay,
    date: date || formatPaymentDate(),
    payFromAccount,
    referenceNo: referenceNo || "",
    remarks: remarks || "",
  });

  addPaymentGiven({
    date: date || formatPaymentDate(),
    partyName: `${facility.name} — Bill / Limit Payment`,
    partyType: "Credit Settlement",
    amount: pay,
    paymentMode: payFromAccount,
    referenceNo: referenceNo || "",
    remarks: remarks || `Credit bill paid for ${facility.name}`,
    fundingType: "account",
  });

  return { ok: true, facility: list[idx], paid: pay };
}

export function listCreditTransactions(limit = 30) {
  return readTxns().slice(0, limit);
}

export function creditFacilityPaymentLabel(facility) {
  if (!facility) return "Credit";
  const prefix = facility.type === "credit-card" ? "CC" : "Limit";
  return `${prefix}: ${facility.name}`;
}
