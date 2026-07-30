/** Item / invoice amount above this requires E-Way Bill. */
export const EWAY_ITEM_AMOUNT_LIMIT = 49999;

export function amountNeedsEwayBill(amount) {
  return Number(amount) > EWAY_ITEM_AMOUNT_LIMIT;
}

/** True if any line amount OR invoice total exceeds ₹49,999. */
export function invoiceNeedsEwayBill(invoice) {
  if (!invoice) return false;
  const lines = Array.isArray(invoice.lines) ? invoice.lines : [];
  if (lines.some((line) => amountNeedsEwayBill(line?.amount))) return true;
  if (amountNeedsEwayBill(invoice.totalAmount)) return true;
  if (amountNeedsEwayBill(invoice.taxableAmount)) return true;
  if (amountNeedsEwayBill(invoice.inputAmount)) return true;
  return false;
}
