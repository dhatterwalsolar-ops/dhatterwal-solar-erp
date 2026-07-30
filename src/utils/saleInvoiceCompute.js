import { amountInIndianWords } from "./indianAmountWords";
import { getInvoiceFormat } from "./invoiceFormatStorage";
import { findProductByName, searchProducts } from "./productStorage";

function applySetupKwTemplate(template, setupKw) {
  const kw = normalizeSetupKwLabel(setupKw) || "02 KW";
  return String(template || "")
    .replace(/\{setupKw\}/gi, kw)
    .replace(/\{SETUPKW\}/g, kw);
}

/** Normalize setup to invoice label: 02 KW / 03 KW / 05 KW. */
export function normalizeSetupKwLabel(setupKw) {
  const raw = String(setupKw || "").trim().toUpperCase();
  if (!raw) return "";
  const num = raw.match(/(\d+(?:\.\d+)?)/);
  if (!num) return raw;
  const n = Math.round(Number(num[1]));
  if (!Number.isFinite(n) || n <= 0) return raw;
  return `${String(n).padStart(2, "0")} KW`;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Resolve HSN from Product Sheet by item name (exact, then search). */
export function resolveProductHsn(itemName, fallback = "") {
  const exact = findProductByName(itemName);
  if (exact?.hsn) return String(exact.hsn).trim();
  const hits = searchProducts(itemName, 5);
  const hit = hits.find((p) => p.hsn) || hits[0];
  return hit?.hsn ? String(hit.hsn).trim() : String(fallback || "").trim();
}

/**
 * Build printable line items + CGST/SGST like official Tax Invoice stationery.
 *
 * With GST + amountInclusive: `taxableAmount` param = Grand Total (with tax).
 * Taxable + GST lines reverse-calculate from that total (70%@5% + 30%@18%).
 *
 * @param {'invoice'|'quotation'} [opts.detailStyle]
 *   quotation → "02 KW DCR PANNEL" / "02 KW ONGRID INVERTER" + fixed install details
 */
export function buildInvoiceComputation({
  taxableAmount,
  withGst,
  amountInclusive = false,
  panelName,
  inverterName,
  inverterSerial,
  setupKw,
  format: formatOverride,
  detailStyle = "invoice",
}) {
  const fmt = formatOverride || getInvoiceFormat();
  const solarShare = Math.min(100, Math.max(0, Number(fmt.solarSharePercent) || 70)) / 100;
  const solarRate = (Number(fmt.solarGstPercent) || 5) / 100;
  const installRate = (Number(fmt.installGstPercent) || 18) / 100;
  const solarCgst = (solarRate * 100) / 2;
  const installCgst = (installRate * 100) / 2;
  const unit = fmt.unitLabel || "SETUP";

  const inputAmount = round2(taxableAmount);
  const inclusive = Boolean(withGst && amountInclusive);

  const inclusiveFactor =
    solarShare * (1 + solarRate) + (1 - solarShare) * (1 + installRate);

  let taxable = inclusive ? round2(inputAmount / inclusiveFactor) : inputAmount;
  let solarTaxable = round2(taxable * solarShare);
  let installTaxable = round2(taxable - solarTaxable);

  let solarGst = withGst ? round2(solarTaxable * solarRate) : 0;
  let installGst = withGst ? round2(installTaxable * installRate) : 0;
  let gstAmount = round2(solarGst + installGst);
  let totalAmount = round2(taxable + gstAmount);

  if (inclusive) {
    totalAmount = inputAmount;
    gstAmount = round2(totalAmount - taxable);
    solarGst = round2(solarTaxable * solarRate);
    installGst = round2(gstAmount - solarGst);
    if (installGst < 0) {
      installGst = 0;
      solarGst = gstAmount;
    }
  }

  const solarCgstAmt = withGst ? round2(solarGst / 2) : 0;
  const solarSgstAmt = withGst ? round2(solarGst - solarCgstAmt) : 0;
  const installCgstAmt = withGst ? round2(installGst / 2) : 0;
  const installSgstAmt = withGst ? round2(installGst - installCgstAmt) : 0;

  const setupLabel = normalizeSetupKwLabel(setupKw) || "02 KW";
  const isQuotation = detailStyle === "quotation";

  const panelDetailLabel = String(fmt.panelDetailLabel || "DCR PANNEL").trim().toUpperCase();
  const inverterDetailLabel = String(fmt.inverterDetailLabel || "ONGRID INVERTER")
    .trim()
    .toUpperCase();

  let solarDetails;
  if (isQuotation) {
    solarDetails = [
      `${setupLabel} ${panelDetailLabel}`,
      `${setupLabel} ${inverterDetailLabel}`,
    ];
  } else {
    const panelLine = String(panelName || "SOLAR PANEL").trim().toUpperCase();
    const invName = String(inverterName || "INVERTER").trim().toUpperCase();
    const invSr = String(inverterSerial || "").trim();
    const inverterDesc = `${setupLabel} ${invName}`.trim();
    const inverterExtra = invSr ? `INVERTER SR. NO. ${invSr}` : "";
    solarDetails = [panelLine, inverterDesc, inverterExtra].filter(Boolean);
  }

  const defaultInstallDetails = [
    "AC-DB AND DC-DB BOX",
    "EARTHING AND LA, STRUTURE, WIRING, ETC COMPLETE SETUP",
  ];
  let installDetails;
  if (isQuotation) {
    const custom = Array.isArray(fmt.installDetailLines)
      ? fmt.installDetailLines.map((t) => String(t || "").trim()).filter(Boolean)
      : [];
    installDetails = custom.length ? custom.map((t) => t.toUpperCase()) : defaultInstallDetails;
  } else {
    installDetails = setupLabel ? [setupLabel] : [];
  }

  const installTitle = (() => {
    const raw = String(fmt.installItemTitle || "SOLAR INSTALATION");
    const cleaned = raw
      .replace(/\(?\s*\{setupKw\}\s*SETUP\s*\)?/gi, "")
      .replace(/\{setupKw\}/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return cleaned || "SOLAR INSTALATION";
  })();

  const lines = [
    {
      sn: 1,
      title: applySetupKwTemplate(fmt.solarItemTitle, setupKw),
      details: solarDetails,
      hsn: fmt.solarHsn || "85414011",
      qty: 1,
      unit,
      price: solarTaxable,
      amount: solarTaxable,
      gstRate: withGst ? solarRate : 0,
      cgstRate: withGst ? solarCgst : 0,
      sgstRate: withGst ? solarCgst : 0,
      cgstAmt: solarCgstAmt,
      sgstAmt: solarSgstAmt,
    },
    {
      sn: 2,
      title: installTitle,
      details: installDetails,
      hsn: fmt.installHsn || "7308",
      qty: 1,
      unit,
      price: installTaxable,
      amount: installTaxable,
      gstRate: withGst ? installRate : 0,
      cgstRate: withGst ? installCgst : 0,
      sgstRate: withGst ? installCgst : 0,
      cgstAmt: installCgstAmt,
      sgstAmt: installSgstAmt,
    },
  ];

  const taxRows = [];
  if (withGst) {
    taxRows.push({ label: "Add: CGST", rate: solarCgst, amount: lines[0].cgstAmt });
    taxRows.push({ label: "Add: SGST", rate: solarCgst, amount: lines[0].sgstAmt });
    taxRows.push({ label: "Add: CGST", rate: installCgst, amount: lines[1].cgstAmt });
    taxRows.push({ label: "Add: SGST", rate: installCgst, amount: lines[1].sgstAmt });
  }

  const hsnSummary = lines.map((line) => ({
    hsn: line.hsn,
    taxRate: withGst ? line.gstRate * 100 : 0,
    taxableAmt: line.amount,
    cgstAmt: line.cgstAmt,
    sgstAmt: line.sgstAmt,
    totalTax: round2(line.cgstAmt + line.sgstAmt),
  }));

  return {
    taxableAmount: taxable,
    gstAmount,
    totalAmount,
    inputAmount,
    amountInclusive: inclusive,
    lines,
    taxRows,
    hsnSummary,
    totalQty: lines.reduce((s, l) => s + l.qty, 0),
    amountInWords: amountInIndianWords(totalAmount),
  };
}

/**
 * Single-line Net Meter invoice.
 * `amount` = taxable / bill amount; `gstPercent` applied on top.
 */
export function buildNetMeterInvoiceComputation({
  itemName,
  meterSrNo,
  applicationNo,
  meterCompanyName,
  hsn,
  amount,
  gstPercent,
  unitLabel = "NOS",
}) {
  const taxable = round2(amount);
  const rate = Math.max(0, Number(gstPercent) || 0) / 100;
  const withGst = rate > 0;
  const gstAmount = withGst ? round2(taxable * rate) : 0;
  const totalAmount = round2(taxable + gstAmount);
  const halfRate = (rate * 100) / 2;
  const cgstAmt = withGst ? round2(gstAmount / 2) : 0;
  const sgstAmt = withGst ? round2(gstAmount - cgstAmt) : 0;
  const resolvedHsn =
    String(hsn || "").trim() || resolveProductHsn(itemName, "90283010") || "90283010";

  const details = [
    meterSrNo ? `METER SR. NO. ${String(meterSrNo).trim().toUpperCase()}` : "",
    applicationNo ? `APPLICATION NO. ${String(applicationNo).trim().toUpperCase()}` : "",
    meterCompanyName
      ? `METER COMPANY: ${String(meterCompanyName).trim().toUpperCase()}`
      : "",
  ].filter(Boolean);

  const lines = [
    {
      sn: 1,
      title: String(itemName || "NET METER SINGLE PHASE").trim().toUpperCase(),
      details,
      hsn: resolvedHsn,
      qty: 1,
      unit: unitLabel,
      price: taxable,
      amount: taxable,
      gstRate: withGst ? rate : 0,
      cgstRate: withGst ? halfRate : 0,
      sgstRate: withGst ? halfRate : 0,
      cgstAmt,
      sgstAmt,
    },
  ];

  const taxRows = [];
  if (withGst) {
    taxRows.push({ label: "Add: CGST", rate: halfRate, amount: cgstAmt });
    taxRows.push({ label: "Add: SGST", rate: halfRate, amount: sgstAmt });
  }

  const hsnSummary = [
    {
      hsn: resolvedHsn,
      taxRate: withGst ? rate * 100 : 0,
      taxableAmt: taxable,
      cgstAmt,
      sgstAmt,
      totalTax: gstAmount,
    },
  ];

  return {
    taxableAmount: taxable,
    gstAmount,
    totalAmount,
    withGst,
    lines,
    taxRows,
    hsnSummary,
    totalQty: 1,
    amountInWords: amountInIndianWords(totalAmount),
  };
}
