import { jsPDF } from "jspdf";
import {
  COMPANY_LETTERHEAD,
  GENERATE_FILE_TABS,
} from "../constants/generateCaseFiles";
import { getBomMaterialsForConsumer } from "./bomSheetStorage";
import {
  addCustomerDocument,
  listCustomerDocuments,
  removeCustomerDocument,
} from "./customerDocuments";
import { formatVendorPartyName } from "./vendorAgreementPdf";
import { listSiteOrders } from "./siteOrderStorage";

function formatDateSlash(dateStr) {
  const raw = String(dateStr || "").trim();
  const parts = raw.replace(/[./]/g, "-").split("-").filter(Boolean);
  if (parts.length === 3) {
    const d = parts[0].padStart(2, "0");
    const m = parts[1].padStart(2, "0");
    let y = parts[2];
    if (y.length === 2) y = `20${y}`;
    return `${d}/${m}/${y}`;
  }
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${now.getFullYear()}`;
}

function formatDateDash(dateStr) {
  return formatDateSlash(dateStr).replace(/\//g, "-");
}

function findSiteOrderForConsumer(consumerNo) {
  const key = String(consumerNo || "")
    .trim()
    .toUpperCase();
  if (!key) return null;
  const orders = listSiteOrders().filter(
    (o) => String(o.consumerNo || "").trim().toUpperCase() === key,
  );
  return (
    orders.find((o) => o.formPayload) ||
    orders.find((o) => o.status === "submitted") ||
    orders[0] ||
    null
  );
}

/** "LUMINOUS DCR PANEL" / "LUMINOUS 03 KW ONGRID × 1" → LUMINOUS */
export function extractBrandFirstName(itemName) {
  const raw = String(itemName || "")
    .replace(/×.*$/i, "")
    .replace(/—.*$/i, "")
    .trim();
  if (!raw) return "";
  const first = raw.split(/\s+/).find((w) => w && !/^\d+$/.test(w)) || "";
  return first.toUpperCase();
}

/** Setup KW normalize → "02 KW" / "03 KW" / "05 KW" */
export function formatSetupKwLabel(setupKw) {
  const s = String(setupKw || "").replace(/\s/g, "").toUpperCase();
  if (s.includes("05")) return "05 KW";
  if (s.includes("03")) return "03 KW";
  if (s.includes("02")) return "02 KW";
  const t = String(setupKw || "").trim();
  return t || "—";
}

/**
 * Certificate names:
 * Module = panel ka first name (LUMINOUS DCR PANEL → LUMINOUS)
 * Inverter = brand + Setup KW (LUMINOUS 03 KW ONGRID + setup 05 KW → LUMINOUS 05 KW)
 */
export function formatCertificateProductNames({ panelRaw, inverterRaw, setupKw }) {
  const kw = formatSetupKwLabel(setupKw);
  const panelBrand = extractBrandFirstName(panelRaw) || "—";
  const inverterBrand = extractBrandFirstName(inverterRaw) || panelBrand;
  const inverterName =
    inverterBrand && inverterBrand !== "—"
      ? `${inverterBrand} ${kw === "—" ? "" : kw}`.trim()
      : kw;
  return {
    panelName: panelBrand,
    inverterName,
    setupKw: kw,
  };
}

/** Team Leader form product names first, then BOM Sheet — certificate format applied. */
export function resolveCaseFileProducts(consumerNo, setupKw) {
  const bom = getBomMaterialsForConsumer(consumerNo) || {};
  const site = findSiteOrderForConsumer(consumerNo);
  const payload = site?.formPayload || {};

  const panelRaw = String(
    payload.panelName || payload.panelProductName || bom.panelDetail || "",
  ).trim();
  const inverterRaw = String(
    payload.inverterName || bom.inverterDetail || "",
  ).trim();
  const formatted = formatCertificateProductNames({
    panelRaw,
    inverterRaw,
    setupKw: setupKw || site?.setupKw || "",
  });

  const inverterSerial = String(
    payload.inverterSerial || bom.inverterSerial || "",
  ).trim();
  const wireLines = Array.isArray(payload.wireLines) ? payload.wireLines : [];
  const dcWire =
    String(payload.dcWireName || "").trim() ||
    wireLines.find((w) => /dc/i.test(String(w?.itemName || "")))?.itemName ||
    bom.copperWire ||
    "—";
  const acWire =
    String(payload.mainWireName || "").trim() ||
    wireLines.find((w) => /ac|main/i.test(String(w?.itemName || "")))?.itemName ||
    bom.mainWire ||
    "—";

  const moduleCount =
    Number(payload.panelQty) > 0
      ? String(payload.panelQty)
      : Array.isArray(payload.panelSerials) &&
          payload.panelSerials.filter(Boolean).length
        ? String(payload.panelSerials.filter(Boolean).length)
        : "";

  return {
    panelName: formatted.panelName,
    inverterName: formatted.inverterName,
    inverterSerial,
    dcWire,
    acWire,
    moduleCount: moduleCount || "—",
    setupKw: formatted.setupKw,
    panelRaw,
    inverterRaw,
    source: payload.panelName || payload.inverterName ? "team-leader" : "bom",
    siteOrderId: site?.id || null,
  };
}

function newDoc() {
  return new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
}

function writeWrapped(doc, text, x, y, maxW, lineH = 5.2) {
  const lines = doc.splitTextToSize(String(text || ""), maxW);
  doc.text(lines, x, y);
  return y + lines.length * lineH;
}

function ensureSpace(doc, y, need = 20) {
  if (y > 280 - need) {
    doc.addPage();
    return 18;
  }
  return y;
}

function drawKvRow(doc, label, value, y, x = 18, labelW = 70) {
  y = ensureSpace(doc, y, 10);
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.text(label, x, y);
  doc.setFont("times", "bold");
  const lines = doc.splitTextToSize(String(value || "—"), 210 - x - labelW - 10);
  doc.text(lines, x + labelW, y);
  return y + Math.max(1, lines.length) * 5.2 + 1;
}

function buildWorkCompletionPdf(ctx) {
  const doc = newDoc();
  const { partyName, address, consumerNo, products, dateSlash, discom, subdivision } = ctx;
  let y = 18;

  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.text("ANNEXURE-VIII", 105, y, { align: "center" });
  y += 8;
  doc.setFontSize(12);
  y = writeWrapped(
    doc,
    "The Work Completion Report for installation of Solar Roof Top PV System under net metering arrangement",
    18,
    y,
    174,
    5.5,
  );
  y += 2;
  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.text("(To be filled by the applicant and empanelled contractor)", 105, y, { align: "center" });
  y += 8;

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.text("To,", 18, y);
  y += 6;
  doc.text(`SDO/OP Sub Division ${discom}`, 18, y);
  y += 6;
  doc.setFont("times", "bold");
  doc.text(subdivision, 18, y);
  y += 8;

  doc.setFont("times", "bold");
  doc.text("Subject:", 18, y);
  doc.setFont("times", "normal");
  y = writeWrapped(
    doc,
    "Regarding submission of work completion report for installation of Solar Roof Top PV System under net metering arrangement.",
    38,
    y,
    154,
  );
  y += 3;
  y = writeWrapped(
    doc,
    `Reference: Consumer / Application No.: ${consumerNo} dated: ${dateSlash}`,
    18,
    y,
    174,
  );
  y += 3;
  y = writeWrapped(
    doc,
    `Enclosed please find herewith the work completion report. Beneficiary: ${partyName}, Address: ${address}.`,
    18,
    y,
    174,
  );
  y += 6;

  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("Solar PV System Module Detail", 18, y);
  y += 6;
  y = drawKvRow(doc, "a. Manufacturer / Make", products.panelName, y);
  y = drawKvRow(doc, "b. Capacity / Setup", products.setupKw || "—", y);
  y = drawKvRow(doc, "c. No. of Modules", products.moduleCount, y);
  y = drawKvRow(doc, "d. Total Capacity (kWp)", products.setupKw || "—", y);
  y += 3;

  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("Inverter Installed Detail", 18, y);
  y += 6;
  y = drawKvRow(doc, "a. Manufacturer / Make", products.inverterName, y);
  y = drawKvRow(doc, "b. AC capacity", products.setupKw || "—", y);
  y = drawKvRow(doc, "c. No. of inverters", "1", y);
  y = drawKvRow(doc, "d. Inverter Serial Nos.", products.inverterSerial || "—", y);
  y += 3;

  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("Cable Details", 18, y);
  y += 6;
  y = drawKvRow(doc, "DC Cables", products.dcWire, y);
  y = drawKvRow(doc, "AC Wiring", products.acWire, y);
  y += 6;

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  y = writeWrapped(doc, `Empanelled Agency: ${COMPANY_LETTERHEAD.name}`, 18, y, 174);
  y += 4;
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text("Filled from ERP customer + Team Leader / BOM products (uploaded Word format).", 18, y);
  doc.setTextColor(0);

  return doc;
}

function buildVendorCompletionPdf(ctx) {
  const doc = newDoc();
  const { partyName, address, products, dateSlash, dateDash, refNo } = ctx;
  let y = 18;

  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text(`GSTIN: ${COMPANY_LETTERHEAD.gstin} (M): ${COMPANY_LETTERHEAD.mobile}`, 105, y, {
    align: "center",
  });
  y += 7;
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text(COMPANY_LETTERHEAD.name, 105, y, { align: "center" });
  y += 6;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text(COMPANY_LETTERHEAD.address, 105, y, { align: "center" });
  y += 10;

  doc.setFontSize(11);
  doc.text(`Ref No. ${refNo}`, 18, y);
  doc.text(`Date - ${dateDash}`, 140, y);
  y += 10;

  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.text("WORK COMPLETION CERTIFICATE", 105, y, { align: "center" });
  y += 10;

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  y = writeWrapped(
    doc,
    `It is to certify that we had installed a Solar Power Plant of ${products.setupKw || "—"} KW On-Grid System at house of ${partyName}, ${address}. In this system we have installed One Inverter of Capacity ${products.setupKw || "—"} KW and Modules of ${products.setupKw || "—"} KW.`,
    18,
    y,
    174,
    5.5,
  );
  y += 6;

  doc.setFont("times", "bold");
  doc.text("Details of Plant is as under:", 18, y);
  y += 7;
  y = drawKvRow(doc, "Name of the Installer", COMPANY_LETTERHEAD.name, y);
  y = drawKvRow(doc, "Name of the Owner", partyName, y);
  y = drawKvRow(doc, "Details of the Solar Module", products.panelName, y);
  y = drawKvRow(doc, "Details of Inverter", products.inverterName, y);
  y += 4;

  y = writeWrapped(
    doc,
    `This is to inform you that the Solar power plant has been completed on ${dateSlash}.`,
    18,
    y,
    174,
  );
  y += 10;
  doc.text("Thanking you.", 18, y);
  y += 6;
  doc.text("Yours Truly,", 18, y);
  y += 8;
  doc.setFont("times", "bold");
  doc.text(COMPANY_LETTERHEAD.name, 18, y);
  y += 6;
  doc.setFont("times", "normal");
  doc.text("Authority Signatory", 18, y);

  return doc;
}

function buildSafetyPdf(ctx) {
  const doc = newDoc();
  const { partyName, address, products, dateDash, discom, subdivision, refNo } = ctx;
  const discomFull =
    discom === "DHBVN"
      ? "Dakshin Haryana Bijli Vitran Nigam"
      : "Uttar Haryana Bijli Vitran Nigam";
  let y = 18;

  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text(`GSTIN: ${COMPANY_LETTERHEAD.gstin} (M): ${COMPANY_LETTERHEAD.mobile}`, 105, y, {
    align: "center",
  });
  y += 7;
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text(COMPANY_LETTERHEAD.name, 105, y, { align: "center" });
  y += 6;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text(COMPANY_LETTERHEAD.address, 105, y, { align: "center" });
  y += 10;

  doc.setFontSize(11);
  doc.text(`Ref. No. ${refNo}`, 18, y);
  doc.text(`Date - ${dateDash}`, 140, y);
  y += 10;

  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.text("SAFETY CERTIFICATE", 105, y, { align: "center" });
  y += 10;

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.text("To", 18, y);
  y += 5;
  doc.text("The SDO", 18, y);
  y += 5;
  doc.text(`${discomFull},`, 18, y);
  y += 5;
  doc.setFont("times", "bold");
  doc.text(`${subdivision}, HARYANA.`, 18, y);
  y += 8;

  doc.setFont("times", "bold");
  doc.text("Subject: Safety Certificate.", 18, y);
  y += 8;

  doc.setFont("times", "normal");
  y = writeWrapped(doc, "Dear sir,", 18, y, 174);
  y += 2;
  y = writeWrapped(
    doc,
    `It is inform you that we had installed a solar power plant of total ${products.setupKw || "—"} KW On-Grid System of ${partyName}, ${address}. In this system we have installed capacity inverter and modules with following details:-`,
    18,
    y,
    174,
    5.5,
  );
  y += 4;

  y = drawKvRow(doc, "Make of inverter", products.inverterName, y);
  y = drawKvRow(doc, "Make of modules", products.panelName, y);
  y = drawKvRow(doc, "Make of wire", `${products.dcWire} / ${products.acWire}`, y);
  y = drawKvRow(doc, "Inverter Serial", products.inverterSerial || "—", y);
  y = drawKvRow(doc, "Number of Earthing", "3 Nos", y);
  y = drawKvRow(doc, "Surge protection Device", "1 set DC Side inbuilt and 1 set at AC Side", y);
  y += 4;

  y = writeWrapped(
    doc,
    `We ${COMPANY_LETTERHEAD.name} KALAYAT Certify that this system is installed as per MNRE guide lines and is safe (All the safety measures are being taken care of).`,
    18,
    y,
    174,
    5.5,
  );
  y += 10;
  doc.text("Thanking you,", 18, y);
  y += 6;
  doc.text("Regards", 18, y);
  y += 8;
  doc.setFont("times", "bold");
  doc.text(COMPANY_LETTERHEAD.name, 18, y);
  y += 5;
  doc.setFont("times", "normal");
  doc.text(COMPANY_LETTERHEAD.mobile, 18, y);

  return doc;
}

function pdfToFile(doc, filePrefix, consumerNo) {
  const fileName = `${filePrefix}-${consumerNo || "customer"}.pdf`;
  const blob = doc.output("blob");
  const dataUrl = doc.output("datauristring");
  return {
    blob,
    dataUrl,
    fileName,
    mimeType: "application/pdf",
  };
}

export function buildGenerateCaseContext(row, { discom, subdivision }) {
  const consumerNo = String(row?.consumerNo || "").trim();
  const products = resolveCaseFileProducts(consumerNo, row?.setupKw);
  const partyName =
    formatVendorPartyName(row?.customerName, row?.fatherName, row?.nameRelation || "S/O") ||
    String(row?.customerName || "")
      .trim()
      .toUpperCase();
  const address = String(row?.address || "")
    .trim()
    .toUpperCase();
  const dateSlash = formatDateSlash(row?.date);
  const dateDash = formatDateDash(row?.date);
  const refNo = `DS-${consumerNo.slice(-4) || "0000"}`;

  return {
    consumerNo,
    partyName,
    address,
    products,
    dateSlash,
    dateDash,
    discom: discom || "UHBVN",
    subdivision: subdivision || "",
    refNo,
    customerName: row?.customerName || "",
    fatherName: row?.fatherName || "",
    nameRelation: row?.nameRelation || "S/O",
  };
}

const FILE_BUILDERS = {
  wcr: buildWorkCompletionPdf,
  vendorCert: buildVendorCompletionPdf,
  safety: buildSafetyPdf,
};

export function generateAllCaseFiles(row, options) {
  return generateSelectedCaseFiles(row, options, ["wcr", "vendorCert", "safety"]);
}

/**
 * Selected certificates only (Sale Sheet: Safety + Work Completion).
 * @param {string[]} keys — "wcr" | "safety" | "vendorCert"
 */
export function generateSelectedCaseFiles(row, options, keys = []) {
  const ctx = buildGenerateCaseContext(row, options);
  if (!ctx.consumerNo) throw new Error("Consumer No. zaroori hai.");
  if (!ctx.partyName) throw new Error("Customer Name zaroori hai.");
  if (!String(options?.subdivision || "").trim()) {
    throw new Error("Sub Division Name bharna zaroori hai.");
  }
  if (!options?.discom) {
    throw new Error("Discom select karein (UHBVN / DHBVN).");
  }

  const want = new Set((keys || []).filter(Boolean));
  if (!want.size) {
    throw new Error("Kam se kam 1 certificate select karein.");
  }

  const files = GENERATE_FILE_TABS.filter((t) => t.key && want.has(t.key)).map((tab) => {
    const builder = FILE_BUILDERS[tab.key];
    if (!builder) throw new Error(`Unknown file type: ${tab.key}`);
    const pdfDoc = builder(ctx);
    const file = pdfToFile(pdfDoc, tab.filePrefix, ctx.consumerNo);
    return { ...file, tabId: tab.id, category: tab.category, label: tab.label };
  });

  return { ctx, files };
}

export function downloadCaseFile(file) {
  const url = URL.createObjectURL(file.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function saveCaseFilesToFolder(result, source = "loan") {
  if (!result?.ctx?.consumerNo || !result?.files?.length) return [];
  const consumerNo = result.ctx.consumerNo;
  const subfolder = "GenerateFiles";
  const categories = result.files.map((f) => f.category);

  const existing = listCustomerDocuments(consumerNo, { source: "loan" })
    .concat(listCustomerDocuments(consumerNo, { source: "cash" }))
    .concat(listCustomerDocuments(consumerNo, { source: "sale" }));
  existing
    .filter((d) => categories.includes(d.category))
    .forEach((d) => removeCustomerDocument(d.id));

  const saved = [];
  for (const file of result.files) {
    try {
      const doc = await addCustomerDocument({
        consumerNo,
        source,
        category: file.category,
        fileName: file.fileName,
        mimeType: "application/pdf",
        dataUrl: file.dataUrl,
        subfolder,
      });
      saved.push(doc);
    } catch {
      /* ignore quota */
    }
  }
  return saved;
}
