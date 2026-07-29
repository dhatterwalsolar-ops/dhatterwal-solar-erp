import {
  addCustomerDocument,
  downloadStoredDocument,
  listCustomerDocuments,
  removeCustomerDocument,
} from "./customerDocuments";
import { getInvoiceFormat } from "./invoiceFormatStorage";
import { buildInvoiceComputation } from "./saleInvoiceCompute";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtQty(n) {
  return Number(n || 0).toFixed(2);
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtRate(n) {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dataUrlFromHtml(html) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function invoiceSubfolder(invoiceNo) {
  const safe = String(invoiceNo || "INV").replace(/[^\w/-]+/g, "_");
  return `Invoices/${safe}`;
}

const FALLBACK_LOGO = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7ec8ff"/><stop offset="100%" stop-color="#3a9adf"/></linearGradient><linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e3a8a"/><stop offset="100%" stop-color="#0f172a"/></linearGradient></defs><circle cx="100" cy="100" r="96" fill="url(#sky)" stroke="#0b3d91" stroke-width="6"/><circle cx="148" cy="48" r="18" fill="#fbbf24"/><rect x="48" y="70" width="88" height="58" rx="4" fill="url(#panel)" stroke="#fff" stroke-width="2" transform="rotate(-12 92 99)"/><path d="M40 145 Q100 125 160 148" fill="none" stroke="#166534" stroke-width="8"/><text x="100" y="178" text-anchor="middle" font-family="Arial Black,Arial" font-size="13" font-weight="900" fill="#0b3d91">DHATTERWAL</text><text x="100" y="192" text-anchor="middle" font-family="Arial" font-size="11" font-weight="700" fill="#0b3d91">SOLAR</text></svg>`)}`;

function partyNameLine(invoice) {
  const name = String(invoice.customerName || "").trim().toUpperCase();
  const father = String(invoice.fatherName || "").trim().toUpperCase();
  if (name && father) return `${name} S/O ${father}`;
  return name || "—";
}

function partyAddressLine(invoice) {
  const parts = [invoice.address, invoice.station, invoice.pinCode ? `PIN ${invoice.pinCode}` : ""]
    .map((p) => String(p || "").trim())
    .filter(Boolean);
  return parts.join(", ").toUpperCase() || "—";
}

function ensureComputation(invoice, format) {
  if (Array.isArray(invoice.lines) && invoice.lines.length) {
    return {
      taxableAmount: invoice.taxableAmount,
      gstAmount: invoice.gstAmount,
      totalAmount: invoice.totalAmount,
      lines: invoice.lines,
      taxRows: invoice.taxRows || [],
      hsnSummary: invoice.hsnSummary || [],
      totalQty: invoice.totalQty || invoice.lines.reduce((s, l) => s + (l.qty || 0), 0),
      amountInWords: invoice.amountInWords || "",
    };
  }
  return buildInvoiceComputation({
    taxableAmount: invoice.taxableAmount,
    withGst: invoice.withGst,
    panelName: invoice.panelName,
    inverterName: invoice.inverterName,
    inverterSerial: invoice.inverterSerial,
    setupKw: invoice.setupKw,
    format,
  });
}

/**
 * Official Tax Invoice HTML — layout matched to uploaded Dhatterwal stationery.
 */
export function buildSaleInvoiceHtml(invoice, formatOverride) {
  const fmt = formatOverride || getInvoiceFormat();
  const calc = ensureComputation(invoice, fmt);
  const billedName = partyNameLine(invoice);
  const billedAddr = partyAddressLine(invoice);
  const logoSrc = fmt.logoDataUrl || FALLBACK_LOGO;
  const unit = fmt.unitLabel || "SETUP";

  const itemRows = calc.lines
    .map((line) => {
      const details = (line.details || [])
        .map((d) => `<div class="item-sub">${esc(d)}</div>`)
        .join("");
      return `<tr>
        <td class="c sn">${esc(line.sn)}</td>
        <td class="desc"><div class="item-title">${esc(line.title)}</div>${details}</td>
        <td class="c">${esc(line.hsn)}</td>
        <td class="r">${esc(fmtQty(line.qty))}</td>
        <td class="c">${esc(line.unit || unit)}</td>
        <td class="r">${esc(fmtMoney(line.price))}</td>
        <td class="r">${esc(fmtMoney(line.amount))}</td>
      </tr>`;
    })
    .join("");

  const taxRowsHtml = (calc.taxRows || [])
    .map(
      (row) => `<tr>
        <td colspan="5" class="noborder-left"></td>
        <td class="r tax-label">${esc(row.label)}&nbsp;&nbsp;${esc(fmtRate(row.rate))}%</td>
        <td class="r">${esc(fmtMoney(row.amount))}</td>
      </tr>`,
    )
    .join("");

  const hsnRows = (calc.hsnSummary || [])
    .map(
      (row) => `<tr>
        <td class="c">${esc(row.hsn)}</td>
        <td class="c">${esc(fmtRate(row.taxRate))}%</td>
        <td class="r">${esc(fmtMoney(row.taxableAmt))}</td>
        <td class="r">${esc(fmtMoney(row.cgstAmt))}</td>
        <td class="r">${esc(fmtMoney(row.sgstAmt))}</td>
        <td class="r">${esc(fmtMoney(row.totalTax))}</td>
      </tr>`,
    )
    .join("");

  const hsnTotals = (calc.hsnSummary || []).reduce(
    (acc, row) => ({
      taxable: acc.taxable + (Number(row.taxableAmt) || 0),
      cgst: acc.cgst + (Number(row.cgstAmt) || 0),
      sgst: acc.sgst + (Number(row.sgstAmt) || 0),
      tax: acc.tax + (Number(row.totalTax) || 0),
    }),
    { taxable: 0, cgst: 0, sgst: 0, tax: 0 },
  );

  const banks = (fmt.banks || [])
    .map(
      (b) => `<td class="bank-cell">
        <div class="bank-name">${esc(b.name)}</div>
        <div>A/C NO. &nbsp;&nbsp; ${esc(b.accountNo)}</div>
        <div>IFSC CODE &nbsp;${esc(b.ifsc)}</div>
        <div>BRANCH &nbsp;&nbsp;&nbsp;${esc(b.branch)}</div>
      </td>`,
    )
    .join("");

  const terms = (fmt.terms || []).map((t) => `<div>${esc(t)}</div>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Tax Invoice ${esc(invoice.invoiceNo)}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 6px; background:#fff; color:#000; font-family: "Times New Roman", Times, serif; font-size: 12px; }
  .sheet { width: 100%; max-width: 190mm; margin: 0 auto; border: 2px solid #000; }
  table { border-collapse: collapse; width: 100%; }
  .c { text-align: center; } .r { text-align: right; } .b { font-weight: 700; }
  .header-table td { vertical-align: top; padding: 6px 8px; }
  .logo { width: 92px; height: 92px; object-fit: contain; }
  .company { text-align: center; }
  .inv-title { font-size: 16px; font-weight: 700; margin: 0 0 2px; font-family: Arial, sans-serif; }
  .co-name { font-size: 22px; font-weight: 900; margin: 0; letter-spacing: 0.2px; font-family: Arial Black, Arial, sans-serif; text-transform: uppercase; }
  .co-line { margin: 1px 0; font-size: 12px; font-family: Arial, sans-serif; }
  .gstin { font-weight: 700; }
  .copy { font-style: italic; font-size: 12px; text-align: right; white-space: nowrap; font-family: Arial, sans-serif; }
  .line { border-top: 1px solid #000; }
  .meta td { border: 1px solid #000; vertical-align: top; padding: 0; width: 50%; }
  .meta-inner { width: 100%; }
  .meta-inner td { border: none; padding: 3px 8px; font-family: Arial, sans-serif; font-size: 12px; }
  .meta-inner .k { font-weight: 700; width: 120px; }
  .party td { border: 1px solid #000; border-top: none; vertical-align: top; padding: 6px 8px; width: 50%; font-family: Arial, sans-serif; }
  .party-head { font-weight: 700; margin-bottom: 4px; }
  .party-name { font-weight: 700; text-transform: uppercase; }
  .party-addr { text-transform: uppercase; margin-top: 2px; }
  .gstin-line { margin-top: 10px; }
  .items th, .items td { border: 1px solid #000; padding: 4px 5px; font-family: Arial, sans-serif; font-size: 11.5px; vertical-align: top; }
  .items th { font-weight: 700; }
  .sn { width: 34px; }
  .item-title { font-weight: 700; text-transform: uppercase; }
  .item-sub { font-size: 11px; margin-top: 1px; text-transform: uppercase; }
  .tax-label { white-space: nowrap; }
  .grand td { font-weight: 900; }
  .words { padding: 6px 8px; border: 1px solid #000; border-top: none; font-weight: 700; font-family: Arial, sans-serif; }
  .hsn th, .hsn td { border: 1px solid #000; padding: 4px 5px; font-family: Arial, sans-serif; font-size: 11px; }
  .pay-head { border: 1px solid #000; border-top: none; padding: 5px 8px; font-weight: 700; font-family: Arial, sans-serif; }
  .banks td { border: 1px solid #000; border-top: none; vertical-align: top; padding: 6px 8px; width: 50%; font-family: Arial, sans-serif; font-size: 11px; }
  .bank-name { font-weight: 700; margin-bottom: 2px; }
  .foot td { border: 1px solid #000; border-top: none; vertical-align: top; padding: 6px 8px; font-family: Arial, sans-serif; font-size: 11px; }
  .terms-title { font-weight: 700; margin-bottom: 4px; }
  .sign-wrap { height: 110px; position: relative; }
  .recv { margin-top: 2px; }
  .auth { text-align: right; margin-top: 28px; }
  .auth-for { font-weight: 700; }
  .auth-space { height: 36px; }
  .auth-label { font-weight: 700; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="sheet">
    <table class="header-table">
      <tr>
        <td style="width:100px"><img class="logo" src="${logoSrc}" alt="Logo" /></td>
        <td class="company">
          <div class="inv-title">${esc(fmt.title)}</div>
          <div class="co-name">${esc(fmt.legalName)}</div>
          <div class="co-line">${esc(fmt.address)}</div>
          <div class="co-line">${esc(fmt.phones)}</div>
          <div class="co-line gstin">GSTIN : ${esc(fmt.gstin)}</div>
          <div class="co-line">${esc(fmt.telEmailLine || `Tel.:${fmt.phones}-email:${fmt.email}`)}</div>
        </td>
        <td style="width:90px"><div class="copy">${esc(fmt.copyLabel || "Original Copy")}</div></td>
      </tr>
    </table>

    <table class="meta">
      <tr>
        <td>
          <table class="meta-inner">
            <tr><td class="k">Book No.</td><td>: ${esc(invoice.bookNo || invoice.srNo || "")}</td></tr>
            <tr><td class="k">Serial No.</td><td>: ${esc(invoice.invoiceNo || "")}</td></tr>
            <tr><td class="k">Dated</td><td>: ${esc(invoice.date || "")}</td></tr>
            <tr><td class="k">Place of Supply</td><td>: ${esc(invoice.placeOfSupply || fmt.placeOfSupply)}</td></tr>
            <tr><td class="k">Reverse Charge</td><td>: ${esc(invoice.reverseCharge || fmt.reverseCharge)}</td></tr>
          </table>
        </td>
        <td>
          <table class="meta-inner">
            <tr><td class="k">Transport</td><td>: ${esc(invoice.transport || fmt.transportDefault)}</td></tr>
            <tr><td class="k">Vehicle No.</td><td>: ${esc(invoice.vehicleNo || "")}</td></tr>
            <tr><td class="k">Station</td><td>: ${esc(String(invoice.station || "").toUpperCase())}</td></tr>
            <tr><td class="k">E-Way Bill No.</td><td>: ${esc(invoice.ewayBillNo || "")}</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <table class="party">
      <tr>
        <td>
          <div class="party-head">Billed to :</div>
          <div class="party-name">${esc(billedName)}</div>
          <div class="party-addr">${esc(billedAddr)}</div>
          <div class="gstin-line">GSTIN / UIN :</div>
        </td>
        <td>
          <div class="party-head">Shipped to :</div>
          <div class="party-name">${esc(billedName)}</div>
          <div class="party-addr">${esc(billedAddr)}</div>
          <div class="gstin-line">GSTIN / UIN :</div>
        </td>
      </tr>
    </table>

    <table class="items">
      <thead>
        <tr>
          <th>S.N.</th>
          <th>Description of Goods</th>
          <th>HSN/SAC Code</th>
          <th>Qty.</th>
          <th>Unit</th>
          <th>Price</th>
          <th>Amount(₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        <tr>
          <td></td><td></td><td></td><td></td><td></td><td></td>
          <td class="r b">${esc(fmtMoney(calc.taxableAmount))}</td>
        </tr>
        ${taxRowsHtml}
        <tr class="grand">
          <td></td>
          <td class="b">Grand Total</td>
          <td></td>
          <td class="c">${esc(fmtQty(calc.totalQty))}</td>
          <td class="c">${esc(unit)}</td>
          <td></td>
          <td class="r">${esc(fmtMoney(calc.totalAmount))}</td>
        </tr>
      </tbody>
    </table>

    <div class="words">Amount in Words : ${esc(calc.amountInWords)}</div>

    <table class="hsn">
      <thead>
        <tr>
          <th>HSN/SAC</th>
          <th>Tax Rate</th>
          <th>Taxable Amt.</th>
          <th>CGST Amt.</th>
          <th>SGST Amt.</th>
          <th>Total Tax</th>
        </tr>
      </thead>
      <tbody>
        ${hsnRows || `<tr><td class="c" colspan="6">—</td></tr>`}
        <tr class="b">
          <td class="c">Total</td>
          <td></td>
          <td class="r">${esc(fmtMoney(hsnTotals.taxable))}</td>
          <td class="r">${esc(fmtMoney(hsnTotals.cgst))}</td>
          <td class="r">${esc(fmtMoney(hsnTotals.sgst))}</td>
          <td class="r">${esc(fmtMoney(hsnTotals.tax))}</td>
        </tr>
      </tbody>
    </table>

    <div class="pay-head">${esc(fmt.paymentHeading)}</div>
    <table class="banks"><tr>${banks}</tr></table>

    <table class="foot">
      <tr>
        <td style="width:58%">
          <div class="terms-title">${esc(fmt.termsHeading)}</div>
          ${terms}
          <div class="recv" style="margin-top:28px">${esc(fmt.receiverLabel)}</div>
        </td>
        <td>
          <div class="sign-wrap">
            <div class="auth">
              <div class="auth-for">${esc(fmt.signatoryFor)}</div>
              <div class="auth-space"></div>
              <div class="auth-label">${esc(fmt.authorisedLabel)}</div>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

export function buildEwayBillHtml(invoice, eway) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>E-Way Bill ${esc(eway.ewayBillNo)}</title>
<style>
  body{font-family:Arial,sans-serif;margin:24px;color:#122;font-size:14px}
  h1{margin:0;color:#0b3d91;font-size:22px}
  .ok{color:#166534;font-weight:700;margin:8px 0 16px}
  .box{border:1px solid #bfdbfe;border-radius:8px;padding:12px 14px;margin-bottom:14px;background:#f8fbff}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px}
</style>
</head>
<body>
  <h1>E-Way Bill</h1>
  <p class="ok">✓ Successfully generated</p>
  <div class="box">
    <div class="grid">
      <div>E-Way Bill No.: <strong>${esc(eway.ewayBillNo)}</strong></div>
      <div>Valid upto: ${esc(eway.validUpto || "—")}</div>
      <div>Invoice No.: ${esc(invoice.invoiceNo)}</div>
      <div>Date: ${esc(invoice.date)}</div>
      <div>Party: ${esc(partyNameLine(invoice))}</div>
      <div>Distance: <strong>${esc(eway.distanceKm)} km</strong></div>
      <div>Vehicle No.: <strong>${esc(invoice.vehicleNo)}</strong></div>
      <div>Station: ${esc(invoice.station)}</div>
    </div>
  </div>
</body>
</html>`;
}

export async function saveInvoiceDocumentToFolder(invoice) {
  const html = buildSaleInvoiceHtml(invoice);
  const fileName = `Invoice-${String(invoice.invoiceNo).replace(/[^\w/-]+/g, "_")}.html`;
  const subfolder = invoiceSubfolder(invoice.invoiceNo);

  const existing = listCustomerDocuments(invoice.consumerNo, { source: "sale" }).filter(
    (d) => d.category === "sale-invoice" && d.fileName === fileName,
  );
  existing.forEach((doc) => removeCustomerDocument(doc.id));

  return addCustomerDocument({
    consumerNo: invoice.consumerNo,
    source: "sale",
    category: "sale-invoice",
    fileName,
    mimeType: "text/html",
    dataUrl: dataUrlFromHtml(html),
    subfolder,
  });
}

export async function saveEwayDocumentToFolder(invoice, eway) {
  const html = buildEwayBillHtml(invoice, eway);
  const fileName = `EWayBill-${String(eway.ewayBillNo).replace(/[^\w/-]+/g, "_")}.html`;
  const subfolder = invoiceSubfolder(invoice.invoiceNo);
  return addCustomerDocument({
    consumerNo: invoice.consumerNo,
    source: "sale",
    category: "eway-bill",
    fileName,
    mimeType: "text/html",
    dataUrl: dataUrlFromHtml(html),
    subfolder,
  });
}

export function findInvoiceDocument(consumerNo, invoiceNo) {
  const docs = listCustomerDocuments(consumerNo, { source: "sale" });
  const safe = String(invoiceNo || "").replace(/[^\w/-]+/g, "_");
  return (
    docs.find((d) => d.category === "sale-invoice" && String(d.fileName || "").includes(safe)) ||
    docs.find((d) => d.category === "sale-invoice")
  );
}

export function findEwayDocument(consumerNo, ewayBillNo) {
  const docs = listCustomerDocuments(consumerNo, { source: "sale" });
  const safe = String(ewayBillNo || "").replace(/[^\w/-]+/g, "_");
  return (
    docs.find((d) => d.category === "eway-bill" && String(d.fileName || "").includes(safe)) ||
    docs.find((d) => d.category === "eway-bill")
  );
}

export function downloadInvoiceDoc(doc) {
  if (doc) downloadStoredDocument(doc);
}

export function openHtmlDocument(doc) {
  if (!doc?.dataUrl) return;
  const w = window.open(doc.dataUrl, "_blank", "noopener,noreferrer");
  if (!w) downloadStoredDocument(doc);
}

/** Live preview HTML for Settings → Invoice Format. */
export function buildInvoiceFormatPreviewHtml(format) {
  const sample = {
    bookNo: 1,
    srNo: 1,
    invoiceNo: "DS/323/2026-27",
    date: "20-06-2026",
    consumerNo: "CN-SAMPLE",
    customerName: "KRISHAN KUMAR",
    fatherName: "PALI RAM",
    address: "VPO BELARKHA, TEH. NARWANA, DISTRICT JIND",
    station: "VPO BELARKHA, DISTT JIND",
    pinCode: "",
    vehicleNo: "HR64-A-9734",
    transport: "SELF",
    placeOfSupply: format.placeOfSupply,
    reverseCharge: format.reverseCharge,
    ewayBillNo: "",
    withGst: true,
    setupKw: "02 KW",
    panelName: "LUMINOUS DCR SOLAR PANNEL",
    inverterName: "INVERTOR LUMINOUS",
    inverterSerial: "",
    taxableAmount: 128558.32,
  };
  const calc = buildInvoiceComputation({
    taxableAmount: sample.taxableAmount,
    withGst: true,
    panelName: sample.panelName,
    inverterName: sample.inverterName,
    inverterSerial: sample.inverterSerial,
    setupKw: sample.setupKw,
    format,
  });
  return buildSaleInvoiceHtml({ ...sample, ...calc, withGst: true }, format);
}
