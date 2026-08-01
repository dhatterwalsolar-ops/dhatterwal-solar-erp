/** Item / invoice amount above this requires E-Way Bill. */
export const EWAY_ITEM_AMOUNT_LIMIT = 49999;

export function amountNeedsEwayBill(amount) {
  return Number(amount) > EWAY_ITEM_AMOUNT_LIMIT;
}

/** Sale With GST ya Net Meter (GST) invoice — inhi pe E-Way ban sakta hai. */
export function invoiceIsGstInvoice(invoice) {
  if (!invoice) return false;
  if (invoice.invoiceKind === "net-meter") return true;
  return Boolean(invoice.withGst);
}

/** GST invoice hone par E-Way generate allow. */
export function invoiceAllowsEwayBill(invoice) {
  return invoiceIsGstInvoice(invoice);
}

/** True if GST invoice AND amount/line > ₹49,999 — E-Way jaruri. */
export function invoiceNeedsEwayBill(invoice) {
  if (!invoiceAllowsEwayBill(invoice)) return false;
  const lines = Array.isArray(invoice.lines) ? invoice.lines : [];
  if (lines.some((line) => amountNeedsEwayBill(line?.amount))) return true;
  if (amountNeedsEwayBill(invoice.totalAmount)) return true;
  if (amountNeedsEwayBill(invoice.taxableAmount)) return true;
  if (amountNeedsEwayBill(invoice.inputAmount)) return true;
  return false;
}
