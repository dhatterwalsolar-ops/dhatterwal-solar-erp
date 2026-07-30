import { PAYMENT_MODES } from "../constants/paymentManagement";
import {
  getOpeningBalanceForMode,
  loadPaymentAccounts,
} from "./paymentAccountStorage";
import {
  addCustomerPayment,
  computeGrandCustomerPayments,
  listAllPayments,
  notifyPaymentSync,
  PAYMENT_CATEGORIES,
  removePaymentBySourceRef,
} from "./customerPaymentLedger";
import { loadCustomerDetailRows } from "./customerDetailStorage";
import { listBackupEntries, backupToCustomerRow } from "./backupEntryStorage";
import { parseAmountValue } from "../constants/customerDetail";
import { erpGetItem, erpRemoveItem, erpSetItem } from "./erpStorage";

const RECEIVED_KEY = "dhatterwal_payment_received";
const GIVEN_KEY = "dhatterwal_payment_given";

export const PAYMENT_MGMT_SYNC_EVENT = "dhatterwal-payment-mgmt-sync";

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function formatPaymentDate(d = new Date()) {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function parsePaymentDate(dateStr) {
  const parts = String(dateStr || "").split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map(Number);
  if (!dd || !mm || !yyyy) return null;
  return new Date(yyyy, mm - 1, dd);
}

function isSameCalendarDay(dateStr, ref = new Date()) {
  const parsed = parsePaymentDate(dateStr);
  if (!parsed) return false;
  return (
    parsed.getDate() === ref.getDate() &&
    parsed.getMonth() === ref.getMonth() &&
    parsed.getFullYear() === ref.getFullYear()
  );
}

function isInMonth(dateStr, month, year) {
  const parsed = parsePaymentDate(dateStr);
  if (!parsed) return false;
  return parsed.getMonth() + 1 === Number(month) && parsed.getFullYear() === Number(year);
}

function readReceived() {
  return safeParse(erpGetItem(RECEIVED_KEY), []);
}

function writeReceived(list) {
  try {
    erpSetItem(RECEIVED_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function readGiven() {
  return safeParse(erpGetItem(GIVEN_KEY), []);
}

function writeGiven(list) {
  try {
    erpSetItem(GIVEN_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function notifyMgmtSync() {
  window.dispatchEvent(new Event(PAYMENT_MGMT_SYNC_EVENT));
  notifyPaymentSync();
}

function syncReceivedToLedger(record) {
  addCustomerPayment({
    id: `ledger-${record.id}`,
    sourceRef: `received-${record.id}`,
    consumerNo: record.consumerNo,
    date: record.date,
    amount: record.amount,
    category: PAYMENT_CATEGORIES.RECEIVED_MANUAL,
    label: record.paymentMode || "Received",
    reference: record.referenceNo || "",
    applicationNo: "",
  });
}

function seedIfEmpty() {
  if (readReceived().length > 0 || readGiven().length > 0) return;
  const today = formatPaymentDate();
  writeReceived([
    {
      id: "pr-seed-1",
      date: today,
      consumerNo: "CN-240701",
      customerName: "Ramesh Kumar",
      fatherName: "Suresh Kumar",
      address: "VPO Dhatterwal, Rohtak, Haryana",
      mobile: "9992891023",
      amount: 85000,
      paymentMode: "Cash",
      referenceNo: "RCPT-101",
      remarks: "Installment",
      createdAt: new Date().toISOString(),
    },
    {
      id: "pr-seed-2",
      date: today,
      consumerNo: "CN-C240701",
      customerName: "Amit Sharma",
      fatherName: "Rajesh Sharma",
      address: "Sector 14, Rohtak, Haryana",
      mobile: "9992891723",
      amount: 60000,
      paymentMode: "Online Sonu",
      referenceNo: "",
      remarks: "",
      createdAt: new Date().toISOString(),
    },
  ]);
  writeGiven([
    {
      id: "pg-seed-1",
      date: today,
      partyName: "Waaree Energies Ltd",
      partyType: "Supplier",
      amount: 120000,
      paymentMode: "Canara 7411",
      referenceNo: "NEFT-778",
      remarks: "Panel purchase",
      createdAt: new Date().toISOString(),
    },
    {
      id: "pg-seed-2",
      date: today,
      partyName: "Rajesh Team",
      partyType: "Labour",
      amount: 4800,
      paymentMode: "Cash",
      referenceNo: "",
      remarks: "Daily wages",
      createdAt: new Date().toISOString(),
    },
  ]);
  readReceived().forEach(syncReceivedToLedger);
}

export function ensurePaymentMgmtSeeded() {
  seedIfEmpty();
}

export function listPaymentReceived() {
  ensurePaymentMgmtSeeded();
  return readReceived();
}

export function listPaymentGiven() {
  ensurePaymentMgmtSeeded();
  return readGiven();
}

export function listReceivedForDate(dateStr = formatPaymentDate()) {
  return listPaymentReceived().filter((r) => r.date === dateStr);
}

export function listReceivedToday() {
  return listPaymentReceived().filter((r) => isSameCalendarDay(r.date));
}

export function listGivenToday() {
  return listPaymentGiven().filter((r) => isSameCalendarDay(r.date));
}

export function sumReceivedToday() {
  return listReceivedToday().reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

export function sumGivenToday() {
  return listGivenToday().reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

export function addPaymentReceived(entry) {
  const amount = Number(entry.amount) || 0;
  if (!(amount > 0) || !String(entry.consumerNo || "").trim()) return null;

  const record = {
    id: entry.id || `pr-${Date.now()}`,
    date: entry.date || formatPaymentDate(),
    consumerNo: String(entry.consumerNo).trim(),
    customerName: entry.customerName || "",
    fatherName: entry.fatherName || "",
    address: entry.address || "",
    mobile: entry.mobile || "",
    amount,
    paymentMode: entry.paymentMode || PAYMENT_MODES[0],
    referenceNo: entry.referenceNo || "",
    remarks: entry.remarks || "",
    createdAt: new Date().toISOString(),
  };

  const list = readReceived();
  list.unshift(record);
  writeReceived(list);
  syncReceivedToLedger(record);
  notifyMgmtSync();
  return record;
}

export function updatePaymentReceived(id, patch) {
  const list = readReceived();
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const updated = { ...list[idx], ...patch, id: list[idx].id };
  if (Number(updated.amount) <= 0) return null;
  list[idx] = updated;
  writeReceived(list);
  syncReceivedToLedger(updated);
  notifyMgmtSync();
  return updated;
}

export function deletePaymentReceived(id) {
  writeReceived(readReceived().filter((r) => r.id !== id));
  removePaymentBySourceRef(`received-${id}`);
  notifyMgmtSync();
}

export function addPaymentGiven(entry) {
  const amount = Number(entry.amount) || 0;
  if (!(amount > 0) || !String(entry.partyName || "").trim()) return null;

  const record = {
    id: entry.id || `pg-${Date.now()}`,
    date: entry.date || formatPaymentDate(),
    partyName: entry.partyName.trim(),
    partyType: entry.partyType || "Supplier",
    amount,
    paymentMode: entry.paymentMode || PAYMENT_MODES[0],
    referenceNo: entry.referenceNo || "",
    remarks: entry.remarks || "",
    fundingType: entry.fundingType || "account",
    creditFacilityId: entry.creditFacilityId || "",
    creditFacilityName: entry.creditFacilityName || "",
    createdAt: new Date().toISOString(),
  };

  const list = readGiven();
  list.unshift(record);
  writeGiven(list);
  notifyMgmtSync();
  return record;
}

export function updatePaymentGiven(id, patch) {
  const list = readGiven();
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const updated = { ...list[idx], ...patch, id: list[idx].id };
  list[idx] = updated;
  writeGiven(list);
  notifyMgmtSync();
  return updated;
}

export function deletePaymentGiven(id) {
  writeGiven(readGiven().filter((r) => r.id !== id));
  notifyMgmtSync();
}

export function computeAccountModeBalances() {
  const accounts = new Map();
  loadPaymentAccounts().forEach((acc) => {
    accounts.set(acc.name, {
      mode: acc.name,
      openingBalance: Number(acc.currentBalance) || 0,
      received: 0,
      given: 0,
    });
  });

  if (accounts.size === 0) {
    PAYMENT_MODES.forEach((m) => {
      accounts.set(m, { mode: m, openingBalance: 0, received: 0, given: 0 });
    });
  }

  listPaymentReceived().forEach((r) => {
    const mode = r.paymentMode || "Other";
    if (!accounts.has(mode)) {
      accounts.set(mode, {
        mode,
        openingBalance: getOpeningBalanceForMode(mode),
        received: 0,
        given: 0,
      });
    }
    accounts.get(mode).received += Number(r.amount) || 0;
  });

  listAllPayments()
    .filter((p) => p.category === PAYMENT_CATEGORIES.SALE || p.category === PAYMENT_CATEGORIES.NAME_LOAD)
    .forEach((p) => {
      const mode = p.label || "Other";
      if (!accounts.has(mode)) {
        accounts.set(mode, {
          mode,
          openingBalance: getOpeningBalanceForMode(mode),
          received: 0,
          given: 0,
        });
      }
      accounts.get(mode).received += Number(p.amount) || 0;
    });

  listPaymentGiven().forEach((g) => {
    if (g.fundingType === "credit") return;
    const mode = g.paymentMode || "Other";
    if (!accounts.has(mode)) {
      accounts.set(mode, {
        mode,
        openingBalance: getOpeningBalanceForMode(mode),
        received: 0,
        given: 0,
      });
    }
    accounts.get(mode).given += Number(g.amount) || 0;
  });

  return [...accounts.values()]
    .map((row) => {
      const balance = row.openingBalance + row.received - row.given;
      return {
        ...row,
        balance,
        status: balance >= 0 ? "Positive" : "Negative",
      };
    })
    .sort((a, b) => b.balance - a.balance);
}

export function getMonthlyPaymentTotals(month, year) {
  const receivedFromSheet = listPaymentReceived()
    .filter((r) => isInMonth(r.date, month, year))
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const receivedAuto = listAllPayments()
    .filter(
      (p) =>
        isInMonth(p.date, month, year) &&
        (p.category === PAYMENT_CATEGORIES.SALE || p.category === PAYMENT_CATEGORIES.NAME_LOAD),
    )
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const received = receivedFromSheet + receivedAuto;

  const given = listPaymentGiven()
    .filter((g) => isInMonth(g.date, month, year))
    .reduce((s, g) => s + (Number(g.amount) || 0), 0);

  return { received, given, net: received - given };
}

export function buildPendingSummary() {
  const rows = loadCustomerDetailRows();
  let totalPending = 0;
  let bucket03 = 0;
  let bucket36 = 0;
  let bucket6plus = 0;
  let count03 = 0;
  let count36 = 0;
  let count6plus = 0;

  const now = new Date();

  rows.forEach((row) => {
    const totalAmount = parseAmountValue(row.amount);
    const { grandTotal } = computeGrandCustomerPayments(row);
    const pending = Math.max(0, totalAmount - grandTotal);
    if (pending <= 0) return;

    totalPending += pending;

    const refDate =
      parsePaymentDate(row.receivedDate) ||
      parsePaymentDate(row.secondReceivedDate) ||
      now;
    const months =
      (now.getFullYear() - refDate.getFullYear()) * 12 +
      (now.getMonth() - refDate.getMonth());

    if (months <= 3) {
      bucket03 += pending;
      count03 += 1;
    } else if (months <= 6) {
      bucket36 += pending;
      count36 += 1;
    } else {
      bucket6plus += pending;
      count6plus += 1;
    }
  });

  return {
    totalPending,
    bucket03,
    bucket36,
    bucket6plus,
    counts: { bucket03: count03, bucket36: count36, bucket6plus: count6plus },
  };
}

function pendingDurationBucket(row, now = new Date()) {
  const refDate =
    parsePaymentDate(row.receivedDate) ||
    parsePaymentDate(row.secondReceivedDate) ||
    now;
  const months =
    (now.getFullYear() - refDate.getFullYear()) * 12 + (now.getMonth() - refDate.getMonth());
  if (months <= 3) return "0-3";
  if (months <= 6) return "3-6";
  return "6+";
}

/** Customer All Detail + backup — har party ki pending list. */
export function listAllCustomerPendingRows() {
  const main = loadCustomerDetailRows();
  const backupRows = listBackupEntries().map(backupToCustomerRow);
  const seen = new Set(
    main.map((r) => String(r.consumerNo || "").trim().toUpperCase()).filter(Boolean),
  );
  const merged = [
    ...main,
    ...backupRows.filter((b) => {
      const key = String(b.consumerNo || "").trim().toUpperCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  ];

  const now = new Date();
  const rows = [];

  merged.forEach((row) => {
    const totalAmount = parseAmountValue(row.amount);
    const { grandTotal } = computeGrandCustomerPayments(row);
    const pending = Math.max(0, totalAmount - grandTotal);
    if (pending <= 0) return;

    rows.push({
      consumerNo: row.consumerNo,
      customerName: row.customerName,
      fatherName: row.fatherName,
      mobile: row.mobile,
      amountType: row.amountType,
      totalAmount,
      grandTotal,
      pending,
      duration: pendingDurationBucket(row, now),
      isBackupEntry: Boolean(row.isBackupEntry),
    });
  });

  return rows.sort((a, b) => b.pending - a.pending);
}

export function getAllTotalPendingPayment() {
  const rows = listAllCustomerPendingRows();
  const totalPending = rows.reduce((s, r) => s + r.pending, 0);
  return { totalPending, partyCount: rows.length, rows };
}

export function listRecentPaymentTransactions(limit = 12) {
  const received = listPaymentReceived().map((r) => ({
    id: r.id,
    date: r.date,
    type: "Received",
    partyName: r.customerName,
    amount: r.amount,
    paymentMode: r.paymentMode,
    status: "Success",
    sortKey: r.createdAt,
  }));

  const given = listPaymentGiven().map((g) => ({
    id: g.id,
    date: g.date,
    type: "Given",
    partyName: g.partyName,
    amount: g.amount,
    paymentMode: g.paymentMode,
    status: "Success",
    sortKey: g.createdAt,
  }));

  const auto = listAllPayments()
    .filter((p) => p.category !== PAYMENT_CATEGORIES.RECEIVED_MANUAL)
    .map((p) => ({
    id: p.id,
    date: p.date,
    type: "Received",
    partyName: p.consumerNo,
    amount: p.amount,
    paymentMode: p.label || p.category,
    status: "Success",
    sortKey: p.createdAt,
  }));

  const seen = new Set();
  const merged = [...received, ...given, ...auto]
    .filter((t) => {
      const key = `${t.type}-${t.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(b.sortKey).localeCompare(String(a.sortKey)));

  return merged.slice(0, limit);
}

export function formatPaymentMoney(n) {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
