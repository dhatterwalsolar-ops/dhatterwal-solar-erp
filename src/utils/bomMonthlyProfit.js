import { loadBomSheetFiles, bomFileSiteDate, computeTotalKharch, lineAmount } from "./bomSheetStorage";
import { listAllPayments } from "./customerPaymentLedger";
import { getInvoiceFileRecords } from "./invoiceStorage";
import { matchesMonthYear, parseReportDate } from "./reportCalculations";

function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function standLabourAmount(file) {
  const stand = (file?.items || []).find((i) => i.key === "stand" || /stand/i.test(i.itemName || ""));
  if (!stand) return 0;
  return money(lineAmount(stand));
}

function materialsOnlyAmount(file) {
  const items = (file?.items || []).filter(
    (i) => i.key !== "stand" && !/stand/i.test(String(i.itemName || "")),
  );
  return money(items.reduce((s, row) => s + lineAmount(row), 0));
}

function chargesAmount(file) {
  const c = file?.charges || {};
  return money(
    (Number(c.fileCharge) || 0) +
      (Number(c.departmentCharge) || 0) +
      (Number(c.netMeterCost) || 0) +
      (Number(c.kw02Charge) || 0) +
      (Number(c.autoRent) || 0),
  );
}

/** Customer se is mahine liya amount (ledger + sale invoices for BOM consumers). */
function customerReceivedForConsumers(consumerSet, month, year) {
  let ledgerTotal = 0;
  for (const p of listAllPayments()) {
    const cn = String(p.consumerNo || "")
      .trim()
      .toUpperCase();
    if (!consumerSet.has(cn)) continue;
    if (!matchesMonthYear(p.date, month, year)) continue;
    ledgerTotal += Number(p.amount) || 0;
  }

  /* Prefer ledger; invoices only if no sale ledger for that consumer+month */
  const saleLedgerByConsumer = new Map();
  for (const p of listAllPayments()) {
    const cn = String(p.consumerNo || "")
      .trim()
      .toUpperCase();
    if (!consumerSet.has(cn)) continue;
    if (!matchesMonthYear(p.date, month, year)) continue;
    if (String(p.category || "") !== "sale") continue;
    saleLedgerByConsumer.set(cn, (saleLedgerByConsumer.get(cn) || 0) + (Number(p.amount) || 0));
  }

  let invoiceOnly = 0;
  for (const inv of getInvoiceFileRecords()) {
    const cn = String(inv.consumerNo || "")
      .trim()
      .toUpperCase();
    if (!consumerSet.has(cn)) continue;
    if (!matchesMonthYear(inv.date, month, year)) continue;
    if (saleLedgerByConsumer.has(cn)) continue;
    invoiceOnly += Number(inv.totalAmount) || 0;
  }

  return money(ledgerTotal + invoiceOnly);
}

/**
 * BOM Monthly Profit — selected month ke setups.
 * Kharch = BOM totalKharch (materials + charges + ref)
 * Labour = Stand line (BOM) + optional breakout
 * Received = customer payments / invoices
 * Profit = Received − Kharch
 */
export function buildBomMonthlyProfitReport(month, year) {
  const files = loadBomSheetFiles().filter((file) => {
    const d = bomFileSiteDate(file) || file?.materials?.labourDate || file?.saleDate || "";
    return matchesMonthYear(d, month, year);
  });

  const rows = files.map((file, index) => {
    const siteDate = bomFileSiteDate(file) || file?.materials?.labourDate || file?.saleDate || "";
    const totalKharch = money(file.totalKharch ?? computeTotalKharch(file));
    const labour = standLabourAmount(file);
    const materials = materialsOnlyAmount(file);
    const charges = chargesAmount(file);
    const refPay = money(
      String(file.reference || "").trim().toLowerCase() === "direct"
        ? 0
        : Number(file.referencePayment) || 0,
    );
    return {
      sr: index + 1,
      consumerNo: file.consumerNo,
      customerName: file.customerName || "—",
      setupKw: file.setupKw || "—",
      teamWork: file.teamWork || "—",
      siteDate,
      materials,
      charges,
      labour,
      referencePayment: refPay,
      totalKharch,
    };
  });

  const consumerSet = new Set(rows.map((r) => String(r.consumerNo).trim().toUpperCase()));
  const totalKharch = money(rows.reduce((s, r) => s + r.totalKharch, 0));
  const totalLabour = money(rows.reduce((s, r) => s + r.labour, 0));
  const totalMaterials = money(rows.reduce((s, r) => s + r.materials, 0));
  const totalCharges = money(rows.reduce((s, r) => s + r.charges, 0));
  const totalReceived = customerReceivedForConsumers(consumerSet, month, year);
  const profit = money(totalReceived - totalKharch);

  return {
    month: Number(month),
    year: Number(year),
    setupCount: rows.length,
    rows,
    totals: {
      materials: totalMaterials,
      charges: totalCharges,
      labour: totalLabour,
      totalKharch,
      totalReceived,
      profit,
    },
  };
}

export function formatBomMoney(n) {
  return `₹ ${money(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export { parseReportDate };
