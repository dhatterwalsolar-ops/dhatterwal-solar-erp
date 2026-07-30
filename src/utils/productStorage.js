import { DEFAULT_PRODUCT_ITEMS } from "../constants/productSheet";
import { erpGetItem, erpRemoveItem, erpSetItem } from "./erpStorage";

const STORAGE_KEY = "dhatterwal_product_catalog";

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function seedIfEmpty() {
  const existing = safeParse(erpGetItem(STORAGE_KEY), null);
  if (Array.isArray(existing) && existing.length > 0) return existing;

  const seeded = DEFAULT_PRODUCT_ITEMS.map((row, index) => ({
    id: `prod-${index + 1}`,
    itemName: row.itemName,
    category: row.category,
    hsn: row.hsn,
    status: "Active",
    createdAt: new Date().toISOString(),
  }));
  erpSetItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

export function loadProducts() {
  return safeParse(erpGetItem(STORAGE_KEY), null) ?? seedIfEmpty();
}

export function saveProducts(list) {
  try {
    erpSetItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function upsertProduct(product) {
  const list = loadProducts();
  const idx = list.findIndex((p) => p.id === product.id);
  const next = {
    ...product,
    status: product.status || "Active",
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...next };
  } else {
    list.unshift({
      ...next,
      id: next.id || `prod-${Date.now()}`,
      createdAt: new Date().toISOString(),
    });
  }
  saveProducts(list);
  return next;
}

export function deleteProduct(id) {
  saveProducts(loadProducts().filter((p) => p.id !== id));
}

export function searchProducts(query, limit = 12) {
  const q = String(query || "").trim().toLowerCase();
  const all = loadProducts().filter((p) => p.status !== "Inactive");
  if (!q) return all.slice(0, limit);
  return all
    .filter(
      (p) =>
        p.itemName?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.hsn?.includes(q),
    )
    .slice(0, limit);
}

export function getProductById(id) {
  return loadProducts().find((p) => p.id === id) ?? null;
}

export function findProductByName(itemName) {
  const key = String(itemName || "").trim().toLowerCase();
  return loadProducts().find((p) => p.itemName?.toLowerCase() === key) ?? null;
}

/** Ensure a catalog row exists (e.g. Net Meter Single Phase). */
export function ensureProductItem({ itemName, category = "GENERAL", hsn = "" }) {
  const name = String(itemName || "").trim();
  if (!name) return null;
  const existing = findProductByName(name);
  if (existing) {
    if (hsn && !existing.hsn) {
      return upsertProduct({ ...existing, hsn });
    }
    return existing;
  }
  return upsertProduct({
    id: `prod-${Date.now()}`,
    itemName: name,
    category,
    hsn,
    status: "Active",
  });
}
