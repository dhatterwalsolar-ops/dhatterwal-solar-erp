export const PURCHASE_SUPPLIERS = [
  "Waaree Energies Ltd",
  "Growatt India",
  "Adani Solar",
  "Havells India",
  "Polycab Wires",
];

export const INVOICE_TYPES = ["Tax Invoice", "Retail Invoice", "Bill of Supply"];
export const PAYMENT_MODES = ["Credit", "Cash", "UPI", "NEFT / RTGS", "Cheque"];

export const ITEM_CATEGORIES = [
  "SOLAR PANEL",
  "INVERTER",
  "STRUCTURE",
  "WIRE / CABLE",
  "DCDB / ACDB",
  "OTHER",
];

export const ITEM_NAMES_BY_CATEGORY = {
  "SOLAR PANEL": ["Mono 540W Panel", "Mono 550W Panel", "Bifacial 540W"],
  INVERTER: ["3kW On-Grid", "5kW Hybrid", "8kW Hybrid"],
  STRUCTURE: ["GI Structure Kit 3kW", "GI Structure Kit 5kW"],
  "WIRE / CABLE": ["DC Wire 4 sq mm", "AC Wire 6 sq mm"],
  "DCDB / ACDB": ["DCDB Box", "ACDB Box"],
  OTHER: ["Earthing Kit", "LA Kit"],
};

export const UNITS = ["NOS", "MTR", "SET", "KG"];

/** Per line-item GST — optional; 0 = without GST */
export const PURCHASE_GST_OPTIONS = [
  { value: 0, label: "Without GST" },
  { value: 5, label: "GST 5%" },
  { value: 18, label: "GST 18%" },
  { value: 28, label: "GST 28%" },
];

export function purchaseGstLabel(taxRate) {
  const rate = Number(taxRate) || 0;
  const match = PURCHASE_GST_OPTIONS.find((o) => o.value === rate);
  return match?.label ?? (rate ? `GST ${rate}%` : "Without GST");
}

export function normalizePurchaseItemTax(tax) {
  const rate = Number(tax);
  if (!Number.isFinite(rate)) return 0;
  if (rate === 12) return 18;
  const allowed = PURCHASE_GST_OPTIONS.map((o) => o.value);
  return allowed.includes(rate) ? rate : 0;
}

export const SAMPLE_PURCHASE_ITEMS = [
  {
    id: "pi-1",
    category: "SOLAR PANEL",
    itemName: "Mono 550W Panel",
    hsn: "85414011",
    serialNumbers: "WA-550-77821\nWA-550-77822",
    qty: 100,
    unit: "NOS",
    rate: 12500,
    tax: 18,
  },
  {
    id: "pi-2",
    category: "INVERTER",
    itemName: "5kW Hybrid",
    hsn: "85044090",
    serialNumbers: "GRW-5K-99214",
    qty: 10,
    unit: "NOS",
    rate: 42000,
    tax: 18,
  },
];

export const RECENT_PURCHASES = [
  { no: "PINV-2407-018", date: "24/07/2025", amount: 219240 },
  { no: "PINV-2407-017", date: "22/07/2025", amount: 98500 },
  { no: "PINV-2407-016", date: "20/07/2025", amount: 156800 },
];

export function calcLineAmount(item) {
  const base = item.qty * item.rate;
  const taxRate = normalizePurchaseItemTax(item.tax);
  const withTax = base + (base * taxRate) / 100;
  return Math.round(withTax * 100) / 100;
}

export function calcPurchaseTotals(items) {
  let subTotal = 0;
  let taxTotal = 0;
  let totalQty = 0;

  items.forEach((item) => {
    const base = item.qty * item.rate;
    const taxRate = normalizePurchaseItemTax(item.tax);
    const tax = (base * taxRate) / 100;
    subTotal += base;
    taxTotal += tax;
    totalQty += Number(item.qty) || 0;
  });

  const grand = subTotal + taxTotal;
  return {
    itemCount: items.length,
    totalQty,
    subTotal: Math.round(subTotal * 100) / 100,
    taxTotal: Math.round(taxTotal * 100) / 100,
    grandTotal: Math.round(grand * 100) / 100,
    roundOff: Math.round(grand) - grand,
    grandRounded: Math.round(grand),
  };
}

export function createEmptyPurchaseItem() {
  return {
    id: `pi-${Date.now()}`,
    productId: "",
    category: "",
    itemName: "",
    hsn: "",
    serialNumbers: "",
    qty: 1,
    unit: "NOS",
    rate: 0,
    tax: 0,
  };
}

/** Purchase history / stock sync ke liye line items */
export function serializePurchaseLineItems(items) {
  return (items || []).map((row) => ({
    productId: row.productId || "",
    itemName: String(row.itemName || "").trim(),
    category: row.category || "",
    hsn: row.hsn || "",
    serialNumbers: row.serialNumbers || "",
    qty: Number(row.qty) || 0,
    unit: row.unit || "NOS",
    rate: Number(row.rate) || 0,
    tax: normalizePurchaseItemTax(row.tax),
  }));
}

export const DEFAULT_PARTY = {
  supplier: "Waaree Energies Ltd",
  supplierId: "sup-waaree",
  contactPerson: "Rajesh Vendor",
  mobile: "9812345678",
  gstin: "06AABCU9603R1ZM",
  address: "Industrial Area, Rohtak, Haryana",
  invoiceType: "Tax Invoice",
  invoiceNo: "PINV-2407-019",
  invoiceDate: new Date().toLocaleDateString("en-GB"),
  deliveryDate: "",
  paymentMode: "Credit",
  referenceNo: "CH-77821",
  notes: "",
};

/** Nayi purchase entry — khali supplier / invoice (save ke baad yahi load hota hai). */
export function createEmptyPurchaseParty() {
  return {
    supplier: "",
    supplierId: "",
    contactPerson: "",
    mobile: "",
    gstin: "",
    address: "",
    invoiceType: "Tax Invoice",
    invoiceNo: "",
    invoiceDate: new Date().toLocaleDateString("en-GB"),
    deliveryDate: "",
    paymentMode: "Credit",
    referenceNo: "",
    notes: "",
  };
}

export function createFreshPurchaseFormState() {
  return {
    party: createEmptyPurchaseParty(),
    items: [createEmptyPurchaseItem()],
    step: 1,
  };
}
