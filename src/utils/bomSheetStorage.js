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

export function syncBomFilesFromSaleRows(saleRows) {
  const map = loadAllFilesMap();
  const activeKeys = new Set();

  (saleRows || []).forEach((sale) => {
    const consumerNo = String(sale.consumerNo || "").trim();
    if (!consumerNo) return;
    const key = consumerNo.toUpperCase();
    activeKeys.add(key);

    const staticBom = lookupStaticBom(consumerNo);
    const materials = materialsFromBom(staticBom) || {
      labourDate: sale.date || "",
      panelDetail: "—",
      inverterDetail: "—",
      inverterSerial: "—",
      copperWire: "—",
      mainWire: "—",
      stand: "—",
    };

    const existing = map[key];
    const items = buildItemsFromMaterials(materials, existing?.items);

    map[key] = {
      consumerNo: key,
      saleDate: sale.date || "",
      customerName: sale.customerName || "",
      address: sale.address || "",
      setupKw: sale.setupKw || "",
      teamWork: sale.teamWork || "",
      materials,
      items,
      totalAmount: fileTotalAmount(items),
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
