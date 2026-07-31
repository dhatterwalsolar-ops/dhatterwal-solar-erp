import { CASH_CASE_SAMPLE_ROWS } from "../constants/cashCase";
import { LOAN_CASE_SAMPLE_ROWS } from "../constants/loanCase";
import { SALE_CASE_SAMPLE_ROWS } from "../constants/saleCase";
import { DEFAULT_LABOUR_EMPLOYEES } from "../constants/labourEmployees";
import { DEFAULT_PRODUCT_ITEMS } from "../constants/productSheet";
import { DEFAULT_SUPPLIERS } from "../constants/supplierRegistry";
import { loadCashCaseRows, saveCashCaseRows } from "./cashCaseStorage";
import { loadLoanCaseRows, saveLoanCaseRows } from "./loanCaseStorage";
import {
  DEMO_PURCHASE_IDS,
  loadPurchaseHistory,
  notifyPurchaseHistorySync,
} from "./purchaseHistoryStorage";
import {
  DEMO_PAYMENT_GIVEN_IDS,
  DEMO_PAYMENT_RECEIVED_IDS,
  listPaymentGiven,
  listPaymentReceived,
} from "./paymentManagementStorage";
import { loadSaleCaseRows, saveSaleCaseRows } from "./saleCaseStorage";
import { loadCustomerDetailRows, saveCustomerDetailRows } from "./customerDetailStorage";
import { loadProducts, saveProducts } from "./productStorage";
import { getLabourEmployees, saveLabourEmployees } from "./labourEmployeeStorage";
import { erpGetItem, erpSetItem } from "./erpStorage";
import { removePaymentBySourceRef } from "./customerPaymentLedger";

const PURGE_FLAG = "dhatterwal_demo_purged_v3";
const PURCHASE_HISTORY_KEY = "dhatterwal_purchase_history";
const PAYMENT_RECEIVED_KEY = "dhatterwal_payment_received";
const PAYMENT_GIVEN_KEY = "dhatterwal_payment_given";
const BOM_KEY = "dhatterwal_bom_sheet_files";
const SUPPLIERS_KEY = "dhatterwal_suppliers";

function normalizeConsumerNo(value) {
  return String(value || "").trim().toUpperCase();
}

function sampleConsumerSet() {
  const set = new Set();
  [...LOAN_CASE_SAMPLE_ROWS, ...CASH_CASE_SAMPLE_ROWS, ...SALE_CASE_SAMPLE_ROWS].forEach((row) => {
    const key = normalizeConsumerNo(row.consumerNo);
    if (key) set.add(key);
  });
  return set;
}

function seededProductNames() {
  return new Set(DEFAULT_PRODUCT_ITEMS.map((p) => String(p.itemName || "").trim().toLowerCase()));
}

function seededLabourIds() {
  return new Set(DEFAULT_LABOUR_EMPLOYEES.map((e) => e.id));
}

function seededSupplierIds() {
  return new Set(DEFAULT_SUPPLIERS.map((s) => s.id));
}

function purgeBomForConsumers(demoConsumers) {
  try {
    const raw = erpGetItem(BOM_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw);
    if (!map || typeof map !== "object") return false;
    let changed = false;
    Object.keys(map).forEach((key) => {
      if (demoConsumers.has(normalizeConsumerNo(key))) {
        delete map[key];
        changed = true;
      }
    });
    if (changed) erpSetItem(BOM_KEY, JSON.stringify(map));
    return changed;
  } catch {
    return false;
  }
}

/**
 * One-time: remove known demo/sample rows. Safe with real data —
 * only matches built-in sample consumers / seed ids.
 */
export function purgeDemoCaseDataOnce() {
  if (typeof window === "undefined") return { skipped: true };
  try {
    if (localStorage.getItem(PURGE_FLAG) === "1") {
      return { skipped: true, already: true };
    }
  } catch {
    /* continue */
  }

  const demoConsumers = sampleConsumerSet();
  let changed = false;

  const loan = loadLoanCaseRows();
  const nextLoan = loan.filter(
    (row) => row.isBackupEntry || !demoConsumers.has(normalizeConsumerNo(row.consumerNo)),
  );
  if (nextLoan.length !== loan.length) {
    saveLoanCaseRows(nextLoan);
    changed = true;
  }

  const cash = loadCashCaseRows();
  const nextCash = cash.filter(
    (row) => !demoConsumers.has(normalizeConsumerNo(row.consumerNo)),
  );
  if (nextCash.length !== cash.length) {
    saveCashCaseRows(nextCash);
    changed = true;
  }

  const sale = loadSaleCaseRows();
  const nextSale = sale.filter(
    (row) => !demoConsumers.has(normalizeConsumerNo(row.consumerNo)),
  );
  if (nextSale.length !== sale.length) {
    saveSaleCaseRows(nextSale);
    changed = true;
  }

  const customers = loadCustomerDetailRows();
  const nextCustomers = customers.filter(
    (row) => !demoConsumers.has(normalizeConsumerNo(row.consumerNo)),
  );
  if (nextCustomers.length !== customers.length) {
    saveCustomerDetailRows(nextCustomers);
    changed = true;
  }

  if (purgeBomForConsumers(demoConsumers)) changed = true;

  const purchases = loadPurchaseHistory();
  const demoIds = new Set(DEMO_PURCHASE_IDS);
  const nextPurchases = purchases.filter((p) => !demoIds.has(p.id));
  if (nextPurchases.length !== purchases.length) {
    erpSetItem(PURCHASE_HISTORY_KEY, JSON.stringify(nextPurchases));
    notifyPurchaseHistorySync();
    changed = true;
  }

  const received = listPaymentReceived();
  const demoRecv = new Set(DEMO_PAYMENT_RECEIVED_IDS);
  const nextReceived = received.filter((p) => !demoRecv.has(p.id));
  if (nextReceived.length !== received.length) {
    received
      .filter((p) => demoRecv.has(p.id))
      .forEach((p) => removePaymentBySourceRef(`received-${p.id}`));
    erpSetItem(PAYMENT_RECEIVED_KEY, JSON.stringify(nextReceived));
    changed = true;
  }

  const given = listPaymentGiven();
  const demoGiven = new Set(DEMO_PAYMENT_GIVEN_IDS);
  const nextGiven = given.filter((p) => !demoGiven.has(p.id));
  if (nextGiven.length !== given.length) {
    erpSetItem(PAYMENT_GIVEN_KEY, JSON.stringify(nextGiven));
    changed = true;
  }

  const products = loadProducts();
  const seedNames = seededProductNames();
  const nextProducts = products.filter((p) => {
    const id = String(p.id || "");
    if (/^prod-\d+$/.test(id)) return false;
    return !seedNames.has(String(p.itemName || "").trim().toLowerCase());
  });
  if (nextProducts.length !== products.length) {
    saveProducts(nextProducts);
    changed = true;
  }

  const labour = getLabourEmployees();
  const labourIds = seededLabourIds();
  const nextLabour = labour.filter((e) => !labourIds.has(e.id));
  if (nextLabour.length !== labour.length) {
    saveLabourEmployees(nextLabour);
    changed = true;
  }

  try {
    const raw = erpGetItem(SUPPLIERS_KEY);
    if (raw) {
      const custom = JSON.parse(raw);
      if (Array.isArray(custom)) {
        const ids = seededSupplierIds();
        const next = custom.filter((s) => !ids.has(s.id));
        if (next.length !== custom.length) {
          erpSetItem(SUPPLIERS_KEY, JSON.stringify(next));
          changed = true;
        }
      }
    }
  } catch {
    /* ignore */
  }

  try {
    localStorage.setItem(PURGE_FLAG, "1");
  } catch {
    /* ignore */
  }

  return { skipped: false, changed };
}
