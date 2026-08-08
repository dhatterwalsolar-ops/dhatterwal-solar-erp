import { loadPurchaseDraft } from "./purchaseStorage";
import { findPurchaseHistoryByInvoiceNo, loadPurchaseHistory, normalizePurchaseInvoiceNo } from "./purchaseHistoryStorage";
import { loadProducts, findProductByName } from "./productStorage";
import { erpGetItem, erpRemoveItem, erpSetItem } from "./erpStorage";

const BALANCES_KEY = "dhatterwal_stock_balances";
const APPLIED_PURCHASES_KEY = "dhatterwal_stock_purchase_applied";
const LEDGER_KEY = "dhatterwal_stock_ledger";

export const STOCK_SYNC_EVENT = "dhatterwal-stock-sync";

const DEFAULT_WAREHOUSE = "Main Store";

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readBalances() {
  return safeParse(erpGetItem(BALANCES_KEY), []);
}

function writeBalances(list) {
  try {
    erpSetItem(BALANCES_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function readAppliedPurchaseInvoices() {
  return safeParse(erpGetItem(APPLIED_PURCHASES_KEY), []);
}

function writeAppliedPurchaseInvoices(list) {
  try {
    erpSetItem(APPLIED_PURCHASES_KEY, JSON.stringify(list.slice(0, 500)));
  } catch {
    /* ignore */
  }
}

function readLedger() {
  return safeParse(erpGetItem(LEDGER_KEY), []);
}

function writeLedger(list) {
  try {
    erpSetItem(LEDGER_KEY, JSON.stringify(list.slice(0, 2000)));
  } catch {
    /* ignore */
  }
}

function ledgerEntriesForInvoice(invKey) {
  return readLedger().filter(
    (e) => normalizePurchaseInvoiceNo(e.invoiceNo) === invKey,
  );
}

function mergeBalanceRecords(a, b) {
  if (!a && !b) return null;
  const left = a || {};
  const right = b || {};
  return {
    ...left,
    ...right,
    qtyIn: (Number(left.qtyIn) || 0) + (Number(right.qtyIn) || 0),
    qtyOut: (Number(left.qtyOut) || 0) + (Number(right.qtyOut) || 0),
    balance: (Number(left.balance) || 0) + (Number(right.balance) || 0),
    lastRate: Number(right.lastRate) || Number(left.lastRate) || 0,
  };
}

export function notifyStockSync() {
  window.dispatchEvent(new Event(STOCK_SYNC_EVENT));
}

export function resolvePurchaseLineStockKey(item) {
  if (item?.productId) return `pid:${item.productId}`;
  const matched = findProductByName(item?.itemName);
  if (matched?.id) return `pid:${matched.id}`;
  const name = String(item?.itemName || "").trim().toLowerCase();
  if (name) return `name:${name}`;
  return null;
}

function defaultUnitForCategory(category) {
  return String(category || "").toUpperCase() === "WIRE" ? "MTR" : "NOS";
}

export function getStockItemCode(row) {
  if (row.productId) {
    const suffix = String(row.productId).replace(/^prod-/i, "");
    return `ST-${suffix}`.toUpperCase();
  }
  const tail = String(row.stockKey || "")
    .replace(/^name:/, "")
    .slice(0, 8)
    .toUpperCase();
  return tail ? `ST-${tail}` : "ST-NEW";
}

/**
 * Purchase final save ke baad qty stock me add (invoice-wise ek hi baar).
 */
export function applyPurchaseStockIn({
  invoiceNo,
  invoiceDate = "",
  supplier = "",
  items = [],
}) {
  const invKey = normalizePurchaseInvoiceNo(invoiceNo);
  if (!invKey) {
    return { ok: false, reason: "missing_invoice", updatedLines: 0 };
  }

  let applied = readAppliedPurchaseInvoices();
  if (applied.includes(invKey)) {
    if (ledgerEntriesForInvoice(invKey).length > 0) {
      return { ok: true, skipped: true, updatedLines: 0 };
    }
    applied = applied.filter((k) => k !== invKey);
    writeAppliedPurchaseInvoices(applied);
  }

  const map = new Map(readBalances().map((b) => [b.stockKey, { ...b }]));
  const ledger = readLedger();
  let updatedLines = 0;

  for (const line of items) {
    const stockKey = resolvePurchaseLineStockKey(line);
    const qty = Number(line.qty) || 0;
    if (!stockKey || qty <= 0) continue;

    const matchedProduct = findProductByName(line.itemName);

    const prev =
      map.get(stockKey) ||
      {
        stockKey,
        productId: line.productId || matchedProduct?.id || "",
        itemName: line.itemName || matchedProduct?.itemName || "",
        category: line.category || matchedProduct?.category || "",
        hsn: line.hsn || matchedProduct?.hsn || "",
        unit: line.unit || defaultUnitForCategory(line.category || matchedProduct?.category),
        warehouse: DEFAULT_WAREHOUSE,
        qtyIn: 0,
        qtyOut: 0,
        balance: 0,
        lastRate: 0,
      };

    prev.qtyIn = (Number(prev.qtyIn) || 0) + qty;
    prev.balance = (Number(prev.balance) || 0) + qty;
    prev.lastRate = Number(line.rate) || prev.lastRate;
    prev.unit = line.unit || prev.unit;
    prev.itemName = line.itemName?.trim() || prev.itemName;
    prev.category = line.category || prev.category;
    prev.hsn = line.hsn || prev.hsn;
    prev.productId = line.productId || matchedProduct?.id || prev.productId;
    prev.updatedAt = new Date().toISOString();

    map.set(stockKey, prev);
    ledger.unshift({
      id: `stkin-${Date.now()}-${updatedLines}`,
      type: "purchase-in",
      invoiceNo: String(invoiceNo).trim(),
      invoiceDate,
      supplier,
      productId: prev.productId,
      itemName: prev.itemName,
      category: prev.category,
      hsn: prev.hsn,
      qty,
      unit: prev.unit,
      rate: Number(line.rate) || 0,
      serialNumbers: line.serialNumbers || "",
      createdAt: new Date().toISOString(),
    });
    updatedLines += 1;
  }

  if (updatedLines === 0) {
    return { ok: false, reason: "no_stock_lines", updatedLines: 0 };
  }

  writeBalances([...map.values()]);
  writeLedger(ledger);
  writeAppliedPurchaseInvoices([invKey, ...applied]);
  notifyStockSync();

  return { ok: true, updatedLines };
}

/** Purchase delete par is invoice ka stock qty reverse. */
export function reversePurchaseStockForInvoice(invoiceNo) {
  const invKey = normalizePurchaseInvoiceNo(invoiceNo);
  if (!invKey) return { ok: false, reversedLines: 0 };

  const removedEntries = ledgerEntriesForInvoice(invKey);
  writeLedger(
    readLedger().filter((e) => normalizePurchaseInvoiceNo(e.invoiceNo) !== invKey),
  );

  if (removedEntries.length) {
    const map = new Map(readBalances().map((b) => [b.stockKey, { ...b }]));
    for (const entry of removedEntries) {
      const stockKey = resolvePurchaseLineStockKey({
        productId: entry.productId,
        itemName: entry.itemName,
      });
      if (!stockKey || !map.has(stockKey)) continue;
      const prev = map.get(stockKey);
      const qty = Number(entry.qty) || 0;
      prev.qtyIn = Math.max(0, (Number(prev.qtyIn) || 0) - qty);
      prev.balance = Math.max(0, (Number(prev.balance) || 0) - qty);
      prev.updatedAt = new Date().toISOString();
      map.set(stockKey, prev);
    }
    writeBalances([...map.values()]);
  }

  writeAppliedPurchaseInvoices(readAppliedPurchaseInvoices().filter((k) => k !== invKey));
  notifyStockSync();
  return { ok: true, reversedLines: removedEntries.length };
}

function mapDraftLineItems(items) {
  return (items || []).map((row) => ({
    productId: row.productId || "",
    itemName: String(row.itemName || "").trim(),
    category: row.category || "",
    hsn: row.hsn || "",
    serialNumbers: row.serialNumbers || "",
    qty: Number(row.qty) || 0,
    unit: row.unit || "NOS",
    rate: Number(row.rate) || 0,
  }));
}

/** Saved purchases jinke record me items hain — unse stock (idempotent). */
export function syncStockFromPurchaseHistory() {
  let invoicesUpdated = 0;
  for (const rec of loadPurchaseHistory()) {
    if (!Array.isArray(rec.items) || rec.items.length === 0) continue;
    const result = applyPurchaseStockIn({
      invoiceNo: rec.invoiceNo,
      invoiceDate: rec.invoiceDate,
      supplier: rec.supplier,
      items: rec.items,
    });
    if (result.ok && result.updatedLines > 0) invoicesUpdated += 1;
  }
  return { invoicesUpdated };
}

/** Applied mark ho gaya lekin ledger/stock nahi bana — dubara try. */
export function repairPurchaseStockFromHistory() {
  let fixed = 0;
  for (const rec of loadPurchaseHistory()) {
    if (!Array.isArray(rec.items) || rec.items.length === 0) continue;
    const invKey = normalizePurchaseInvoiceNo(rec.invoiceNo);
    if (ledgerEntriesForInvoice(invKey).length > 0) continue;

    const applied = readAppliedPurchaseInvoices();
    if (applied.includes(invKey)) {
      writeAppliedPurchaseInvoices(applied.filter((k) => k !== invKey));
    }

    const result = applyPurchaseStockIn({
      invoiceNo: rec.invoiceNo,
      invoiceDate: rec.invoiceDate,
      supplier: rec.supplier,
      items: rec.items,
    });
    if (result.ok && result.updatedLines > 0) fixed += 1;
  }
  return { fixed };
}

/**
 * Agar purchase save ho chuka hai lekin purane code me stock nahi bana,
 * aur draft me wahi invoice + items hain — stock dubara apply karein.
 */
export function syncStockFromCurrentPurchaseDraft() {
  const draft = loadPurchaseDraft();
  const invoiceNo = draft?.party?.invoiceNo?.trim();
  if (!invoiceNo || !Array.isArray(draft?.items) || draft.items.length === 0) {
    return { ok: false, reason: "no_draft" };
  }
  if (!findPurchaseHistoryByInvoiceNo(invoiceNo)) {
    return { ok: false, reason: "purchase_not_saved" };
  }
  const saved = findPurchaseHistoryByInvoiceNo(invoiceNo);
  return applyPurchaseStockIn({
    invoiceNo,
    invoiceDate: saved?.invoiceDate || "",
    supplier: saved?.supplier || "",
    items: mapDraftLineItems(draft.items),
  });
}

export function listStockBalanceRecords() {
  return readBalances();
}

export function listStockSheetRows() {
  const products = loadProducts();
  const balanceByKey = new Map(readBalances().map((b) => [b.stockKey, b]));
  const rows = [];
  const seenKeys = new Set();
  const productNameKeys = new Set(
    products.map((p) => `name:${String(p.itemName || "").trim().toLowerCase()}`),
  );

  for (const product of products) {
    const stockKey = `pid:${product.id}`;
    const nameKey = `name:${String(product.itemName || "").trim().toLowerCase()}`;
    seenKeys.add(stockKey);
    seenKeys.add(nameKey);
    const merged = mergeBalanceRecords(balanceByKey.get(stockKey), balanceByKey.get(nameKey));
    rows.push({
      itemCode: getStockItemCode({ productId: product.id, stockKey }),
      itemName: product.itemName,
      category: product.category,
      hsn: product.hsn,
      warehouse: merged?.warehouse || DEFAULT_WAREHOUSE,
      qtyIn: merged?.qtyIn || 0,
      qtyOut: merged?.qtyOut || 0,
      balance: merged?.balance || 0,
      unit: merged?.unit || defaultUnitForCategory(product.category),
      lastRate: merged?.lastRate || 0,
    });
  }

  for (const b of readBalances()) {
    if (seenKeys.has(b.stockKey)) continue;
    if (productNameKeys.has(b.stockKey)) continue;
    rows.push({
      itemCode: getStockItemCode(b),
      itemName: b.itemName || "—",
      category: b.category || "",
      hsn: b.hsn || "",
      warehouse: b.warehouse || DEFAULT_WAREHOUSE,
      qtyIn: b.qtyIn || 0,
      qtyOut: b.qtyOut || 0,
      balance: b.balance || 0,
      unit: b.unit || "NOS",
      lastRate: b.lastRate || 0,
    });
  }

  return rows.sort((a, b) => String(a.itemName).localeCompare(String(b.itemName)));
}

export function listPurchaseStockDetailRows() {
  const ledger = readLedger();
  if (ledger.length) {
    return [...ledger].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  const applied = new Set(readAppliedPurchaseInvoices());
  const rows = [];
  for (const rec of loadPurchaseHistory()) {
    if (!Array.isArray(rec.items) || rec.items.length === 0) continue;
    const invKey = normalizePurchaseInvoiceNo(rec.invoiceNo);
    rec.items.forEach((line, idx) => {
      rows.push({
        id: `${rec.id}-line-${idx}`,
        type: "purchase-in",
        invoiceNo: rec.invoiceNo,
        invoiceDate: rec.invoiceDate,
        supplier: rec.supplier,
        itemName: line.itemName || "—",
        category: line.category || "",
        qty: Number(line.qty) || 0,
        unit: line.unit || "NOS",
        rate: Number(line.rate) || 0,
        serialNumbers: line.serialNumbers || "",
        stockSynced: applied.has(invKey),
        createdAt: rec.savedAt || "",
      });
    });
  }
  return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/**
 * Site installation / labour form — stock issue (qtyOut).
 */
export function hasSiteStockOut(reference) {
  const ref = String(reference || "").trim();
  if (!ref) return false;
  return readLedger().some(
    (e) => e?.type === "site-out" && String(e.reference || "").trim() === ref,
  );
}

export function applyStockOut({
  reference = "",
  consumerNo = "",
  siteOrderId = "",
  lines = [],
}) {
  const map = new Map(readBalances().map((b) => [b.stockKey, { ...b }]));
  const ledger = readLedger();
  let updatedLines = 0;

  for (const line of lines) {
    const stockKey = resolvePurchaseLineStockKey(line);
    const qty = Number(line.qty) || 0;
    if (!stockKey || qty <= 0) continue;

    const prev = map.get(stockKey);
    const balance = Number(prev?.balance) || 0;
    if (!prev || balance < qty) {
      return {
        ok: false,
        reason: "insufficient",
        message: `Stock kam hai: ${line.itemName || stockKey} (balance ${balance}, chahiye ${qty})`,
      };
    }

    prev.qtyOut = (Number(prev.qtyOut) || 0) + qty;
    prev.balance = balance - qty;
    prev.updatedAt = new Date().toISOString();
    map.set(stockKey, prev);

    ledger.unshift({
      id: `stout-${Date.now()}-${updatedLines}`,
      type: "site-out",
      reference,
      siteOrderId,
      consumerNo: String(consumerNo || "").trim(),
      productId: prev.productId,
      itemName: prev.itemName || line.itemName,
      category: prev.category || line.category,
      hsn: prev.hsn || "",
      qty,
      unit: line.unit || prev.unit || "NOS",
      serialNumbers: line.serialNumbers || "",
      createdAt: new Date().toISOString(),
    });
    updatedLines += 1;
  }

  if (updatedLines === 0) {
    return { ok: false, reason: "no_lines", message: "Stock lines invalid." };
  }

  writeBalances([...map.values()]);
  writeLedger(ledger);
  notifyStockSync();
  return { ok: true, updatedLines };
}

/** Product Sheet — current balance + last rate preview. */
export function getProductStockPreview({ productId = "", itemName = "" } = {}) {
  const pid = String(productId || "").trim();
  const name = String(itemName || "").trim();
  const stockKey = pid
    ? `pid:${pid}`
    : name
      ? `name:${name.toLowerCase()}`
      : null;
  if (!stockKey) {
    return { balance: 0, lastRate: 0, qtyIn: 0, qtyOut: 0 };
  }
  const nameKey = name ? `name:${name.toLowerCase()}` : null;
  const balances = readBalances();
  const byPid = pid ? balances.find((b) => b.stockKey === `pid:${pid}`) : null;
  const byName = nameKey ? balances.find((b) => b.stockKey === nameKey) : null;
  const merged = mergeBalanceRecords(byPid, byName);
  return {
    balance: Number(merged?.balance) || 0,
    lastRate: Number(merged?.lastRate) || 0,
    qtyIn: Number(merged?.qtyIn) || 0,
    qtyOut: Number(merged?.qtyOut) || 0,
  };
}

/**
 * Product Sheet se aaj ka stock add (opening / manual in).
 * qty > 0 pe balance + qtyIn badhega; rate lastRate pe set.
 */
export function applyManualStockIn({
  productId = "",
  itemName = "",
  category = "",
  hsn = "",
  qty = 0,
  rate = 0,
  unit = "",
  note = "Product Sheet",
} = {}) {
  const qtyNum = Number(qty) || 0;
  if (qtyNum <= 0) {
    return { ok: true, skipped: true, updatedLines: 0, balance: 0 };
  }
  const name = String(itemName || "").trim();
  if (!name && !productId) {
    return { ok: false, reason: "missing_item", updatedLines: 0 };
  }

  const matched = productId
    ? loadProducts().find((p) => p.id === productId) || findProductByName(name)
    : findProductByName(name);
  const stockKey = matched?.id
    ? `pid:${matched.id}`
    : productId
      ? `pid:${productId}`
      : `name:${name.toLowerCase()}`;

  const map = new Map(readBalances().map((b) => [b.stockKey, { ...b }]));
  const prev =
    map.get(stockKey) ||
    {
      stockKey,
      productId: matched?.id || productId || "",
      itemName: name || matched?.itemName || "",
      category: category || matched?.category || "",
      hsn: hsn || matched?.hsn || "",
      unit: unit || defaultUnitForCategory(category || matched?.category),
      warehouse: DEFAULT_WAREHOUSE,
      qtyIn: 0,
      qtyOut: 0,
      balance: 0,
      lastRate: 0,
    };

  prev.qtyIn = (Number(prev.qtyIn) || 0) + qtyNum;
  prev.balance = (Number(prev.balance) || 0) + qtyNum;
  if (Number(rate) > 0) prev.lastRate = Number(rate);
  prev.itemName = name || prev.itemName;
  prev.category = category || prev.category;
  prev.hsn = hsn || prev.hsn;
  prev.productId = matched?.id || productId || prev.productId;
  prev.unit = unit || prev.unit || defaultUnitForCategory(prev.category);
  prev.updatedAt = new Date().toISOString();
  map.set(stockKey, prev);

  const ledger = readLedger();
  ledger.unshift({
    id: `stkman-${Date.now()}`,
    type: "manual-in",
    note: String(note || "Product Sheet").trim(),
    productId: prev.productId,
    itemName: prev.itemName,
    category: prev.category,
    hsn: prev.hsn,
    qty: qtyNum,
    unit: prev.unit,
    rate: Number(rate) || 0,
    createdAt: new Date().toISOString(),
  });

  writeBalances([...map.values()]);
  writeLedger(ledger);
  notifyStockSync();
  return {
    ok: true,
    updatedLines: 1,
    balance: Number(prev.balance) || 0,
    stockKey,
  };
}
