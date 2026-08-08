/**
 * Team Leader site form → server-side stock OUT (office Stock Sheet).
 * Client-only deduct TL phone pe rehta tha; ab VPS erp_kv pe apply hota hai.
 */
import { getKey, setMany } from "./store.js";

const BALANCES_KEY = "dhatterwal_stock_balances";
const LEDGER_KEY = "dhatterwal_stock_ledger";
const PRODUCTS_KEY = "dhatterwal_product_catalog";

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function defaultUnit(category) {
  return String(category || "").toUpperCase() === "WIRE" ? "MTR" : "NOS";
}

function findProduct(products, line) {
  if (line?.productId) {
    const byId = products.find((p) => p.id === line.productId);
    if (byId) return byId;
  }
  const name = String(line?.itemName || "")
    .trim()
    .toLowerCase();
  if (!name) return null;
  return products.find((p) => String(p.itemName || "").trim().toLowerCase() === name) || null;
}

function resolveStockKey(products, line) {
  const matched = findProduct(products, line);
  if (matched?.id) return `pid:${matched.id}`;
  if (line?.productId) return `pid:${line.productId}`;
  const name = String(line?.itemName || "")
    .trim()
    .toLowerCase();
  return name ? `name:${name}` : null;
}

function hasSiteStockOut(ledger, reference) {
  const ref = String(reference || "").trim();
  if (!ref) return false;
  return ledger.some(
    (e) => e?.type === "site-out" && String(e.reference || "").trim() === ref,
  );
}

/**
 * @returns {{ ok: boolean, skipped?: boolean, updatedLines?: number, message?: string }}
 */
export async function applySiteFormStockOutOnServer({
  siteOrderId = "",
  consumerNo = "",
  stockLines = [],
} = {}) {
  const reference = `site-${String(siteOrderId || "").trim()}`;
  if (!reference || reference === "site-") {
    return { ok: false, message: "siteOrderId missing for stock out." };
  }

  const lines = Array.isArray(stockLines) ? stockLines : [];
  if (!lines.length) {
    return { ok: true, skipped: true, updatedLines: 0, message: "No stock lines." };
  }

  const [balRaw, ledRaw, prodRaw] = await Promise.all([
    getKey(BALANCES_KEY),
    getKey(LEDGER_KEY),
    getKey(PRODUCTS_KEY),
  ]);
  const balances = safeParse(balRaw, []);
  const ledger = safeParse(ledRaw, []);
  const products = safeParse(prodRaw, []);

  if (hasSiteStockOut(ledger, reference)) {
    return {
      ok: true,
      skipped: true,
      updatedLines: 0,
      message: "Stock pehle hi server pe deduct ho chuka hai.",
    };
  }

  const map = new Map(
    (Array.isArray(balances) ? balances : []).map((b) => [b.stockKey, { ...b }]),
  );
  const nextLedger = Array.isArray(ledger) ? [...ledger] : [];
  let updatedLines = 0;
  const shortages = [];

  for (const line of lines) {
    const qty = Number(line?.qty) || 0;
    const stockKey = resolveStockKey(products, line);
    if (!stockKey || qty <= 0) continue;

    const matched = findProduct(products, line);
    const nameNorm = String(line?.itemName || "")
      .trim()
      .toLowerCase();
    const nameKey = nameNorm ? `name:${nameNorm}` : null;

    let prev = map.get(stockKey);
    if (!prev && nameKey && nameKey !== stockKey) {
      prev = map.get(nameKey);
      if (prev) {
        map.delete(nameKey);
        prev = { ...prev, stockKey, productId: matched?.id || prev.productId };
      }
    }

    const balance = Number(prev?.balance) || 0;
    if (!prev || balance < qty) {
      shortages.push(
        `${line.itemName || stockKey} (balance ${balance}, chahiye ${qty})`,
      );
      continue;
    }

    prev.qtyOut = (Number(prev.qtyOut) || 0) + qty;
    prev.balance = balance - qty;
    prev.itemName = String(line.itemName || prev.itemName || "").trim();
    prev.category = line.category || matched?.category || prev.category || "";
    prev.hsn = line.hsn || matched?.hsn || prev.hsn || "";
    prev.productId = matched?.id || line.productId || prev.productId || "";
    prev.unit = line.unit || prev.unit || defaultUnit(prev.category);
    prev.updatedAt = new Date().toISOString();
    map.set(stockKey, prev);

    nextLedger.unshift({
      id: `stout-${Date.now()}-${updatedLines}`,
      type: "site-out",
      reference,
      siteOrderId: String(siteOrderId || "").trim(),
      consumerNo: String(consumerNo || "").trim().toUpperCase(),
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

  if (shortages.length && updatedLines === 0) {
    return {
      ok: false,
      updatedLines: 0,
      message: `Stock kam hai:\n${shortages.join("\n")}`,
    };
  }

  if (updatedLines === 0) {
    return { ok: false, updatedLines: 0, message: "Stock lines invalid / match nahi hua." };
  }

  await setMany({
    [BALANCES_KEY]: JSON.stringify([...map.values()]),
    [LEDGER_KEY]: JSON.stringify(nextLedger.slice(0, 2000)),
  });

  return {
    ok: true,
    updatedLines,
    partial: shortages.length > 0,
    message: shortages.length
      ? `Partial stock out. Shortage:\n${shortages.join("\n")}`
      : "",
  };
}
