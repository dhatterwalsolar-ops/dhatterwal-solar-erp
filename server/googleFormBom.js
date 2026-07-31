import { getKey, setKey, setMany } from "./store.js";

const BOM_KEY = "dhatterwal_bom_sheet_files";
const SALE_KEY = "dhatterwal_sale_case_rows";

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

function pick(body, ...keys) {
  for (const key of keys) {
    if (body[key] != null && String(body[key]).trim() !== "") {
      return String(body[key]).trim();
    }
  }
  return "";
}

function standLabelForKw(setupKw) {
  const kw = String(setupKw || "").replace(/\s/g, "").toUpperCase();
  if (kw.includes("05")) return "05 kW Structure Stand × 1 Set";
  if (kw.includes("03")) return "03 kW Structure Stand × 1 Set";
  return "02 kW Structure Stand × 1 Set";
}

function formatSetupDetail(materials) {
  if (!materials) return "BOM not found — fill BOM Sheet for this Consumer No.";
  return [
    `Labour Date: ${materials.labourDate || "—"}`,
    `Panel Detail: ${materials.panelDetail || "—"}`,
    `Inverter Detail: ${materials.inverterDetail || "—"}`,
    `Inverter Serial No.: ${materials.inverterSerial || "—"}`,
    `Copper Wire: ${materials.copperWire || "—"}`,
    `Main Wire: ${materials.mainWire || "—"}`,
    `Stand: ${materials.stand || "—"}`,
  ].join("\n");
}

function parseQtyUnit(detail) {
  const text = String(detail || "");
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
  { key: "copperWire", itemName: "Copper Wire", materialKey: "copperWire" },
  { key: "mainWire", itemName: "Main Wire", materialKey: "mainWire" },
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

function lineAmount(item) {
  return Math.round((Number(item.qty) || 0) * (Number(item.rate) || 0) * 100) / 100;
}

function fileTotalAmount(items) {
  return Math.round(items.reduce((sum, row) => sum + lineAmount(row), 0) * 100) / 100;
}

/** Normalize Google Form / Apps Script body → materials */
export function materialsFromGoogleFormBody(body = {}) {
  const setupKw = pick(body, "setupKw", "Setup kW", "Setup", "setup");
  const panelName = pick(body, "panelProductName", "Panel Product", "Panel Name", "panelName");
  const panelQty = pick(body, "panelQty", "Panel Qty", "Panel Count", "panelCount") || "1";
  const panelSerials = pick(body, "panelSerials", "Panel Serials", "Panel Serial");
  const panelDetailDirect = pick(body, "panelDetail", "Panel Detail");

  let panelDetail = panelDetailDirect;
  if (!panelDetail) {
    const name = panelName || "Solar Panel";
    panelDetail = `${name} × ${panelQty} Nos`;
    if (panelSerials) panelDetail += ` (S/N: ${panelSerials})`;
  }

  const inverterDetail =
    pick(body, "inverterDetail", "Inverter Detail", "Inverter Name", "inverterName") ||
    "Inverter";
  const inverterSerial =
    pick(body, "inverterSerial", "Inverter Serial", "Inverter Serial No.") || "—";
  const copperWire =
    pick(body, "copperWire", "Copper Wire", "DC Wire") || "—";
  const mainWire = pick(body, "mainWire", "Main Wire", "AC Wire") || "—";
  const stand =
    pick(body, "stand", "Stand", "Structure Stand") || standLabelForKw(setupKw);
  const labourDate =
    pick(body, "labourDate", "Labour Date", "Site Date", "siteDate") || todayLabourDate();

  return {
    labourDate,
    panelDetail,
    inverterDetail,
    inverterSerial,
    copperWire,
    mainWire,
    stand,
    setupKw,
    customerName: pick(body, "customerName", "Customer Name", "Name"),
    address: pick(body, "address", "Address"),
    teamWork: pick(body, "teamWork", "Team Work", "Team"),
    siteDate: pick(body, "siteDate", "Site Date", "Labour Date"),
  };
}

/**
 * Google Form submit → update erp_kv BOM + Sale Setup Detail.
 */
export async function applyGoogleFormToBomAndSale(body = {}) {
  const consumerNo = pick(
    body,
    "consumerNo",
    "Consumer No.",
    "Consumer No",
    "Consumer Number",
    "consumer_no",
  );
  if (!consumerNo) {
    return { ok: false, error: "consumerNo required (Google Form me Consumer No. field)." };
  }

  const key = consumerNo.toUpperCase();
  const parsed = materialsFromGoogleFormBody(body);
  const materials = {
    labourDate: parsed.labourDate,
    panelDetail: parsed.panelDetail,
    inverterDetail: parsed.inverterDetail,
    inverterSerial: parsed.inverterSerial,
    copperWire: parsed.copperWire,
    mainWire: parsed.mainWire,
    stand: parsed.stand,
  };

  const bomRaw = await getKey(BOM_KEY);
  const bomMap = safeParse(bomRaw, {});
  const existing = bomMap[key] || {};
  const items = buildItemsFromMaterials(materials, existing.items || []);

  bomMap[key] = {
    consumerNo: key,
    saleDate: parsed.siteDate || existing.saleDate || "",
    customerName: parsed.customerName || existing.customerName || "",
    address: parsed.address || existing.address || "",
    setupKw: parsed.setupKw || existing.setupKw || "",
    teamWork: parsed.teamWork || existing.teamWork || "",
    materials,
    items,
    totalAmount: fileTotalAmount(items),
    source: "google-form",
    updatedAt: new Date().toISOString(),
  };

  const setupDetail = formatSetupDetail(materials);
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
          teamWork: parsed.teamWork || row.teamWork || "",
          setupKw: parsed.setupKw || row.setupKw || "",
        };
      })
    : [];

  const entries = {
    [BOM_KEY]: JSON.stringify(bomMap),
  };
  if (saleChanged) {
    entries[SALE_KEY] = JSON.stringify(nextSale);
  } else if (Array.isArray(saleRows)) {
    /* Consumer Sale me nahi — sirf BOM update */
  }

  await setMany(entries);

  return {
    ok: true,
    consumerNo: key,
    bomUpdated: true,
    saleUpdated: saleChanged,
    setupDetail,
    materials,
  };
}

export function getGoogleFormWebhookSecret() {
  return String(process.env.GOOGLE_FORM_WEBHOOK_SECRET || "").trim();
}
