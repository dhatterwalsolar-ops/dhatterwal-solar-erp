import {
  clearedNetMeterInvoiceFields,
  clearedSaleInvoiceFields,
} from "./tempInvoiceDelete";
import {
  listCustomerDocuments,
  removeCustomerDocument,
} from "./customerDocuments";
import {
  notifyPaymentSync,
  removeAllSaleInvoicePayments,
} from "./customerPaymentLedger";
import { flushErpPushNow } from "./erpStorage";
import { clearAllInvoiceFileRecords } from "./invoiceStorage";
import { loadSaleCaseRows, saveSaleCaseRows } from "./saleCaseStorage";
import { SALE_CASE_SYNC_EVENT } from "./saleCaseSync";

function normalizeConsumerNo(value) {
  return String(value || "").trim().toUpperCase();
}

function removeInvoiceDocsForConsumers(consumerNos) {
  let removed = 0;
  consumerNos.forEach((cn) => {
    const docs = listCustomerDocuments(cn, { source: "sale" });
    docs.forEach((doc) => {
      const isInvoiceDoc =
        doc.category === "sale-invoice" ||
        doc.category === "eway-bill" ||
        String(doc.folder || "").includes("/Invoices/");
      if (!isInvoiceDoc) return;
      removeCustomerDocument(doc.id);
      removed += 1;
    });
  });
  return removed;
}

/**
 * Saari purani invoices delete — Invoice File + Sale fields + sale payments + invoice docs.
 * Admin nayi series se dubara invoice bana sake.
 */
export function clearAllInvoicesForFreshStart() {
  const { count, invoices } = clearAllInvoiceFileRecords();

  const consumerNos = [
    ...new Set(
      invoices
        .map((inv) => normalizeConsumerNo(inv.consumerNo))
        .filter(Boolean),
    ),
  ];

  const saleRows = loadSaleCaseRows();
  const clearedSales = saleRows.map((row) =>
    clearedNetMeterInvoiceFields(clearedSaleInvoiceFields(row, { keepReserved: false }), {
      keepReserved: false,
    }),
  );
  saveSaleCaseRows(clearedSales, { syncBom: false, syncCustomerDetail: true });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SALE_CASE_SYNC_EVENT));
  }

  const paymentsRemoved = removeAllSaleInvoicePayments();
  notifyPaymentSync();
  const docsRemoved = removeInvoiceDocsForConsumers(consumerNos);
  flushErpPushNow();

  return {
    ok: true,
    invoiceCount: count,
    paymentsRemoved,
    docsRemoved,
    consumersTouched: consumerNos.length,
  };
}
