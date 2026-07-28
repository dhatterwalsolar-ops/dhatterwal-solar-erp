import { DEFAULT_SUPPLIERS } from "../constants/supplierRegistry";

const KEY = "dhatterwal_suppliers";

function readCustom() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCustom(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function getAllSuppliers() {
  const custom = readCustom();
  const byId = new Map(DEFAULT_SUPPLIERS.map((s) => [s.id, s]));
  custom.forEach((s) => byId.set(s.id, s));
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function searchSuppliers(query) {
  const q = String(query || "").trim().toLowerCase();
  const all = getAllSuppliers();
  if (!q) return all;
  return all.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.mobile?.includes(q) ||
      s.gstin?.toLowerCase().includes(q),
  );
}

export function findSupplierById(id) {
  return getAllSuppliers().find((s) => s.id === id) ?? null;
}

export function findSupplierByName(name) {
  const n = String(name || "").trim().toLowerCase();
  return getAllSuppliers().find((s) => s.name.toLowerCase() === n) ?? null;
}

export function addSupplier(entry) {
  const id = entry.id || `sup-custom-${Date.now()}`;
  const record = {
    id,
    name: entry.name.trim(),
    contactPerson: entry.contactPerson?.trim() || "",
    mobile: entry.mobile?.trim() || "",
    gstin: entry.gstin?.trim() || "",
    address: entry.address?.trim() || "",
  };
  const custom = readCustom().filter((s) => s.id !== id);
  custom.push(record);
  writeCustom(custom);
  return record;
}
