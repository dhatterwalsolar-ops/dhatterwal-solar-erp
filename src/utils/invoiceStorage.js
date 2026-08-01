import { buildSeriesPreview } from "../constants/settingsDefaults";
import {
  buildInvoiceComputation,
  buildNetMeterInvoiceComputation,
} from "./saleInvoiceCompute";
import { getInvoiceFormat } from "./invoiceFormatStorage";
import { getSettingsState, saveInvoiceSeries } from "./settingsStorage";
import { erpGetItem, erpRemoveItem, erpSetItem } from "./erpStorage";

const INVOICE_FILE_KEY = "dhatterwal_invoice_file";

export const INVOICE_FILE_SYNC_EVENT = "dhatterwal-invoice-file-sync";

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readInvoiceFile() {
  return safeParse(erpGetItem(INVOICE_FILE_KEY), []);
}

function writeInvoiceFile(list) {
  try {
    erpSetItem(INVOICE_FILE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(INVOICE_FILE_SYNC_EVENT));
  } catch {
    /* ignore */
  }
}

function incrementSeriesNumber(nextNumber) {
  const text = String(nextNumber ?? "1");
  const width = Math.max(text.length, 1);
  const num = (parseInt(text, 10) || 0) + 1;
  return String(num).padStart(width, "0");
}

export function peekNextInvoiceSerial() {
  const state = getSettingsState();
  return buildSeriesPreview(state.invoiceSeries);
}

export function allocateNextInvoiceSerial() {
  const state = getSettingsState();
  const series = state.invoiceSeries;
  const serialNo = buildSeriesPreview(series);
  saveInvoiceSeries({
    ...series,
    nextNumber: incrementSeriesNumber(series.nextNumber),
  });
  return serialNo;
}

export function getInvoiceFileRecords() {
  return readInvoiceFile()
    .slice()
    .sort((a, b) => (a.srNo || 0) - (b.srNo || 0));
}

export function getInvoiceById(id) {
  if (!id) return null;
  return readInvoiceFile().find((inv) => inv.id === id) || null;
}

export function getInvoiceByNo(invoiceNo) {
  const key = String(invoiceNo || "").trim();
  if (!key) return null;
  return readInvoiceFile().find((inv) => String(inv.invoiceNo).trim() === key) || null;
}

export function getGstInvoices() {
  return getInvoiceFileRecords().filter((inv) => inv.withGst);
}

export function getMonthKeyFromDate(dateStr) {
  const parts = String(dateStr || "").split(/[/-]/);
  if (parts.length !== 3) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  const [d, month, year] = parts;
  if (String(year).length === 4) {
    return `${year}-${String(month).padStart(2, "0")}`;
  }
  return `${d}-${String(month).padStart(2, "0")}`;
}

function formatInvoiceDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

/**
 * Push invoice into Invoice File.
 * - Default: allocates next Settings invoice series + today's date (With GST / Net Meter).
 * - reuseInvoiceNo + reuseDate: Without GST — same number/date as Net Meter (no series bump).
 */
function pushInvoiceRecord(fields) {
  const list = readInvoiceFile();
  const srNo = list.length + 1;
  const reuseNo = String(fields.reuseInvoiceNo || "").trim();
  const reuseDate = String(fields.reuseDate || "").trim();
  const invoiceNo = reuseNo || allocateNextInvoiceSerial();
  const generateDate = reuseDate || formatInvoiceDate();
  const { reuseInvoiceNo: _r1, reuseDate: _r2, ...rest } = fields;
  const internalId = rest.id || `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const invoice = {
    ...rest,
    id: internalId,
    srNo,
    bookNo: rest.bookNo || srNo,
    invoiceNo,
    date: generateDate,
    monthKey: getMonthKeyFromDate(generateDate),
    createdAt: new Date().toISOString(),
    generatedAt: new Date().toLocaleString("en-IN"),
    ewayBillNo: rest.ewayBillNo || "",
    ewayDistanceKm: rest.ewayDistanceKm || "",
    ewayValidUpto: rest.ewayValidUpto || "",
    ewayGeneratedAt: rest.ewayGeneratedAt || "",
  };
  list.push(invoice);
  writeInvoiceFile(list);
  return invoice;
}

/** Net Meter invoice numbers already used for a Without GST invoice. */
export function getUsedNetMeterNumbersForWithoutGst() {
  const used = new Set();
  readInvoiceFile().forEach((inv) => {
    if (inv.invoiceKind === "net-meter") return;
    if (inv.withGst) return;
    if (inv.linkedNetMeterInvoiceNo) {
      used.add(String(inv.linkedNetMeterInvoiceNo).trim());
    }
    if (inv.invoiceNo) {
      used.add(String(inv.invoiceNo).trim());
    }
  });
  return used;
}

/**
 * Net Meter invoices available to pair with Without GST
 * (not yet used on any Without GST invoice).
 */
export function listAvailableNetMeterInvoicesForWithoutGst({
  query = "",
  consumerNo = "",
} = {}) {
  const used = getUsedNetMeterNumbersForWithoutGst();
  const q = String(query || "").trim().toLowerCase();
  const cn = String(consumerNo || "").trim().toUpperCase();
  return getInvoiceFileRecords()
    .filter((inv) => inv.invoiceKind === "net-meter")
    .filter((inv) => !used.has(String(inv.invoiceNo || "").trim()))
    .filter((inv) => {
      if (!cn) return true;
      return String(inv.consumerNo || "").trim().toUpperCase() === cn;
    })
    .filter((inv) => {
      if (!q) return true;
      return (
        String(inv.invoiceNo || "").toLowerCase().includes(q) ||
        String(inv.customerName || "").toLowerCase().includes(q) ||
        String(inv.consumerNo || "").toLowerCase().includes(q) ||
        String(inv.date || "").includes(q)
      );
    });
}

export function getNetMeterInvoiceByNo(invoiceNo) {
  const key = String(invoiceNo || "").trim();
  if (!key) return null;
  return (
    readInvoiceFile().find(
      (inv) => inv.invoiceKind === "net-meter" && String(inv.invoiceNo).trim() === key,
    ) || null
  );
}

/**
 * Issue invoice matching official Tax Invoice stationery fields.
 * Without GST: pass linkedNetMeterInvoiceNo — reuses that Net Meter number + date (no series bump).
 */
export function issueSaleInvoice({
  consumerNo,
  customerName,
  fatherName,
  address,
  mobile,
  setupKw,
  amount,
  withGst,
  pinCode,
  station,
  panelName,
  inverterName,
  inverterSerial,
  vehicleNo,
  saleRowId,
  transport,
  bookNo,
  linkedNetMeterInvoiceNo,
}) {
  const format = getInvoiceFormat();
  const computation = buildInvoiceComputation({
    taxableAmount: amount,
    amountInclusive: Boolean(withGst),
    withGst: Boolean(withGst),
    panelName,
    inverterName,
    inverterSerial,
    setupKw,
    format,
  });

  let reuseInvoiceNo = "";
  let reuseDate = "";
  let linkedId = "";
  let linkedNo = "";

  if (!withGst) {
    const nmNo = String(linkedNetMeterInvoiceNo || "").trim();
    if (!nmNo) {
      throw new Error("Without GST ke liye Net Meter Invoice number select karein.");
    }
    const used = getUsedNetMeterNumbersForWithoutGst();
    if (used.has(nmNo)) {
      throw new Error(
        `Invoice number ${nmNo} pehle se Without GST me use ho chuka hai — dubara nahi katega.`,
      );
    }
    const nm = getNetMeterInvoiceByNo(nmNo);
    if (!nm) {
      throw new Error(`Net Meter Invoice ${nmNo} nahi mili.`);
    }
    reuseInvoiceNo = nm.invoiceNo;
    reuseDate = nm.date;
    linkedId = nm.id;
    linkedNo = nm.invoiceNo;
  }

  return pushInvoiceRecord({
    bookNo,
    invoiceKind: "sale",
    consumerNo,
    customerName,
    fatherName: fatherName || "",
    address: address || "",
    mobile: mobile || "",
    setupKw,
    taxableAmount: computation.taxableAmount,
    gstAmount: computation.gstAmount,
    totalAmount: computation.totalAmount,
    withGst: Boolean(withGst),
    gstType: withGst ? "With GST" : "Without GST",
    pinCode: String(pinCode || "").trim(),
    station: String(station || "").trim(),
    panelName: String(panelName || "").trim(),
    inverterName: String(inverterName || "").trim(),
    inverterSerial: String(inverterSerial || "").trim(),
    vehicleNo: String(vehicleNo || "").trim().toUpperCase(),
    transport: String(transport || format.transportDefault).trim().toUpperCase(),
    placeOfSupply: format.placeOfSupply,
    reverseCharge: format.reverseCharge,
    saleRowId: saleRowId || "",
    linkedNetMeterInvoiceId: linkedId,
    linkedNetMeterInvoiceNo: linkedNo,
    reuseInvoiceNo,
    reuseDate,
    lines: computation.lines,
    taxRows: computation.taxRows,
    hsnSummary: computation.hsnSummary,
    totalQty: computation.totalQty,
    amountInWords: computation.amountInWords,
  });
}

/** Net Meter Tax Invoice (optional, after main sale invoice). */
export function issueNetMeterInvoice({
  consumerNo,
  customerName,
  fatherName,
  address,
  mobile,
  setupKw,
  pinCode,
  station,
  vehicleNo,
  saleRowId,
  itemName,
  meterSrNo,
  applicationNo,
  meterCompanyName,
  hsn,
  amount,
  gstPercent,
  transport,
  bookNo,
}) {
  const format = getInvoiceFormat();
  const computation = buildNetMeterInvoiceComputation({
    itemName,
    meterSrNo,
    applicationNo,
    meterCompanyName,
    hsn,
    amount,
    gstPercent,
  });

  return pushInvoiceRecord({
    bookNo,
    invoiceKind: "net-meter",
    consumerNo,
    customerName,
    fatherName: fatherName || "",
    address: address || "",
    mobile: mobile || "",
    setupKw: setupKw || "",
    taxableAmount: computation.taxableAmount,
    gstAmount: computation.gstAmount,
    totalAmount: computation.totalAmount,
    withGst: computation.withGst,
    gstType: computation.withGst ? "With GST" : "Without GST",
    pinCode: String(pinCode || "").trim(),
    station: String(station || "").trim(),
    panelName: "",
    inverterName: "",
    inverterSerial: "",
    vehicleNo: String(vehicleNo || "").trim().toUpperCase(),
    transport: String(transport || format.transportDefault).trim().toUpperCase(),
    placeOfSupply: format.placeOfSupply,
    reverseCharge: format.reverseCharge,
    saleRowId: saleRowId || "",
    itemName: String(itemName || "").trim(),
    meterSrNo: String(meterSrNo || "").trim(),
    applicationNo: String(applicationNo || "").trim(),
    meterCompanyName: String(meterCompanyName || "").trim(),
    hsn: computation.lines[0]?.hsn || "",
    gstPercent: Number(gstPercent) || 0,
    lines: computation.lines,
    taxRows: computation.taxRows,
    hsnSummary: computation.hsnSummary,
    totalQty: computation.totalQty,
    amountInWords: computation.amountInWords,
  });
}

export function updateInvoiceRecord(invoiceId, patch) {
  const list = readInvoiceFile();
  const idx = list.findIndex((inv) => inv.id === invoiceId);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...patch };
  writeInvoiceFile(list);
  return list[idx];
}

export function attachEwayBillToInvoice(invoiceId, eway) {
  return updateInvoiceRecord(invoiceId, {
    ewayBillNo: eway.ewayBillNo,
    ewayDistanceKm: String(eway.distanceKm ?? ""),
    ewayValidUpto: eway.validUpto || "",
    ewayGeneratedAt: new Date().toLocaleString("en-IN"),
  });
}

/** GST E-Invoice IRN attach (API se). */
export function attachEinvoiceToInvoice(invoiceId, einv) {
  return updateInvoiceRecord(invoiceId, {
    irn: einv.irn || "",
    ackNo: einv.ackNo || "",
    ackDate: einv.ackDate || "",
    einvoiceProvider: einv.provider || "",
    einvoiceGeneratedAt: new Date().toLocaleString("en-IN"),
  });
}

/**
 * Delete invoice record + renumber Sr. No.
 * Returns deleted invoice or null.
 */
export function deleteInvoiceRecord(invoiceId) {
  if (!invoiceId) return null;
  const list = readInvoiceFile();
  const idx = list.findIndex((inv) => inv.id === invoiceId);
  if (idx < 0) return null;
  const [removed] = list.splice(idx, 1);
  const renumbered = list.map((inv, i) => ({ ...inv, srNo: i + 1, bookNo: inv.bookNo || i + 1 }));
  writeInvoiceFile(renumbered);
  return removed;
}

/** Invoice File bilkul khali — naya series se start. */
export function clearAllInvoiceFileRecords() {
  const previous = readInvoiceFile();
  writeInvoiceFile([]);
  return { count: previous.length, invoices: previous };
}

export function findInvoiceForSaleRow(row) {
  if (!row) return null;
  if (row.invoiceId) {
    const byId = getInvoiceById(row.invoiceId);
    if (byId) return byId;
  }
  if (row.invoiceNo) {
    const byNo = getInvoiceByNo(row.invoiceNo);
    if (byNo) return byNo;
  }
  return null;
}

export function findNetMeterInvoiceForSaleRow(row) {
  if (!row) return null;
  if (row.netMeterInvoiceId) {
    const byId = getInvoiceById(row.netMeterInvoiceId);
    if (byId) return byId;
  }
  if (row.netMeterInvoiceNo) {
    const byNo = getInvoiceByNo(row.netMeterInvoiceNo);
    if (byNo) return byNo;
  }
  return null;
}
