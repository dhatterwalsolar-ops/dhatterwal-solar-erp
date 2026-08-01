import { DEFAULT_PRODUCT_ITEMS } from "../constants/productSheet";
import { loadProducts } from "./productStorage";
import { listStockSheetRows } from "./stockStorage";

function matchCategory(rowCat, want) {
  const c = String(rowCat || "").trim().toUpperCase();
  const w = String(want || "").trim().toUpperCase();
  if (!w) return true;
  if (c === w) return true;
  if (w === "AC BOX") {
    if (c.includes("AC") && (c.includes("BOX") || c.includes("DB"))) return true;
    if (c === "ACDB" || c === "ACDB BOX") return true;
  }
  if (w === "DC BOX") {
    if (c.includes("DC") && (c.includes("BOX") || c.includes("DB"))) return true;
    if (c === "DCDB" || c === "DCDB BOX") return true;
  }
  if (w === "PANEL" && c.includes("PANEL")) return true;
  if (w === "INVERTER" && c.includes("INVERTER")) return true;
  if (w === "WIRE" && (c === "WIRE" || c.includes("WIRE") || c.includes("CABLE"))) {
    return true;
  }
  if (w === "GENERAL" && (c === "GENERAL" || c === "GENRAL")) return true;
  if (w === "STAND" && c.includes("STAND")) return true;
  return false;
}

/** Category blank / galat ho to item name se andaza. */
function inferCategoryFromName(name) {
  const n = String(name || "").toUpperCase();
  if (!n) return "";
  if (/\bLA\b|LIGHTNING|ARRESTER/.test(n) && !/PANEL|WIRE/.test(n)) return "GENERAL";
  if (/EARTH/.test(n)) return "GENERAL";
  if (/AC\s*BOX|ACDB|AC\s*D\.?B/.test(n)) return "AC BOX";
  if (/DC\s*BOX|DCDB|DC\s*D\.?B/.test(n)) return "DC BOX";
  if (/PANEL|MONO|POLY|\d+\s*W\b|WP\b/.test(n)) return "PANEL";
  if (/INVERTER|ON[\s-]?GRID|HYBRID|OFF[\s-]?GRID/.test(n)) return "INVERTER";
  if (/WIRE|CABLE|SQ\.?\s*MM|SQMM/.test(n)) return "WIRE";
  if (/STAND|STRUCTURE|GI\s*KIT/.test(n)) return "STAND";
  return "";
}

function productMatchesCategory(product, want) {
  const cat = String(product?.category || "").trim();
  if (matchCategory(cat, want)) return true;
  return matchCategory(inferCategoryFromName(product?.itemName), want);
}

function uniqueNames(list) {
  const seen = new Set();
  const out = [];
  for (const name of list) {
    const itemName = String(name || "").trim();
    if (!itemName) continue;
    const key = itemName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(itemName);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function isLaProduct(name) {
  const n = String(name || "").trim();
  if (!n) return false;
  if (/lightning|arrester/i.test(n)) return true;
  return /^la\b|\bla\b|^l\.?a\.?$/i.test(n);
}

function isEarthingProduct(name) {
  return /earth/i.test(String(name || ""));
}

function defaultNames(category, nameFilter) {
  return DEFAULT_PRODUCT_ITEMS.filter((p) => productMatchesCategory(p, category))
    .map((p) => String(p.itemName || "").trim())
    .filter((name) => (nameFilter ? nameFilter(name) : Boolean(name)));
}

/**
 * Site form dropdowns — Product Sheet (primary) + Stock + defaults.
 * Team Leader phone pe bhi packed URL / defaults se options milte hain.
 */
export function buildSiteStockCatalog() {
  const stockRows = listStockSheetRows();
  const products = loadProducts().filter((p) => p.status !== "Inactive");

  const stockNames = (category, { allowZero = true, nameFilter } = {}) => {
    const list = stockRows
      .filter((r) => matchCategory(r.category, category) || matchCategory(inferCategoryFromName(r.itemName), category))
      .filter((r) => (allowZero ? true : Number(r.balance) > 0))
      .map((r) => String(r.itemName || "").trim())
      .filter((name) => (nameFilter ? nameFilter(name) : true));
    return list;
  };

  const productNames = (category, nameFilter) =>
    products
      .filter((p) => productMatchesCategory(p, category))
      .map((p) => String(p.itemName || "").trim())
      .filter((name) => (nameFilter ? nameFilter(name) : Boolean(name)));

  /** Product Sheet → defaults → stock (zero balance bhi) */
  const merge = (category, nameFilter) =>
    uniqueNames([
      ...productNames(category, nameFilter),
      ...defaultNames(category, nameFilter),
      ...stockNames(category, { allowZero: true, nameFilter }),
    ]);

  const laFromGeneral = uniqueNames([
    ...productNames("GENERAL", isLaProduct),
    ...defaultNames("GENERAL", isLaProduct),
    ...stockNames("GENERAL", { nameFilter: isLaProduct }),
    ...products
      .map((p) => String(p.itemName || "").trim())
      .filter(isLaProduct),
  ]);
  const earthingFromGeneral = uniqueNames([
    ...productNames("GENERAL", isEarthingProduct),
    ...defaultNames("GENERAL", isEarthingProduct),
    ...stockNames("GENERAL", { nameFilter: isEarthingProduct }),
    ...products
      .map((p) => String(p.itemName || "").trim())
      .filter(isEarthingProduct),
  ]);

  return {
    panels: merge("PANEL").map((itemName) => ({ itemName, category: "PANEL" })),
    inverters: merge("INVERTER").map((itemName) => ({
      itemName,
      category: "INVERTER",
    })),
    acBoxes: merge("AC BOX").map((itemName) => ({
      itemName,
      category: "AC BOX",
    })),
    dcBoxes: merge("DC BOX").map((itemName) => ({
      itemName,
      category: "DC BOX",
    })),
    wires: merge("WIRE").map((itemName) => ({ itemName, category: "WIRE" })),
    laItems: laFromGeneral.map((itemName) => ({
      itemName,
      category: "GENERAL",
    })),
    earthingItems: earthingFromGeneral.map((itemName) => ({
      itemName,
      category: "GENERAL",
    })),
  };
}

export function stockCatalogNames(list) {
  return (list || []).map((r) => (typeof r === "string" ? r : r.itemName)).filter(Boolean);
}

/** Compact names map for WhatsApp URL / form merge. */
export function buildSiteCatalogNameMap() {
  const cat = buildSiteStockCatalog();
  return {
    panels: stockCatalogNames(cat.panels),
    inverters: stockCatalogNames(cat.inverters),
    acBoxes: stockCatalogNames(cat.acBoxes),
    dcBoxes: stockCatalogNames(cat.dcBoxes),
    wires: stockCatalogNames(cat.wires),
    laItems: stockCatalogNames(cat.laItems),
    earthingItems: stockCatalogNames(cat.earthingItems),
  };
}

export function mergeCatalogNameMaps(...maps) {
  const keys = [
    "panels",
    "inverters",
    "acBoxes",
    "dcBoxes",
    "wires",
    "laItems",
    "earthingItems",
  ];
  const out = {};
  for (const key of keys) {
    out[key] = uniqueNames(maps.flatMap((m) => m?.[key] || []));
  }
  return out;
}
