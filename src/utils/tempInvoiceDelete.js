import { removePaymentBySourceRef, notifyPaymentSync } from "./customerPaymentLedger";
import {
  listCustomerDocuments,
  removeCustomerDocument,
} from "./customerDocuments";
import { deleteInvoiceRecord, getInvoiceById } from "./invoiceStorage";
import { flushErpPushNow } from "./erpStorage";

function normalizeConsumerNo(value) {
  return String(value || "").trim().toUpperCase();
}

function removeInvoiceFolderDocs(consumerNo, invoiceNo) {
  const cn = normalizeConsumerNo(consumerNo);
  if (!cn) return;
  const safe = String(invoiceNo || "").replace(/[^\w/-]+/g, "_");
  const docs = listCustomerDocuments(cn, { source: "sale" });
  docs.forEach((doc) => {
    const isInvoiceDoc =
      doc.category === "sale-invoice" ||
      doc.category === "eway-bill" ||
      String(doc.folder || "").includes("/Invoices/");
    if (!isInvoiceDoc) return;
    if (safe && String(doc.fileName || "").includes(safe)) {
      removeCustomerDocument(doc.id);
      return;
    }
    if (safe && String(doc.folder || "").includes(safe)) {
      removeCustomerDocument(doc.id);
    }
  });
}

/**
 * Clear invoice / e-way fields from a sale row object.
 * keepReserved: dubara generate pe wahi Invoice No. reuse (series mat badhao).
 */
export function clearedSaleInvoiceFields(row = {}, { keepReserved = true } = {}) {
  const keepNo = String(row.invoiceNo || row.reservedInvoiceNo || "").trim();
  const keepDate = String(row.invoiceDate || row.reservedInvoiceDate || "").trim();
  return {
    ...row,
    invoiceId: "",
    invoiceNo: "",
    invoiceWithGst: undefined,
    invoiceGstType: "",
    invoiceDate: "",
    ewayBillNo: "",
    ewayDistanceKm: "",
    ewayValidUpto: "",
    irn: "",
    reservedInvoiceNo: keepReserved ? keepNo : "",
    reservedInvoiceDate: keepReserved ? keepDate : "",
  };
}

/** Clear net-meter invoice / e-way fields only. */
export function clearedNetMeterInvoiceFields(row = {}, { keepReserved = true } = {}) {
  const keepNo = String(row.netMeterInvoiceNo || row.reservedNetMeterInvoiceNo || "").trim();
  return {
    ...row,
    netMeterInvoiceId: "",
    netMeterInvoiceNo: "",
    netMeterEwayBillNo: "",
    netMeterEwayDistanceKm: "",
    netMeterEwayValidUpto: "",
    reservedNetMeterInvoiceNo: keepReserved ? keepNo : "",
  };
}

/**
 * Ek invoice delete — Invoice File + payment + folder docs.
 * Sale rows caller clear kare (clearSaleRowsForInvoice).
 */
export function deleteInvoiceCompletely(invoiceId) {
  const existing = getInvoiceById(invoiceId);
  if (!existing) {
    return { ok: false, error: "Invoice nahi mili." };
  }

  const removed = deleteInvoiceRecord(invoiceId);
  if (!removed) {
    return { ok: false, error: "Delete fail." };
  }

  removePaymentBySourceRef(`sale-${invoiceId}`);
  removePaymentBySourceRef(`sale-nm-${invoiceId}`);
  notifyPaymentSync();
  removeInvoiceFolderDocs(removed.consumerNo, removed.invoiceNo);
  flushErpPushNow();

  return { ok: true, invoice: removed };
}

/** @deprecated use deleteInvoiceCompletely */
export function deleteOldInvoiceCompletely(invoiceId) {
  return deleteInvoiceCompletely(invoiceId);
}
