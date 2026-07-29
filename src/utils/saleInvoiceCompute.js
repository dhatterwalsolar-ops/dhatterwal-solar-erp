import { amountInIndianWords } from "./indianAmountWords";
import { getInvoiceFormat } from "./invoiceFormatStorage";

function applySetupKwTemplate(template, setupKw) {
  const kw = String(setupKw || "").trim().toUpperCase() || "02 KW";
  return String(template || "")
    .replace(/\{setupKw\}/gi, kw)
    .replace(/\{SETUPKW\}/g, kw);
}

/** Build printable line items + CGST/SGST like official Tax Invoice stationery. */
export function buildInvoiceComputation({
  taxableAmount,
  withGst,
  panelName,
  inverterName,
  inverterSerial,
  setupKw,
  format: formatOverride,
}) {
  const fmt = formatOverride || getInvoiceFormat();
  const solarShare = Math.min(100, Math.max(0, Number(fmt.solarSharePercent) || 70)) / 100;
  const solarRate = (Number(fmt.solarGstPercent) || 5) / 100;
  const installRate = (Number(fmt.installGstPercent) || 18) / 100;
  const solarCgst = (solarRate * 100) / 2;
  const installCgst = (installRate * 100) / 2;
  const unit = fmt.unitLabel || "SETUP";

  const taxable = Math.round((Number(taxableAmount) || 0) * 100) / 100;
  const solarTaxable = Math.round(taxable * solarShare * 100) / 100;
  const installTaxable = Math.round((taxable - solarTaxable) * 100) / 100;

  const solarGst = withGst ? Math.round(solarTaxable * solarRate * 100) / 100 : 0;
  const installGst = withGst ? Math.round(installTaxable * installRate * 100) / 100 : 0;
  const gstAmount = Math.round((solarGst + installGst) * 100) / 100;
  const totalAmount = Math.round((taxable + gstAmount) * 100) / 100;

  const panelLine = String(panelName || "SOLAR PANEL").trim().toUpperCase();
  const invName = String(inverterName || "INVERTER").trim().toUpperCase();
  const invSr = String(inverterSerial || "").trim();
  const kw = String(setupKw || "").trim().toUpperCase();
  const inverterDesc = `${kw ? `${kw} ` : ""}${invName}`.trim();
  const inverterExtra = invSr ? `INVERTER SR. NO. ${invSr}` : "";

  const lines = [
    {
      sn: 1,
      title: applySetupKwTemplate(fmt.solarItemTitle, setupKw),
      details: [panelLine, inverterDesc, inverterExtra].filter(Boolean),
      hsn: fmt.solarHsn || "85414011",
      qty: 1,
      unit,
      price: solarTaxable,
      amount: solarTaxable,
      gstRate: withGst ? solarRate : 0,
      cgstRate: withGst ? solarCgst : 0,
      sgstRate: withGst ? solarCgst : 0,
      cgstAmt: withGst ? Math.round((solarGst / 2) * 100) / 100 : 0,
      sgstAmt: withGst ? Math.round((solarGst / 2) * 100) / 100 : 0,
    },
    {
      sn: 2,
      title: applySetupKwTemplate(fmt.installItemTitle, setupKw),
      details: [],
      hsn: fmt.installHsn || "7308",
      qty: 1,
      unit,
      price: installTaxable,
      amount: installTaxable,
      gstRate: withGst ? installRate : 0,
      cgstRate: withGst ? installCgst : 0,
      sgstRate: withGst ? installCgst : 0,
      cgstAmt: withGst ? Math.round((installGst / 2) * 100) / 100 : 0,
      sgstAmt: withGst ? Math.round((installGst / 2) * 100) / 100 : 0,
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
    totalTax: Math.round((line.cgstAmt + line.sgstAmt) * 100) / 100,
  }));

  return {
    taxableAmount: taxable,
    gstAmount,
    totalAmount,
    lines,
    taxRows,
    hsnSummary,
    totalQty: lines.reduce((s, l) => s + l.qty, 0),
    amountInWords: amountInIndianWords(totalAmount),
  };
}
