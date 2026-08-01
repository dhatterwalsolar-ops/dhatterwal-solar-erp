import { BOM_BY_CONSUMER, lookupBom as lookupStaticBom } from "../constants/bomRegistry";
import { parseFirstNumber } from "../constants/labourSheet";
import { getConsumerReference } from "./consumerReference";
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

/** Fixed / site overhead defaults (₹). */
export const BOM_CHARGE_DEFAULTS = {
  fileCharge: 2000,
  departmentCharge: 2500,
  netMeterCost: 0,
  kw02Charge: 1500,
  autoRent: 1000,
};

export const BOM_CHARGE_FIELDS = [
  { key: "fileCharge", label: "File Charge", defaultValue: 2000 },
  { key: "departmentCharge", label: "Department Charge", defaultValue: 2500 },
  { key: "netMeterCost", label: "Net Meter Cost", defaultValue: 0, manual: true },
  { key: "kw02Charge", label: "02 KW", defaultValue: 1500 },
  { key: "autoRent", label: "Auto Rent", defaultValue: 1000 },
];

export function isDirectReference(reference) {
  return String(reference || "").trim().toLowerCase() === "direct";
}

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

export function chargesSubtotal(charges = {}) {
  return BOM_CHARGE_FIELDS.reduce((sum, f) => sum + (Number(charges[f.key]) || 0), 0);
}

export function computeTotalKharch(file) {
  const materialsTotal = fileTotalAmount(file?.items || []);
  const chargesTotal = chargesSubtotal(file?.charges || {});
  const refPay = isDirectReference(file?.reference)
    ? 0
    : Number(file?.referencePayment) || 0;
  return Math.round((materialsTotal + chargesTotal + refPay) * 100) / 100;
}

function defaultKw02Charge(setupKw) {
  const kw = String(setupKw || "").replace(/\s/g, "").toUpperCase();
  /* Sirf 02 KW setup pe default 1500; baaki 0 (manual change allowed) */
  if (kw.includes("02")) return BOM_CHARGE_DEFAULTS.kw02Charge;
  return 0;
}

export function buildDefaultCharges({ setupKw, previous } = {}) {
  const prev = previous && typeof previous === "object" ? previous : {};
  return {
    fileCharge:
      prev.fileCharge != null && prev.fileCharge !== ""
        ? Number(prev.fileCharge) || 0
        : BOM_CHARGE_DEFAULTS.fileCharge,
    departmentCharge:
      prev.departmentCharge != null && prev.departmentCharge !== ""
        ? Number(prev.departmentCharge) || 0
        : BOM_CHARGE_DEFAULTS.departmentCharge,
    netMeterCost:
      prev.netMeterCost != null && prev.netMeterCost !== ""
        ? Number(prev.netMeterCost) || 0
        : BOM_CHARGE_DEFAULTS.netMeterCost,
    kw02Charge:
      prev.kw02Charge != null && prev.kw02Charge !== ""
        ? Number(prev.kw02Charge) || 0
        : defaultKw02Charge(setupKw),
    autoRent:
      prev.autoRent != null && prev.autoRent !== ""
        ? Number(prev.autoRent) || 0
        : BOM_CHARGE_DEFAULTS.autoRent,
  };
}

function withTotals(file) {
  const itemsTotal = fileTotalAmount(file.items || []);
  const totalKharch = computeTotalKharch(file);
  return {
    ...file,
    totalAmount: itemsTotal,
    totalKharch,
  };
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
    const base = {
      id: def.key,
      key: def.key,
      itemName: def.itemName,
      detail,
      qty: prev?.detail === detail ? prev.qty : qty,
      unit: prev?.detail === detail ? prev.unit : unit,
      /* Stand rate always manual — preserve previous if user filled */
      rate: rateByKey[def.key] ?? prev?.rate ?? 0,
    };
    if (def.key === "stand") {
      base.standPaymentType =
        materials?.standPaymentType ||
        prev?.standPaymentType ||
        standPaymentTypeFromDetail(detail);
    }
    return base;
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
  return Object.values(map)
    .map((file) => {
      const charges = buildDefaultCharges({
        setupKw: file.setupKw,
        previous: file.charges,
      });
      const reference =
        file.reference || getConsumerReference(file.consumerNo) || "";
      return withTotals({
        ...file,
        reference,
        charges,
        referencePayment: isDirectReference(reference)
          ? 0
          : Number(file.referencePayment) || 0,
      });
    })
    .sort((a, b) => String(a.consumerNo).localeCompare(String(b.consumerNo)));
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
  const inv = String(materials.inverterDetail || "").trim();
  /* Panel/inverter detail enough — serial optional on new site form */
  return !panel || panel === "—" || !inv || inv === "—";
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayLabourDate() {
  const d = new Date();
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export const STAND_PAYMENT_OPTIONS = ["02 KW", "03 KW", "05 KW", "OTHER"];

export function normalizeBomDate(value) {
  return String(value || "")
    .trim()
    .replace(/-/g, "/");
}

export function bomFileSiteDate(file) {
  return normalizeBomDate(
    file?.materials?.labourDate || file?.saleDate || file?.siteDate || "",
  );
}

export function todayBomDateEnGb() {
  return todayLabourDate();
}

function standDetailFromForm(form, order) {
  const type = String(form?.standPaymentType || form?.standKw || "").trim();
  if (type === "OTHER") {
    const other = String(form?.standOther || "").trim();
    return other
      ? `OTHER — ${other} × 1 Set`
      : "OTHER Structure Stand × 1 Set";
  }
  if (STAND_PAYMENT_OPTIONS.includes(type)) {
    return `${type} Structure Stand × 1 Set`;
  }
  const kw = String(order?.setupKw || "").replace(/\s/g, "").toUpperCase();
  if (kw.includes("05")) return "05 KW Structure Stand × 1 Set";
  if (kw.includes("03")) return "03 KW Structure Stand × 1 Set";
  return "02 KW Structure Stand × 1 Set";
}

function standPaymentTypeFromDetail(detail, fallback = "02 KW") {
  const t = String(detail || "").toUpperCase();
  if (t.includes("OTHER")) return "OTHER";
  if (t.includes("05")) return "05 KW";
  if (t.includes("03")) return "03 KW";
  if (t.includes("02")) return "02 KW";
  return STAND_PAYMENT_OPTIONS.includes(fallback) ? fallback : "02 KW";
}

/** Team Leader site form → BOM materials */
export function materialsFromSiteOrderForm(order, form) {
  const panelQty =
    Number(form?.panelQty) ||
    (form?.panelSerials || []).filter((s) => String(s || "").trim()).length ||
    Number(order?.panelCount) ||
    1;
  const panelName =
    String(form?.panelName || form?.panelProductName || "Solar Panel").trim() ||
    "Solar Panel";
  const panelDetail = `${panelName} × ${panelQty} Nos`;

  const inverterKw = String(form?.inverterKw || "").trim();
  const inverterDetail =
    String(form?.inverterName || "").trim() ||
    (inverterKw ? `Inverter (${inverterKw})` : "Inverter");
  const inverterSerial = String(form?.inverterSerial || "").trim() || "—";

  const dcMtr = Number(form?.dcWireMtr) || 0;
  const copperMtr = Number(form?.copperWireMtr) || 0;
  const mainMtr = Number(form?.mainWireMtr) || 0;

  let copperWire = "—";
  let mainWire = "—";
  if (copperMtr > 0) copperWire = `Copper Wire — ${copperMtr} m`;
  if (mainMtr > 0) mainWire = `Main Wire — ${mainMtr} m`;
  if (dcMtr > 0 && copperWire === "—") {
    copperWire = `DC Wire — ${dcMtr} m`;
  } else if (dcMtr > 0) {
    copperWire = `${copperWire}; DC Wire — ${dcMtr} m`;
  }

  /* Legacy wireLines */
  if (copperWire === "—" || mainWire === "—") {
    const wires = (form?.wireLines || []).filter((w) => Number(w.qtyMtr) > 0);
    const copper =
      wires.find((w) => /copper|dc|4\s*sq/i.test(String(w.itemName || ""))) || wires[0];
    const main =
      wires.find((w) => /main|ac|6\s*sq|10\s*sq/i.test(String(w.itemName || ""))) ||
      wires.find((w) => w !== copper) ||
      wires[1];
    if (copperWire === "—" && copper) {
      copperWire = `${copper.itemName} — ${copper.qtyMtr} m`;
    }
    if (mainWire === "—" && main) {
      mainWire = `${main.itemName} — ${main.qtyMtr} m`;
    }
  }

  const standPaymentType = String(
    form?.standPaymentType || form?.standKw || "02 KW",
  ).trim();
  const stand = standDetailFromForm(form, order);

  return {
    labourDate: order?.siteDate || todayLabourDate(),
    panelDetail,
    inverterDetail,
    inverterSerial,
    copperWire,
    mainWire,
    stand,
    standPaymentType,
    dcWireMtr: form?.dcWireMtr || "",
    acBoxQty: form?.acBoxQty || "",
    dcBoxQty: form?.dcBoxQty || "",
    laQty: form?.laQty || "",
    earthingRodQty: form?.earthingRodQty || "",
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

  const setupKw = order.setupKw || existing?.setupKw || "";
  const reference =
    getConsumerReference(key) ||
    String(existing?.reference || "").trim();
  const charges = buildDefaultCharges({
    setupKw,
    previous: existing?.charges,
  });
  const referencePayment = isDirectReference(reference)
    ? 0
    : Number(existing?.referencePayment) || 0;

  map[key] = withTotals({
    consumerNo: key,
    saleDate: order.siteDate || existing?.saleDate || "",
    customerName: order.customerName || existing?.customerName || "",
    address: order.address || existing?.address || "",
    setupKw,
    teamWork: order.teamWork || existing?.teamWork || "",
    reference,
    materials,
    items,
    charges,
    referencePayment,
    source: "site-order",
    siteOrderId: order.id || "",
    updatedAt: new Date().toISOString(),
  });
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
    const setupKw = sale.setupKw || existing?.setupKw || "";
    const reference =
      getConsumerReference(key) ||
      String(sale.reference || existing?.reference || "").trim();
    const charges = buildDefaultCharges({
      setupKw,
      previous: existing?.charges,
    });
    const referencePayment = isDirectReference(reference)
      ? 0
      : Number(existing?.referencePayment) || 0;

    map[key] = withTotals({
      consumerNo: key,
      saleDate: sale.date || existing?.saleDate || "",
      customerName: sale.customerName || existing?.customerName || "",
      address: sale.address || existing?.address || "",
      setupKw,
      teamWork: sale.teamWork || existing?.teamWork || "",
      reference,
      materials,
      items,
      charges,
      referencePayment,
      source: keepSiteMaterials ? existing?.source || "site-order" : existing?.source || "",
      siteOrderId: existing?.siteOrderId || sale.siteOrderId || "",
      updatedAt: new Date().toISOString(),
    });
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

  const standRow = nextItems.find((r) => r.key === "stand");
  const materials = {
    ...(file.materials || {}),
  };
  if (standRow) {
    materials.stand = standRow.detail;
    materials.standPaymentType =
      standRow.standPaymentType ||
      standPaymentTypeFromDetail(standRow.detail, materials.standPaymentType);
  }

  map[key] = withTotals({
    ...file,
    materials,
    items: nextItems,
    updatedAt: new Date().toISOString(),
  });
  saveAllFilesMap(map);
}

/** Update fixed charges / reference payment on BOM file. */
export function updateBomCharges(consumerNo, patch = {}) {
  const key = String(consumerNo || "").trim().toUpperCase();
  if (!key) return;
  const map = loadAllFilesMap();
  const file = map[key];
  if (!file) return;

  const nextCharges = {
    ...buildDefaultCharges({ setupKw: file.setupKw, previous: file.charges }),
    ...(patch.charges || {}),
  };
  BOM_CHARGE_FIELDS.forEach((f) => {
    if (patch[f.key] !== undefined) {
      nextCharges[f.key] = Number(patch[f.key]) || 0;
    }
  });

  let reference = file.reference || getConsumerReference(key) || "";
  if (patch.reference !== undefined) {
    reference = String(patch.reference || "").trim();
  }

  let referencePayment = Number(file.referencePayment) || 0;
  if (isDirectReference(reference)) {
    referencePayment = 0;
  } else if (patch.referencePayment !== undefined) {
    referencePayment = Number(patch.referencePayment) || 0;
  }

  map[key] = withTotals({
    ...file,
    reference,
    charges: nextCharges,
    referencePayment,
    updatedAt: new Date().toISOString(),
  });
  saveAllFilesMap(map);
}

/** Sale Bill / sync — ensure charges + reference on existing BOM file. */
export function ensureBomChargesOnFile(consumerNo, { reference, setupKw, saleDate } = {}) {
  const key = String(consumerNo || "").trim().toUpperCase();
  if (!key) return null;
  const map = loadAllFilesMap();
  let file = map[key];
  if (!file) {
    file = {
      consumerNo: key,
      saleDate: saleDate || "",
      customerName: "",
      address: "",
      setupKw: setupKw || "",
      teamWork: "",
      materials: {
        labourDate: saleDate || todayLabourDate(),
        panelDetail: "—",
        inverterDetail: "—",
        inverterSerial: "—",
        copperWire: "—",
        mainWire: "—",
        stand: "—",
      },
      items: buildItemsFromMaterials({}),
      source: "",
    };
  }

  const ref =
    String(reference || file.reference || getConsumerReference(key) || "").trim();
  const charges = buildDefaultCharges({
    setupKw: setupKw || file.setupKw,
    previous: file.charges,
  });

  map[key] = withTotals({
    ...file,
    setupKw: setupKw || file.setupKw || "",
    saleDate: saleDate || file.saleDate || "",
    reference: ref,
    charges,
    referencePayment: isDirectReference(ref) ? 0 : Number(file.referencePayment) || 0,
    updatedAt: new Date().toISOString(),
  });
  saveAllFilesMap(map);
  return map[key];
}

/** BOM Sheet — Stand payment type (02/03/05 KW / OTHER); rate user fills. */
export function updateBomStandPaymentType(consumerNo, standPaymentType, standOther = "") {
  const key = String(consumerNo || "").trim().toUpperCase();
  if (!key) return;
  const map = loadAllFilesMap();
  const file = map[key];
  if (!file) return;

  const type = STAND_PAYMENT_OPTIONS.includes(standPaymentType)
    ? standPaymentType
    : "02 KW";
  const detail =
    type === "OTHER"
      ? String(standOther || "").trim()
        ? `OTHER — ${String(standOther).trim()} × 1 Set`
        : "OTHER Structure Stand × 1 Set"
      : `${type} Structure Stand × 1 Set`;

  const nextItems = (file.items || []).map((row) => {
    if (row.key !== "stand") return row;
    return {
      ...row,
      detail,
      standPaymentType: type,
      qty: Number(row.qty) > 0 ? row.qty : 1,
      unit: row.unit || "SET",
      /* rate untouched — manual */
    };
  });

  map[key] = withTotals({
    ...file,
    materials: {
      ...(file.materials || {}),
      stand: detail,
      standPaymentType: type,
    },
    items: nextItems,
    updatedAt: new Date().toISOString(),
  });
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
