import { buildSeriesPreview } from "../constants/settingsDefaults";
import { getSettingsState, saveInvoiceSeries } from "./settingsStorage";

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
  return safeParse(localStorage.getItem(INVOICE_FILE_KEY), []);
}

function writeInvoiceFile(list) {
  try {
    localStorage.setItem(INVOICE_FILE_KEY, JSON.stringify(list));
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

/** Next invoice number from Settings → Invoice Series (increments on each generate). */
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

export function getGstInvoices() {
  return getInvoiceFileRecords().filter((inv) => inv.withGst);
}

export function getMonthKeyFromDate(dateStr) {
  const parts = String(dateStr || "").split("/");
  if (parts.length !== 3) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  const [, month, year] = parts;
  return `${year}-${month.padStart(2, "0")}`;
}

/**
 * Issue invoice: Sr. No. follows generate order (not sale row order).
 * Same sale date but generated later → higher Sr. No. and next serial from series.
 */
export function issueSaleInvoice({
  consumerNo,
  customerName,
  fatherName,
  address,
  setupKw,
  amount,
  withGst,
}) {
  const taxable = Number(amount) || 0;
  const gstAmount = withGst ? Math.round(taxable * 0.18) : 0;
  const total = taxable + gstAmount;
  const list = readInvoiceFile();
  const srNo = list.length + 1;
  const invoiceNo = allocateNextInvoiceSerial();
  const internalId = `inv-${Date.now()}`;
  const generateDate = new Date().toLocaleDateString("en-GB");

  const invoice = {
    id: internalId,
    srNo,
    invoiceNo,
    date: generateDate,
    consumerNo,
    customerName,
    fatherName: fatherName || "",
    address: address || "",
    setupKw,
    taxableAmount: taxable,
    gstAmount,
    totalAmount: total,
    withGst: Boolean(withGst),
    gstType: withGst ? "With GST" : "Without GST",
    monthKey: getMonthKeyFromDate(generateDate),
    createdAt: new Date().toISOString(),
    generatedAt: new Date().toLocaleString("en-IN"),
  };

  list.push(invoice);
  writeInvoiceFile(list);
  return invoice;
}
