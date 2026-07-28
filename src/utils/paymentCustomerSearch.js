import { lookupCustomer, lookupCustomerDetailProfile } from "../constants/customerRegistry";
import { loadLoanCaseRows } from "./loanCaseStorage";
import { listBackupEntries } from "./backupEntryStorage";
import { loadCashCaseRows } from "./cashCaseStorage";

function normalizeConsumerNo(value) {
  return String(value || "").trim().toUpperCase();
}

export function listAllPaymentCustomers() {
  const byKey = new Map();

  [...loadLoanCaseRows(), ...loadCashCaseRows()].forEach((row) => {
    const key = normalizeConsumerNo(row.consumerNo);
    if (!key || byKey.has(key)) return;
    const live = lookupCustomer(row.consumerNo);
    const profile = lookupCustomerDetailProfile(row.consumerNo);
    byKey.set(key, {
      consumerNo: row.consumerNo,
      customerName: live?.customerName || row.customerName || "",
      fatherName: live?.fatherName || row.fatherName || profile?.fatherName || "",
      address: live?.address || row.address || "",
      mobile: live?.mobile || row.mobile || profile?.mobile || "",
    });
  });

  listBackupEntries().forEach((row) => {
    const key = normalizeConsumerNo(row.consumerNo);
    if (!key || byKey.has(key)) return;
    byKey.set(key, {
      consumerNo: row.consumerNo,
      customerName: row.customerName || "",
      fatherName: row.fatherName || "",
      address: row.address || "",
      mobile: row.mobile || "",
    });
  });

  return [...byKey.values()].sort((a, b) =>
    a.customerName.localeCompare(b.customerName, "en"),
  );
}

export function searchPaymentCustomers(query) {
  const q = String(query || "").trim().toLowerCase();
  const all = listAllPaymentCustomers();
  if (!q) return all.slice(0, 25);
  return all
    .filter(
      (c) =>
        c.consumerNo.toLowerCase().includes(q) ||
        c.customerName.toLowerCase().includes(q) ||
        c.fatherName.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.mobile.includes(q),
    )
    .slice(0, 25);
}
