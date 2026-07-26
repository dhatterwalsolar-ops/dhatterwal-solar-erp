const GST_INVOICES_KEY = "dhatterwal_gst_invoices";

export function getGstInvoices() {
  try {
    const raw = localStorage.getItem(GST_INVOICES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGstInvoice(invoice) {
  const list = getGstInvoices();
  list.unshift(invoice);
  localStorage.setItem(GST_INVOICES_KEY, JSON.stringify(list));
  return invoice;
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

export function createSaleInvoice({
  consumerNo,
  customerName,
  setupKw,
  date,
  amount,
  withGst,
}) {
  const taxable = Number(amount) || 0;
  const gstAmount = withGst ? Math.round(taxable * 0.18) : 0;
  const total = taxable + gstAmount;

  return {
    id: `INV-${Date.now()}`,
    date,
    consumerNo,
    customerName,
    setupKw,
    taxableAmount: taxable,
    gstAmount,
    totalAmount: total,
    gstType: withGst ? "With GST" : "Without GST",
    monthKey: getMonthKeyFromDate(date),
    createdAt: new Date().toISOString(),
  };
}
