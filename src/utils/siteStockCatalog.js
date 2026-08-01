import { loadProducts } from "./productStorage";
import { listStockSheetRows } from "./stockStorage";

function matchCategory(rowCat, want) {
  const c = String(rowCat || "").trim().toUpperCase();
  const w = String(want || "").trim().toUpperCase();
  if (!w) return true;
  if (c === w) return true;
  if (w === "AC BOX" && c.includes("AC") && c.includes("BOX")) return true;
  if (w === "DC BOX" && c.includes("DC") && c.includes("BOX")) return true;
  if (w === "PANEL" && c.includes("PANEL")) return true;
  if (w === "INVERTER" && c.includes("INVERTER")) return true;
  if (w === "WIRE" && (c === "WIRE" || c.includes("WIRE") || c.includes("CABLE"))) {
    return true;
  }
  if (w === "GENERAL" && (c === "GENERAL" || c === "GENRAL")) return true;
  return false;
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
  /* Exact / word-boundary LA — avoid matching "PANEL" etc. */
  return /^la\b|\bla\b|^l\.?a\.?$/i.test(n);
}

function isEarthingProduct(name) {
  return /earth/i.test(String(name || ""));
}

/**
 * Site form dropdowns — Product Sheet + Stock names.
 * AC/DC/LA/Earthing Product Sheet se aate hain taaki stock sahi update ho.
 */
export function buildSiteStockCatalog() {
  const stockRows = listStockSheetRows();
  const products = loadProducts().filter((p) => p.status !== "Inactive");

  const stockNames = (category, { allowZero = false, nameFilter } = {}) => {
    const list = stockRows
      .filter((r) => matchCategory(r.category, category))
      .filter((r) => (allowZero ? true : Number(r.balance) > 0))
      .map((r) => String(r.itemName || "").trim())
      .filter((name) => (nameFilter ? nameFilter(name) : true));
    if (!list.length && !allowZero) {
      return stockNames(category, { allowZero: true, nameFilter });
    }
    return list;
  };

  const productNames = (category, nameFilter) =>
    products
      .filter((p) => matchCategory(p.category, category))
      .map((p) => String(p.itemName || "").trim())
      .filter((name) => (nameFilter ? nameFilter(name) : Boolean(name)));

  /** Product Sheet pehle, phir stock — dono merge */
  const merge = (category, nameFilter) =>
    uniqueNames([
      ...productNames(category, nameFilter),
      ...stockNames(category, { nameFilter }),
    ]);

  /* LA / Earthing aksar GENERAL category me Product Sheet pe */
  const laFromGeneral = uniqueNames([
    ...productNames("GENERAL", isLaProduct),
    ...stockNames("GENERAL", { nameFilter: isLaProduct }),
    ...productNames("GENERAL", (n) => /^la$/i.test(n)),
  ]);
  const earthingFromGeneral = uniqueNames([
    ...productNames("GENERAL", isEarthingProduct),
    ...stockNames("GENERAL", { nameFilter: isEarthingProduct }),
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
