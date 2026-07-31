import { BOM_BY_CONSUMER, lookupBom as lookupStaticBom } from "../constants/bomRegistry";
import { parseFirstNumber } from "../constants/labourSheet";
import { erpGetItem, erpRemoveItem, erpSetItem } from "./erpStorage";

const STORAGE_KEY = "dhatterwal_bom_sheet_files";

const ITEM_DEFS = [
  { key: "panel", itemName: "Solar Panel", materialKey: "panelDetail" },
  { key: "inverter", itemName: "Inverter", materialKey: "inverterDetail" },
  { key: "inverterSerial", itemName: "Inverter Serial", materialKey: "inverterSerial" },
  { key: "copperWire", itemName: "Copper Wire", materialKey: "copperWire" },
  { key: "mainWire", itemName: "Main Wire", materialKey: "mainWire" },
  { key: "stand", itemName: "Structure Stand", materialKey: "stand" },
];

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function parseQtyUnit(detail) {
  const text = String(detail || "");
  const nosMatch = text.match(/×\s*([\d.]+)\s*Nos/i) || text.match(/([\d.]+)\s*Nos/i);
  if (nosMatch) {
    return { qty: Number(nosMatch[1]) || 1, unit: "NOS" };
  }
  const setMatch = text.match(/([\d.]+)\s*Set/i);
  if (setMatch) {
    return { qty: Number(setMatch[1]) || 1, unit: "SET" };
  }
  const mMatch = text.match(/([\d.]+)\s*m\b/i);
  if (mMatch) {
    return { qty: Number(mMatch[1]) || 1, unit: "MTR" };
  }
  const n = parseFirstNumber(text);
  return { qty: n > 0 ? n : 1, unit: "NOS" };
}

export function lineAmount(item) {
  const qty = Number(item.qty) || 0;
  const rate = Number(item.rate) || 0;
  return Math.round(qty * rate * 100) / 100;
}

export function fileTotalAmount(items) {
  return Math.round(items.reduce((sum, row) => sum + lineAmount(row), 0) * 100) / 100;
}

function materialsFromBom(bom) {
  if (!bom) return null;
  return {
    labourDate: bom.labourDate || "",
    panelDetail: bom.panelDetail || "",
    inverterDetail: bom.inverterDetail || "",
    inverterSerial: bom.inverterSerial || "",
    copperWire: bom.copperWire || "",
    mainWire: bom.mainWire || "",
    stand: bom.stand || "",
  };
}

export function buildItemsFromMaterials(materials, previousItems = []) {
  const rateByKey = Object.fromEntries(
    (previousItems || []).map((row) => [row.key, row.rate]),
  );

  return ITEM_DEFS.map((def) => {
    const detail = materials?.[def.materialKey] || "—";
    const { qty, unit } = parseQtyUnit(detail);
    const prev = previousItems?.find((r) => r.key === def.key);
    return {
      id: def.key,
      key: def.key,
      itemName: def.itemName,
      detail,
      qty: prev?.detail === detail ? prev.qty : qty,
      unit: prev?.detail === detail ? prev.unit : unit,
      rate: rateByKey[def.key] ?? prev?.rate ?? 0,
    };
  });
}

function loadAllFilesMap() {
  return safeParse(erpGetItem(STORAGE_KEY), {});
}

function saveAllFilesMap(map) {
  try {
    erpSetItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function loadBomSheetFiles() {
  const map = loadAllFilesMap();
  return Object.values(map).sort((a, b) =>
    String(a.consumerNo).localeCompare(String(b.consumerNo)),
  );
}

export function getBomFile(consumerNo) {
  const key = String(consumerNo || "").trim().toUpperCase();
  if (!key) return null;
  const map = loadAllFilesMap();
  return map[key] ?? null;
}

/** Material snapshot for Sale Sheet setup detail & complete file generator */
export function getBomMaterialsForConsumer(consumerNo) {
  const file = getBomFile(consumerNo);
  if (file?.materials) return file.materials;
  return lookupStaticBom(consumerNo);
}

function isPlaceholderMaterials(materials) {
  if (!materials) return true;
  const panel = String(materials.panelDetail || "").trim();
  const invSerial = String(materials.inverterSerial || "").trim();
  return !panel || panel === "—" || !invSerial || invSerial === "—";
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayLabourDate() {
  const d = new Date();
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function standLabelForKw(setupKw) {
  const kw = String(setupKw || "").replace(/\s/g, "").toUpperCase();
  if (kw.includes("05")) return "05 kW Structure Stand × 1 Set";
  if (kw.includes("03")) return "03 kW Structure Stand × 1 Set";
  return "02 kW Structure Stand × 1 Set";
}

/** Team Leader site form → BOM materials */
export function materialsFromSiteOrderForm(order, form) {
  const panelSerials = (form?.panelSerials || []).map((s) => String(s || "").trim()).filter(Boolean);
  const panelCount = panelSerials.length || Number(order?.panelCount) || 1;
  const panelName = String(form?.panelProductName || "Solar Panel").trim() || "Solar Panel";
  const panelDetail = `${panelName} × ${panelCount} Nos${
    panelSerials.length ? ` (S/N: ${panelSerials.join(", ")})` : ""
  }`;

  const inverterDetail = String(form?.inverterName || "Inverter").trim() || "Inverter";
  const inverterSerial = String(form?.inverterSerial || "").trim() || "—";

  const wires = (form?.wireLines || []).filter((w) => Number(w.qtyMtr) > 0);
  const copper =
    wires.find((w) => /copper|dc|4\s*sq/i.test(String(w.itemName || ""))) || wires[0];
  const main =
    wires.find((w) => /main|ac|6\s*sq|10\s*sq/i.test(String(w.itemName || ""))) ||
    wires.find((w) => w !== copper) ||
    wires[1];

  const copperWire = copper
    ? `${copper.itemName} — ${copper.qtyMtr} m`
    : "—";
  const mainWire = main ? `${main.itemName} — ${main.qtyMtr} m` : "—";

  const standLine = (form?.countLines || []).find(
    (c) => Number(c.qty) > 0 && /stand|structure/i.test(String(c.itemName || "")),
  );
  const stand = standLine
    ? `${standLine.itemName} × ${standLine.qty} ${standLine.unit || "NOS"}`
    : standLabelForKw(order?.setupKw);

  return {
    labourDate: todayLabourDate(),
    panelDetail,
    inverterDetail,
    inverterSerial,
    copperWire,
    mainWire,
    stand,
  };
}

/**
 * TL site form submit ke baad BOM Sheet file update.
 * source = site-order → sale sync is materials ko overwrite nahi karega.
 */
export function applySiteOrderFormToBom(order, form) {
  const consumerNo = String(order?.consumerNo || "").trim();
  if (!consumerNo) return { ok: false, message: "Consumer No. missing." };

  const key = consumerNo.toUpperCase();
  const map = loadAllFilesMap();
  const existing = map[key];
  const materials = materialsFromSiteOrderForm(order, form);
  const items = buildItemsFromMaterials(materials, existing?.items);

  map[key] = {
    consumerNo: key,
    saleDate: order.siteDate || existing?.saleDate || "",
    customerName: order.customerName || existing?.customerName || "",
    address: order.address || existing?.address || "",
    setupKw: order.setupKw || existing?.setupKw || "",
    teamWork: order.teamWork || existing?.teamWork || "",
    materials,
    items,
    totalAmount: fileTotalAmount(items),
    source: "site-order",
    siteOrderId: order.id || "",
    updatedAt: new Date().toISOString(),
  };
  saveAllFilesMap(map);
  return { ok: true, materials, consumerNo: key };
}

export function syncBomFilesFromSaleRows(saleRows) {
  const map = loadAllFilesMap();
  const activeKeys = new Set();

  (saleRows || []).forEach((sale) => {
    const consumerNo = String(sale.consumerNo || "").trim();
    if (!consumerNo) return;
    const key = consumerNo.toUpperCase();
    activeKeys.add(key);

    const existing = map[key];
    const keepSiteMaterials =
      existing?.source === "site-order" || !isPlaceholderMaterials(existing?.materials);

    const staticBom = lookupStaticBom(consumerNo);
    const materials = keepSiteMaterials
      ? existing.materials
      : materialsFromBom(staticBom) || {
          labourDate: sale.date || "",
          panelDetail: "—",
          inverterDetail: "—",
          inverterSerial: "—",
          copperWire: "—",
          mainWire: "—",
          stand: "—",
        };

    const items = buildItemsFromMaterials(materials, existing?.items);

    map[key] = {
      consumerNo: key,
      saleDate: sale.date || existing?.saleDate || "",
      customerName: sale.customerName || existing?.customerName || "",
      address: sale.address || existing?.address || "",
      setupKw: sale.setupKw || existing?.setupKw || "",
      teamWork: sale.teamWork || existing?.teamWork || "",
      materials,
      items,
      totalAmount: fileTotalAmount(items),
      source: keepSiteMaterials ? existing?.source || "site-order" : existing?.source || "",
      siteOrderId: existing?.siteOrderId || "",
      updatedAt: new Date().toISOString(),
    };
  });

  Object.keys(map).forEach((key) => {
    if (!activeKeys.has(key)) {
      delete map[key];
    }
  });

  saveAllFilesMap(map);
}

export function updateBomFileItems(consumerNo, items) {
  const key = String(consumerNo || "").trim().toUpperCase();
  if (!key) return;
  const map = loadAllFilesMap();
  const file = map[key];
  if (!file) return;

  const nextItems = items.map((row) => ({
    ...row,
    rate: Number(row.rate) || 0,
    qty: Number(row.qty) || 0,
  }));

  map[key] = {
    ...file,
    items: nextItems,
    totalAmount: fileTotalAmount(nextItems),
    updatedAt: new Date().toISOString(),
  };
  saveAllFilesMap(map);
}

/** Seed storage from static registry when no sale sync yet */
export function ensureBomSeedFromRegistry() {
  const map = loadAllFilesMap();
  if (Object.keys(map).length > 0) return;
  const saleLike = Object.keys(BOM_BY_CONSUMER).map((consumerNo) => ({
    consumerNo,
    customerName: "",
    date: BOM_BY_CONSUMER[consumerNo].labourDate,
    teamWork: "",
  }));
  syncBomFilesFromSaleRows(saleLike);
}
