import {
  clearedNetMeterInvoiceFields,
  clearedSaleInvoiceFields,
} from "./tempInvoiceDelete";
import { loadSaleCaseRows, saveSaleCaseRows } from "./saleCaseStorage";
import { SALE_CASE_SYNC_EVENT } from "./saleCaseSync";

/** Sale Sheet se us invoice ke fields hatao. */
export function clearSaleRowsForInvoice(invoice) {
  if (!invoice) return false;
  const rows = loadSaleCaseRows();
  let changed = false;
  const next = rows.map((row) => {
    const isNet = invoice.invoiceKind === "net-meter";
    const match = isNet
      ? (invoice.id && row.netMeterInvoiceId === invoice.id) ||
        (invoice.invoiceNo && row.netMeterInvoiceNo === invoice.invoiceNo)
      : (invoice.id && row.invoiceId === invoice.id) ||
        (invoice.invoiceNo && row.invoiceNo === invoice.invoiceNo);
    if (!match) return row;
    changed = true;
    return isNet ? clearedNetMeterInvoiceFields(row) : clearedSaleInvoiceFields(row);
  });
  if (changed) {
    saveSaleCaseRows(next, { syncBom: false, syncCustomerDetail: true });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(SALE_CASE_SYNC_EVENT));
    }
  }
  return changed;
}
