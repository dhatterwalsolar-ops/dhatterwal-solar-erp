import { DEFAULT_PRODUCT_ITEMS } from "../constants/productSheet";

const STORAGE_KEY = "dhatterwal_product_catalog";

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function seedIfEmpty() {
  const existing = safeParse(localStorage.getItem(STORAGE_KEY), null);
  if (Array.isArray(existing) && existing.length > 0) return existing;

  const seeded = DEFAULT_PRODUCT_ITEMS.map((row, index) => ({
    id: `prod-${index + 1}`,
    itemName: row.itemName,
    category: row.category,
    hsn: row.hsn,
    status: "Active",
    createdAt: new Date().toISOString(),
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

export function loadProducts() {
  return safeParse(localStorage.getItem(STORAGE_KEY), null) ?? seedIfEmpty();
}

export function saveProducts(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
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
