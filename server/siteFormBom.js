import { getKey, setMany } from "./store.js";
import { applySiteFormStockOutOnServer } from "./siteStockOut.js";

const BOM_KEY = "dhatterwal_bom_sheet_files";
const SALE_KEY = "dhatterwal_sale_case_rows";
const SITE_ORDERS_KEY = "dhatterwal_site_orders";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayLabourDate() {
  const d = new Date();
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function parseQtyUnit(detail) {
  const text = String(detail || "").trim();
  if (!text || text === "—" || text === "-") return { qty: 0, unit: "NOS" };
  const nosMatch = text.match(/×\s*([\d.]+)\s*Nos/i) || text.match(/([\d.]+)\s*Nos/i);
  if (nosMatch) return { qty: Number(nosMatch[1]) || 1, unit: "NOS" };
  const setMatch = text.match(/([\d.]+)\s*Set/i);
  if (setMatch) return { qty: Number(setMatch[1]) || 1, unit: "SET" };
  const mMatch = text.match(/([\d.]+)\s*m\b/i);
  if (mMatch) return { qty: Number(mMatch[1]) || 1, unit: "MTR" };
  return { qty: 1, unit: "NOS" };
}

const ITEM_DEFS = [
  { key: "panel", itemName: "Solar Panel", materialKey: "panelDetail" },
  { key: "inverter", itemName: "Inverter", materialKey: "inverterDetail" },
  { key: "inverterSerial", itemName: "Inverter Serial", materialKey: "inverterSerial" },
  { key: "acBox", itemName: "AC Box", materialKey: "acBoxDetail" },
  { key: "dcBox", itemName: "DC Box", materialKey: "dcBoxDetail" },
  { key: "copperWire", itemName: "Copper Wire", materialKey: "copperWire" },
  { key: "mainWire", itemName: "Main Wire", materialKey: "mainWire" },
  { key: "la", itemName: "LA", materialKey: "laDetail" },
  { key: "earthing", itemName: "Earthing", materialKey: "earthingDetail" },
  { key: "stand", itemName: "Structure Stand", materialKey: "stand" },
];

function buildItemsFromMaterials(materials, previousItems = []) {
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
      rate: rateByKey[def.key] ?? prev?.rate ?? 0,
    };
    if (def.key === "stand") {
      base.standPaymentType =
        materials?.standPaymentType || prev?.standPaymentType || "02 KW";
    }
    return base;
  });
}

function lineAmount(item) {
  return Math.round((Number(item.qty) || 0) * (Number(item.rate) || 0) * 100) / 100;
}

function fileTotalAmount(items) {
  return Math.round(items.reduce((sum, row) => sum + lineAmount(row), 0) * 100) / 100;
}

function formatSetupDetail(materials) {
  if (!materials) return "BOM not found — fill BOM Sheet for this Consumer No.";
  return [
    `Labour Date: ${materials.labourDate || "—"}`,
    `Panel Detail: ${materials.panelDetail || "—"}`,
    `Inverter Detail: ${materials.inverterDetail || "—"}`,
    `Inverter Serial No.: ${materials.inverterSerial || "—"}`,
    `AC Box: ${materials.acBoxDetail || "—"}`,
    `DC Box: ${materials.dcBoxDetail || "—"}`,
    `Copper Wire: ${materials.copperWire || "—"}`,
    `Main Wire: ${materials.mainWire || "—"}`,
    `LA: ${materials.laDetail || "—"}`,
    `Earthing: ${materials.earthingDetail || "—"}`,
    `Stand: ${materials.stand || "—"}`,
  ].join("\n");
}

function standDetail(form, order) {
  const type = String(form?.standPaymentType || form?.standKw || "").trim();
  if (type === "OTHER") {
    const other = String(form?.standOther || "").trim();
    return other ? `OTHER — ${other} × 1 Set` : "OTHER Structure Stand × 1 Set";
  }
  if (["02 KW", "03 KW", "05 KW"].includes(type)) {
    return `${type} Structure Stand × 1 Set`;
  }
  const kw = String(order?.setupKw || "").replace(/\s/g, "").toUpperCase();
  if (kw.includes("05")) return "05 KW Structure Stand × 1 Set";
  if (kw.includes("03")) return "03 KW Structure Stand × 1 Set";
  return "02 KW Structure Stand × 1 Set";
}

function materialsFromForm(order, form) {
  const panelQty =
    Number(form?.panelQty) || Number(order?.panelCount) || 1;
  const panelName =
    String(form?.panelName || form?.panelProductName || "Solar Panel").trim() ||
    "Solar Panel";
  const inverterKw = String(form?.inverterKw || "").trim();
  const inverterDetail =
    String(form?.inverterName || "").trim() ||
    (inverterKw ? `Inverter (${inverterKw})` : "Inverter");

  const dcMtr = Number(form?.dcWireMtr) || 0;
  const copperMtr = Number(form?.copperWireMtr) || 0;
  const mainMtr = Number(form?.mainWireMtr) || 0;
  let copperWire = "—";
  let mainWire = "—";
  if (copperMtr > 0 && form?.copperWireName) {
    copperWire = `${String(form.copperWireName).trim()} — ${copperMtr} m`;
  }
  if (mainMtr > 0 && form?.mainWireName) {
    mainWire = `${String(form.mainWireName).trim()} — ${mainMtr} m`;
  }
  if (dcMtr > 0 && form?.dcWireName) {
    const dcLabel = `${String(form.dcWireName).trim()} — ${dcMtr} m`;
    copperWire = copperWire === "—" ? dcLabel : `${copperWire}; ${dcLabel}`;
  }

  const acName = String(form?.acBoxName || "").trim();
  const acQty = Number(form?.acBoxQty) || 0;
  const dcName = String(form?.dcBoxName || "").trim();
  const dcQty = Number(form?.dcBoxQty) || 0;
  const laName = String(form?.laName || "").trim();
  const laQty = Number(form?.laQty) || 0;
  const earthingName = String(form?.earthingName || "").trim();
  const earthingQty = Number(form?.earthingRodQty) || 0;
  const standPaymentType = String(
    form?.standPaymentType || form?.standKw || "02 KW",
  ).trim();

  return {
    labourDate: order?.siteDate || todayLabourDate(),
    panelDetail: `${panelName} × ${panelQty} Nos`,
    inverterDetail,
    inverterSerial: String(form?.inverterSerial || "").trim() || "—",
    acBoxDetail: acName && acQty > 0 ? `${acName} × ${acQty} Nos` : "—",
    dcBoxDetail: dcName && dcQty > 0 ? `${dcName} × ${dcQty} Nos` : "—",
    copperWire,
    mainWire,
    laDetail: laName && laQty > 0 ? `${laName} × ${laQty} Nos` : "—",
    earthingDetail:
      earthingName && earthingQty > 0
        ? `${earthingName} × ${earthingQty} Nos`
        : "—",
    stand: standDetail(form, order),
    standPaymentType,
  };
}

function defaultCharges(setupKw, previous = {}) {
  const kw = String(setupKw || "").replace(/\s/g, "").toUpperCase();
  const kw02 = kw.includes("02") ? 1500 : 0;
  return {
    fileCharge: previous.fileCharge != null ? Number(previous.fileCharge) || 0 : 2000,
    departmentCharge:
      previous.departmentCharge != null ? Number(previous.departmentCharge) || 0 : 2500,
    netMeterCost:
      previous.netMeterCost != null ? Number(previous.netMeterCost) || 0 : 0,
    kw02Charge: previous.kw02Charge != null ? Number(previous.kw02Charge) || 0 : kw02,
    autoRent: previous.autoRent != null ? Number(previous.autoRent) || 0 : 1000,
  };
}

/**
 * Team Leader site form (no login) → server BOM + Sale + site order.
 */
export async function applySiteFormToServer({ order = {}, form = {} } = {}) {
  const consumerNo = String(order.consumerNo || form.consumerNo || "").trim();
  if (!consumerNo) {
    return { ok: false, error: "consumerNo required." };
  }
  if (!String(form.panelName || form.panelProductName || "").trim()) {
    return { ok: false, error: "panelName required." };
  }
  if (!String(form.inverterName || "").trim()) {
    return { ok: false, error: "inverterName required." };
  }

  const key = consumerNo.toUpperCase();
  const materials = materialsFromForm(order, form);
  const setupDetail = formatSetupDetail(materials);

  const bomRaw = await getKey(BOM_KEY);
  const bomMap = safeParse(bomRaw, {});
  const existing = bomMap[key] || {};
  const items = buildItemsFromMaterials(materials, existing.items || []);
  const setupKw = order.setupKw || existing.setupKw || "";
  const charges = defaultCharges(setupKw, existing.charges);
  const reference = String(existing.reference || "").trim();
  const referencePayment =
    reference.toLowerCase() === "direct" ? 0 : Number(existing.referencePayment) || 0;
  const materialsTotal = fileTotalAmount(items);
  const chargesTotal = Object.values(charges).reduce((s, n) => s + (Number(n) || 0), 0);
  const totalKharch = Math.round((materialsTotal + chargesTotal + referencePayment) * 100) / 100;

  bomMap[key] = {
    ...existing,
    consumerNo: key,
    saleDate: order.siteDate || existing.saleDate || "",
    customerName: order.customerName || existing.customerName || "",
    address: order.address || existing.address || "",
    setupKw,
    teamWork: order.teamWork || existing.teamWork || "",
    reference,
    materials,
    items,
    charges,
    referencePayment,
    totalAmount: materialsTotal,
    totalKharch,
    source: "site-order",
    siteOrderId: order.id || existing.siteOrderId || "",
    teamMembers: form.teamMembers || existing.teamMembers || [],
    updatedAt: new Date().toISOString(),
  };

  const saleRaw = await getKey(SALE_KEY);
  const saleRows = safeParse(saleRaw, []);
  let saleChanged = false;
  const nextSale = Array.isArray(saleRows)
    ? saleRows.map((row) => {
        if (String(row.consumerNo || "").trim().toUpperCase() !== key) return row;
        saleChanged = true;
        return {
          ...row,
          setupDetail,
          teamWork: order.teamWork || row.teamWork || "",
          setupKw: setupKw || row.setupKw || "",
          siteOrderId: order.id || row.siteOrderId || "",
          siteOrderStatus: "submitted",
        };
      })
    : [];

  const ordersRaw = await getKey(SITE_ORDERS_KEY);
  const orders = safeParse(ordersRaw, []);
  const orderList = Array.isArray(orders) ? orders : [];
  const siteOrderId = order.id || `site-${Date.now()}`;
  const stockLines = Array.isArray(form.stockLines) ? form.stockLines : [];

  /* Server stock OUT — office Stock Sheet (TL phone local deduct pe depend mat karo) */
  const stockResult = await applySiteFormStockOutOnServer({
    siteOrderId,
    consumerNo: key,
    stockLines,
  });

  const formPayload = {
    ...form,
    /* Photos local only — server BOM ke liye materials kaafi */
    siteGpsPhoto: undefined,
    earthingPhoto: undefined,
    completeFile: undefined,
    cloudSyncedAt: new Date().toISOString(),
    stockLines,
    ...(stockResult.ok && !stockResult.skipped
      ? { stockBilledAt: new Date().toISOString() }
      : stockResult.skipped
        ? { stockBilledAt: form.stockBilledAt || new Date().toISOString() }
        : {}),
    stockServerMessage: stockResult.message || "",
  };
  const orderIdx = orderList.findIndex((o) => o.id && o.id === order.id);
  const nextOrder = {
    ...(orderIdx >= 0 ? orderList[orderIdx] : {}),
    ...order,
    id: siteOrderId,
    consumerNo: key,
    status: "submitted",
    submittedAt: new Date().toISOString(),
    formPayload,
    updatedAt: new Date().toISOString(),
  };
  const nextOrders =
    orderIdx >= 0
      ? orderList.map((o, i) => (i === orderIdx ? nextOrder : o))
      : [nextOrder, ...orderList].slice(0, 500);

  const entries = {
    [BOM_KEY]: JSON.stringify(bomMap),
    [SITE_ORDERS_KEY]: JSON.stringify(nextOrders),
  };
  if (saleChanged) {
    entries[SALE_KEY] = JSON.stringify(nextSale);
  }

  await setMany(entries);

  return {
    ok: true,
    consumerNo: key,
    bomUpdated: true,
    saleUpdated: saleChanged,
    siteOrderId: nextOrder.id,
    stockOk: Boolean(stockResult.ok),
    stockSkipped: Boolean(stockResult.skipped),
    stockIssuedLines: Number(stockResult.updatedLines) || 0,
    stockMessage: stockResult.message || "",
    materials,
    setupDetail,
  };
}
