import { findProductByName, loadProducts } from "./productStorage";
import { listPurchaseStockDetailRows } from "./stockStorage";

function normalizeSerial(value) {
  return String(value || "").trim().toUpperCase();
}

function parseSerialList(text) {
  return String(text || "")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function itemMatchesRow(stockRow, filter) {
  if (filter.productId && stockRow.productId === filter.productId) return true;
  if (filter.itemName) {
    const name = String(filter.itemName).trim().toLowerCase();
    if (String(stockRow.itemName || "").trim().toLowerCase() === name) return true;
  }
  if (filter.category) {
    return (
      String(stockRow.category || "").trim().toUpperCase() ===
      String(filter.category).trim().toUpperCase()
    );
  }
  return !filter.productId && !filter.itemName && !filter.category;
}

/** Serials purchased (ledger) minus already issued on site jobs. */
export function listAvailableSerials(filter = {}) {
  const issued = new Set();
  for (const row of listPurchaseStockDetailRows()) {
    if (row.type === "site-out" && row.serialNumbers) {
      parseSerialList(row.serialNumbers).forEach((s) => issued.add(normalizeSerial(s)));
    }
  }

  const pool = [];
  for (const row of listPurchaseStockDetailRows()) {
    if (row.type !== "purchase-in") continue;
    if (filter.productId || filter.itemName || filter.category) {
      if (!itemMatchesRow(row, filter)) continue;
    }
    for (const serial of parseSerialList(row.serialNumbers)) {
      const key = normalizeSerial(serial);
      if (issued.has(key)) continue;
      pool.push({
        serial,
        itemName: row.itemName,
        productId: row.productId || "",
        category: row.category || "",
      });
    }
  }

  const seen = new Set();
  return pool.filter((p) => {
    const k = normalizeSerial(p.serial);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function serialExistsInStock(serial, filter = {}) {
  const key = normalizeSerial(serial);
  if (!key) return false;
  return listAvailableSerials(filter).some((p) => normalizeSerial(p.serial) === key);
}

export function listStockProductsByCategory(category) {
  const cat = String(category || "").toUpperCase();
  return loadProducts().filter((p) => String(p.category || "").toUpperCase() === cat);
}

export function resolveProductForStockLine({ productId, itemName }) {
  if (productId) {
    return loadProducts().find((p) => p.id === productId) ?? null;
  }
  return findProductByName(itemName);
}
