import { getInvoiceFileRecords } from "./invoiceStorage";
import { loadPurchaseHistory } from "./purchaseHistoryStorage";
import { listStockSheetRows } from "./stockStorage";

export const MONTH_OPTIONS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export function parseReportDate(dateStr) {
  const parts = String(dateStr || "").trim().split("/");
  if (parts.length !== 3) return null;
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);
  if (!day || !month || !year) return null;
  return { day, month, year, monthKey: `${year}-${String(month).padStart(2, "0")}` };
}

export function matchesMonthYear(dateStr, month, year) {
  const p = parseReportDate(dateStr);
  if (!p) return false;
  return p.month === Number(month) && p.year === Number(year);
}

export function splitGst(taxable, totalGst) {
  void taxable;
  if (!totalGst || totalGst <= 0) {
    return { cgst: 0, sgst: 0, igst: 0, totalGst: 0 };
  }
  const half = Math.round((totalGst / 2) * 100) / 100;
  return { cgst: half, sgst: totalGst - half, igst: 0, totalGst };
}

export function filterSaleInvoices(month, year, invoiceType = "all") {
  return getInvoiceFileRecords().filter((inv) => {
    if (!matchesMonthYear(inv.date, month, year)) return false;
    if (invoiceType === "with-gst") return inv.withGst;
    if (invoiceType === "without-gst") return !inv.withGst;
    return true;
  });
}

export function mapSaleRows(invoices) {
  return invoices.map((inv, index) => {
    const gst = splitGst(inv.taxableAmount, inv.gstAmount);
    return {
      sr: index + 1,
      invoiceNo: inv.invoiceNo,
      invoiceDate: inv.date,
      customerName: inv.customerName,
      taxable: inv.taxableAmount,
      ...gst,
      invoiceAmount: inv.totalAmount,
      status: "Paid",
    };
  });
}

export function sumSaleRows(rows) {
  return rows.reduce(
    (acc, r) => {
      acc.taxable += r.taxable;
      acc.cgst += r.cgst;
      acc.sgst += r.sgst;
      acc.igst += r.igst;
      acc.totalGst += r.totalGst;
      acc.invoiceAmount += r.invoiceAmount;
      return acc;
    },
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0, invoiceAmount: 0, count: rows.length },
  );
}

export function filterPurchases(month, year, supplier = "all") {
  return loadPurchaseHistory().filter((p) => {
    if (!matchesMonthYear(p.invoiceDate, month, year)) return false;
    if (supplier !== "all" && p.supplier !== supplier) return false;
    return true;
  });
}

export function mapPurchaseRows(purchases) {
  return purchases.map((p, index) => {
    const gst = splitGst(p.taxableAmount, p.gstAmount);
    return {
      sr: index + 1,
      invoiceNo: p.invoiceNo,
      invoiceDate: p.invoiceDate,
      supplierName: p.supplier,
      taxable: p.taxableAmount,
      ...gst,
      invoiceAmount: p.grandTotal ?? p.totalAmount,
      status: "Paid",
    };
  });
}

export function sumPurchaseRows(rows) {
  return sumSaleRows(rows);
}

export function buildStockReportRows(categoryFilter = "all") {
  return listStockSheetRows()
    .filter((p) => categoryFilter === "all" || p.category === categoryFilter)
    .map((p, index) => {
      const closing = Number(p.balance) || 0;
      const purchaseQty = Number(p.qtyIn) || 0;
      const saleQty = Number(p.qtyOut) || 0;
      const opening = Math.max(0, closing - purchaseQty + saleQty);
      const rate = Number(p.lastRate) || 0;
      return {
        sr: index + 1,
        itemName: p.itemName,
        hsn: p.hsn,
        openingQty: opening,
        purchaseQty,
        saleQty,
        closingQty: closing,
        unit: p.unit,
        rate,
        stockValue: closing * rate,
        category: p.category,
      };
    });
}

export function sumStockRows(rows) {
  return rows.reduce(
    (acc, r) => {
      acc.stockValue += r.stockValue;
      return acc;
    },
    { stockValue: 0, count: rows.length },
  );
}

export function buildDashboardSummary(month, year) {
  const sales = filterSaleInvoices(month, year);
  const purchases = filterPurchases(month, year);
  const saleSum = sumSaleRows(mapSaleRows(sales));
  const purchaseSum = sumPurchaseRows(mapPurchaseRows(purchases));
  const stockSum = sumStockRows(buildStockReportRows());

  return {
    totalSales: saleSum.invoiceAmount,
    totalPurchase: purchaseSum.invoiceAmount,
    totalStockValue: stockSum.stockValue,
    outputGst: saleSum.totalGst,
    inputGst: purchaseSum.totalGst,
    saleCount: saleSum.count,
    purchaseCount: purchaseSum.count,
  };
}

export function buildGstMonthSummary(month, year) {
  const saleSum = sumSaleRows(mapSaleRows(filterSaleInvoices(month, year)));
  const purchaseSum = sumPurchaseRows(mapPurchaseRows(filterPurchases(month, year)));
  const net = saleSum.totalGst - purchaseSum.totalGst;
  return {
    saleTaxable: saleSum.taxable,
    outputGst: saleSum.totalGst,
    purchaseTaxable: purchaseSum.taxable,
    inputGst: purchaseSum.totalGst,
    netGst: net,
    netLabel: net >= 0 ? "Payable" : "Refundable",
  };
}

export function purchaseSuppliers() {
  return [...new Set(loadPurchaseHistory().map((p) => p.supplier).filter(Boolean))];
}

export function formatReportMoney(n) {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
