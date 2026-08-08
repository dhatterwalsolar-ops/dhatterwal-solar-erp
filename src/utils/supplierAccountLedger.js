import { listPaymentGiven } from "./paymentManagementStorage";
import { loadPurchaseHistory } from "./purchaseHistoryStorage";
import { sumGivenToParty } from "./paymentGivenPendingStorage";
import { getAllSuppliers, searchSuppliers } from "./supplierStorage";

function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function isCashOrUpiMode(paymentMode) {
  const mode = String(paymentMode || "").toLowerCase();
  return mode.includes("cash") || mode.includes("upi");
}

function purchaseAmount(row) {
  return money(row.grandTotal ?? row.totalAmount);
}

function listPurchasesForSupplier(supplierName) {
  const key = normalizeName(supplierName);
  if (!key) return [];
  return loadPurchaseHistory()
    .filter((p) => normalizeName(p.supplier) === key)
    .sort((a, b) => String(b.invoiceDate || "").localeCompare(String(a.invoiceDate || "")));
}

function listPaymentsForSupplier(supplierName) {
  const key = normalizeName(supplierName);
  if (!key) return [];
  return listPaymentGiven()
    .filter(
      (g) =>
        String(g.partyType || "") === "Supplier" && normalizeName(g.partyName) === key,
    )
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

/** Unique supplier names from registry + purchases + payment given. */
export function listSupplierLedgerNames() {
  const map = new Map();
  for (const s of getAllSuppliers()) {
    const name = String(s.name || "").trim();
    if (!name) continue;
    map.set(normalizeName(name), name);
  }
  for (const p of loadPurchaseHistory()) {
    const name = String(p.supplier || "").trim();
    if (!name) continue;
    const key = normalizeName(name);
    if (!map.has(key)) map.set(key, name);
  }
  for (const g of listPaymentGiven()) {
    if (String(g.partyType || "") !== "Supplier") continue;
    const name = String(g.partyName || "").trim();
    if (!name) continue;
    const key = normalizeName(name);
    if (!map.has(key)) map.set(key, name);
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function searchSupplierLedgerNames(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return listSupplierLedgerNames();
  const fromRegistry = searchSuppliers(q).map((s) => s.name);
  const all = listSupplierLedgerNames().filter((name) => name.toLowerCase().includes(q));
  const map = new Map();
  for (const name of [...fromRegistry, ...all]) {
    const n = String(name || "").trim();
    if (!n) continue;
    map.set(normalizeName(n), n);
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/**
 * One supplier account: total saman liya, payment di, cash/UPI settled, balance.
 */
export function buildSupplierAccountLedger(supplierName) {
  const name = String(supplierName || "").trim();
  const purchases = listPurchasesForSupplier(name);
  const payments = listPaymentsForSupplier(name);

  let totalPurchase = 0;
  let cashUpiSettled = 0;
  for (const p of purchases) {
    const amt = purchaseAmount(p);
    totalPurchase += amt;
    if (isCashOrUpiMode(p.paymentMode)) cashUpiSettled += amt;
  }
  totalPurchase = money(totalPurchase);
  cashUpiSettled = money(cashUpiSettled);

  const paymentGiven = money(
    sumGivenToParty({ partyType: "Supplier", partyName: name }),
  );
  const totalPaid = money(paymentGiven + cashUpiSettled);
  const balance = money(totalPurchase - totalPaid);

  return {
    supplierName: name,
    purchases: purchases.map((p) => ({
      id: p.id,
      invoiceNo: p.invoiceNo || "",
      invoiceDate: p.invoiceDate || "",
      paymentMode: p.paymentMode || "",
      amount: purchaseAmount(p),
      settledAtPurchase: isCashOrUpiMode(p.paymentMode),
    })),
    payments: payments.map((g) => ({
      id: g.id,
      date: g.date || "",
      amount: money(g.amount),
      paymentMode: g.paymentMode || "",
      referenceNo: g.referenceNo || "",
      remarks: g.remarks || "",
    })),
    totals: {
      billCount: purchases.length,
      paymentCount: payments.length,
      totalPurchase,
      paymentGiven,
      cashUpiSettled,
      totalPaid,
      balance,
    },
  };
}

/** Overview rows for all suppliers (optional filter query). */
export function buildAllSupplierAccountSummary(query = "") {
  const names = searchSupplierLedgerNames(query);
  return names
    .map((name) => {
      const ledger = buildSupplierAccountLedger(name);
      return {
        supplierName: name,
        billCount: ledger.totals.billCount,
        paymentCount: ledger.totals.paymentCount,
        totalPurchase: ledger.totals.totalPurchase,
        totalPaid: ledger.totals.totalPaid,
        balance: ledger.totals.balance,
      };
    })
    .filter((row) => row.billCount > 0 || row.paymentCount > 0 || row.totalPaid > 0)
    .sort((a, b) => b.balance - a.balance || a.supplierName.localeCompare(b.supplierName));
}

export function formatLedgerMoney(n) {
  return `₹ ${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
