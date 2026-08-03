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

/**
 * Site BOM form dropdowns.
 * Panel / Inverter / Wire — sirf Stock Sheet (balance > 0).
 * AC/DC/LA/Earthing — Product Sheet + stock.
 */
export function buildSiteStockCatalog() {
  const stockRows = listStockSheetRows();
  const products = loadProducts().filter((p) => p.status !== "Inactive");

  const stockNames = (category, { allowZero = false, nameFilter } = {}) => {
    const list = stockRows
      .filter(
        (r) =>
          matchCategory(r.category, category) ||
          matchCategory(inferCategoryFromName(r.itemName), category),
      )
      .filter((r) => (allowZero ? true : Number(r.balance) > 0))
      .map((r) => String(r.itemName || "").trim())
      .filter((name) => (nameFilter ? nameFilter(name) : Boolean(name)));
    /* Balance wale khali — zero balance stock names fallback (phir bhi stock sheet se) */
    if (!list.length && !allowZero) {
      return stockNames(category, { allowZero: true, nameFilter });
    }
    return list;
  };

  const productNames = (category, nameFilter) =>
    products
      .filter((p) => productMatchesCategory(p, category))
      .map((p) => String(p.itemName || "").trim())
      .filter((name) => (nameFilter ? nameFilter(name) : Boolean(name)));

  /** Stock only — Product Sheet / defaults nahi */
  const stockOnly = (category) =>
    uniqueNames(stockNames(category, { allowZero: false })).map((itemName) => ({
      itemName,
      category,
    }));

  /** Product + stock (AC/DC/LA) */
  const productAndStock = (category) =>
    uniqueNames([
      ...productNames(category),
      ...stockNames(category, { allowZero: true }),
    ]).map((itemName) => ({ itemName, category }));

  const laFromGeneral = uniqueNames([
    ...productNames("GENERAL", isLaProduct),
    ...stockNames("GENERAL", { allowZero: true, nameFilter: isLaProduct }),
    ...products.map((p) => String(p.itemName || "").trim()).filter(isLaProduct),
  ]);
  const earthingFromGeneral = uniqueNames([
    ...productNames("GENERAL", isEarthingProduct),
    ...stockNames("GENERAL", { allowZero: true, nameFilter: isEarthingProduct }),
    ...products.map((p) => String(p.itemName || "").trim()).filter(isEarthingProduct),
  ]);

  return {
    panels: stockOnly("PANEL"),
    inverters: stockOnly("INVERTER"),
    wires: stockOnly("WIRE"),
    acBoxes: productAndStock("AC BOX"),
    dcBoxes: productAndStock("DC BOX"),
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
