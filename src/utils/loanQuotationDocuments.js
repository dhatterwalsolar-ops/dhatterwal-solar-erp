import {
  addCustomerDocument,
  downloadStoredDocument,
  listCustomerDocuments,
  removeCustomerDocument,
} from "./customerDocuments";
import { getLoanQuotationFormat } from "./loanQuotationFormatStorage";
import { buildInvoiceComputation } from "./saleInvoiceCompute";
import { allocateNextQuotationSerial, peekNextQuotationSerial } from "./quotationSerial";
import { resolveInvoiceItemDetails } from "./saleInvoiceItems";

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

const FALLBACK_LOGO = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7ec8ff"/><stop offset="100%" stop-color="#3a9adf"/></linearGradient><linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e3a8a"/><stop offset="100%" stop-color="#0f172a"/></linearGradient></defs><circle cx="100" cy="100" r="96" fill="url(#sky)" stroke="#0b3d91" stroke-width="6"/><circle cx="148" cy="48" r="18" fill="#fbbf24"/><rect x="48" y="70" width="88" height="58" rx="4" fill="url(#panel)" stroke="#fff" stroke-width="2" transform="rotate(-12 92 99)"/><path d="M40 145 Q100 125 160 148" fill="none" stroke="#166534" stroke-width="8"/><text x="100" y="178" text-anchor="middle" font-family="Arial Black,Arial" font-size="13" font-weight="900" fill="#0b3d91">DHATTERWAL</text><text x="100" y="192" text-anchor="middle" font-family="Arial" font-size="11" font-weight="700" fill="#0b3d91">SOLAR</text></svg>`)}`;

function partyNameLine(row) {
  const name = String(row.customerName || "").trim().toUpperCase();
  const father = String(row.fatherName || "").trim().toUpperCase();
  if (name && father) return `${name} S/O ${father}`;
  return name || "—";
}

function partyAddressLine(row) {
  return String(row.address || "").trim().toUpperCase() || "—";
}

function formatQuotationDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

export function parseLoanAmount(value) {
  const n = Number(String(value ?? "").replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Loan Quotation HTML — same stationery as Tax Invoice, billing address only (no Shipped to).
 */
export function buildLoanQuotationHtml(quotation, formatOverride) {
  const fmt = formatOverride || getLoanQuotationFormat();
  const calc =
    Array.isArray(quotation.lines) && quotation.lines.length
      ? {
          taxableAmount: quotation.taxableAmount,
          gstAmount: quotation.gstAmount,
          totalAmount: quotation.totalAmount,
          lines: quotation.lines,
          taxRows: quotation.taxRows || [],
          totalQty: quotation.totalQty || quotation.lines.reduce((s, l) => s + (l.qty || 0), 0),
          amountInWords: quotation.amountInWords || "",
        }
      : buildInvoiceComputation({
          taxableAmount: quotation.amount,
          withGst: quotation.withGst,
          amountInclusive: Boolean(quotation.withGst),
          panelName: quotation.panelName,
          inverterName: quotation.inverterName,
          inverterSerial: quotation.inverterSerial,
          setupKw: quotation.setupKw,
          format: fmt,
          detailStyle: "quotation",
        });

  const billedName = partyNameLine(quotation);
  const billedAddr = partyAddressLine(quotation);
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
        <td class="c hsn-cell">${esc(line.hsn)}</td>
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

  const banks = (fmt.banks || [])
    .filter((b) => String(b?.name || "").trim() || String(b?.accountNo || "").trim())
    .map(
      (b) => `<td class="bank-cell">
        <div class="bank-name">${esc(b.name)}</div>
        <div>A/C NO. &nbsp;&nbsp; ${esc(b.accountNo)}</div>
        <div>IFSC CODE &nbsp;${esc(b.ifsc)}</div>
        <div>BRANCH &nbsp;&nbsp;&nbsp;${esc(b.branch)}</div>
      </td>`,
    )
    .join("");

  const terms = (fmt.terms || [])
    .filter((t) => String(t || "").trim())
    .map((t) => `<div>${esc(t)}</div>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Quotation ${esc(quotation.quotationNo)}</title>
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
  .meta td { border: 1px solid #000; vertical-align: top; padding: 0; width: 50%; }
  .meta-inner { width: 100%; }
  .meta-inner td { border: none; padding: 3px 8px; font-family: Arial, sans-serif; font-size: 12px; }
  .meta-inner .k { font-weight: 700; width: 120px; }
  .party td { border: 1px solid #000; border-top: none; vertical-align: top; padding: 6px 8px; font-family: Arial, sans-serif; }
  .party-head { font-weight: 700; margin-bottom: 4px; }
  .party-name { font-weight: 700; text-transform: uppercase; }
  .party-addr { text-transform: uppercase; margin-top: 2px; }
  .gstin-line { margin-top: 10px; }
  .items th, .items td { border: 1px solid #000; padding: 4px 5px; font-family: Arial, sans-serif; font-size: 11.5px; vertical-align: top; }
  .items th { font-weight: 700; }
  .sn { width: 28px; }
  .desc { width: 48%; }
  .hsn-cell { width: 52px; max-width: 58px; font-size: 10px; padding: 4px 2px !important; word-break: break-all; }
  .items th:nth-child(3) { width: 52px; max-width: 58px; font-size: 10px; padding: 4px 2px; }
  .item-title { font-weight: 700; text-transform: uppercase; }
  .item-sub { font-size: 11px; margin-top: 1px; text-transform: uppercase; }
  .tax-label { white-space: nowrap; }
  .grand td { font-weight: 900; }
  .words { padding: 6px 8px; border: 1px solid #000; border-top: none; font-weight: 700; font-family: Arial, sans-serif; }
  .pay-head { border: 1px solid #000; border-top: none; padding: 5px 8px; font-weight: 700; font-family: Arial, sans-serif; }
  .banks td { border: 1px solid #000; border-top: none; vertical-align: top; padding: 6px 8px; width: 50%; font-family: Arial, sans-serif; font-size: 11px; }
  .bank-name { font-weight: 700; margin-bottom: 2px; }
  .foot td { border: 1px solid #000; border-top: none; vertical-align: top; padding: 6px 8px; font-family: Arial, sans-serif; font-size: 11px; }
  .terms-title { font-weight: 700; margin-bottom: 4px; }
  .sign-wrap { min-height: 110px; position: relative; }
  .recv-row td { min-height: 56px; padding: 10px 8px 28px; }
  .recv { font-weight: 700; }
  .auth { text-align: right; margin-top: 8px; }
  .auth-for { font-weight: 900; font-size: 12.5px; font-family: Arial, sans-serif; }
  .auth-space { height: 48px; display: flex; align-items: flex-end; justify-content: flex-end; }
  .auth-sign { max-height: 46px; max-width: 160px; object-fit: contain; }
  .auth-label { font-weight: 900; font-size: 12.5px; margin-top: 4px; font-family: Arial, sans-serif; }
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
          <div class="party-head" style="padding:6px 8px 0;font-family:Arial,sans-serif">${esc(fmt.billedToLabel || "Party Details:")}</div>
          <div style="padding:4px 8px 8px;font-family:Arial,sans-serif">
            <div class="party-name">${esc(billedName)}</div>
            <div class="party-addr">${esc(billedAddr)}</div>
            <div class="gstin-line">GSTIN / UIN :</div>
          </div>
        </td>
        <td>
          <table class="meta-inner">
            <tr><td class="k">Quotation No.</td><td>: ${esc(quotation.quotationNo || "")}</td></tr>
            <tr><td class="k">Dated</td><td>: ${esc(quotation.date || "")}</td></tr>
            <tr><td class="k">Setup</td><td>: ${esc(String(quotation.setupKw || "").toUpperCase())}</td></tr>
            <tr><td class="k">Consumer No.</td><td>: ${esc(quotation.consumerNo || "")}</td></tr>
          </table>
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
          <td colspan="6" class="r b">Taxable Amount</td>
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

    <div class="pay-head">${esc(fmt.paymentHeading)}</div>
    <table class="banks"><tr>${banks}</tr></table>

    <table class="foot">
      <tr>
        <td style="width:58%">
          <div class="terms-title">${esc(fmt.termsHeading)}</div>
          ${terms}
        </td>
        <td>
          <div class="sign-wrap">
            <div class="auth">
              <div class="auth-for">${esc(fmt.signatoryFor)}</div>
              <div class="auth-space">
                ${
                  fmt.signDataUrl
                    ? `<img class="auth-sign" src="${fmt.signDataUrl}" alt="Authorised signature" />`
                    : ""
                }
              </div>
              <div class="auth-label">${esc(fmt.authorisedLabel)}</div>
            </div>
          </div>
        </td>
      </tr>
      <tr class="recv-row">
        <td colspan="2">
          <div class="recv">${esc(fmt.receiverLabel)}</div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

export function buildLoanQuotationFormatPreviewHtml(format) {
  const fmt = format || getLoanQuotationFormat();
  const sample = {
    quotationNo: peekNextQuotationSerial() || "DS/Q/000045/2026-27",
    date: formatQuotationDate(),
    consumerNo: "SAMPLE-001",
    customerName: "SAMPLE CUSTOMER",
    fatherName: "SAMPLE FATHER",
    address: "VPO SAMPLE, DISTRICT KAITHAL",
    mobile: "9999999999",
    setupKw: "02 kW",
    reference: "REF-SAMPLE",
    amount: 140000,
    withGst: true,
    panelName: "LUMINOUS DCR SOLAR PANNEL",
    inverterName: "INVERTOR LUMINOUS",
    inverterSerial: "",
  };
  return buildLoanQuotationHtml(sample, fmt);
}

/**
 * Issue + save Loan Quotation for a loan case row.
 * @returns {{ quotationNo, html, doc }}
 */
export async function generateAndSaveLoanQuotation(row, { amount, withGst = true } = {}) {
  const fmt = getLoanQuotationFormat();
  const items = resolveInvoiceItemDetails(row);
  const amt = Number(amount) > 0 ? Number(amount) : parseLoanAmount(row.loanPayment);
  if (!(amt > 0)) {
    throw new Error("Quotation amount sahi bharen.");
  }

  /* Re-generate pe purana Quotation No. same — series mat badhao */
  const existingNo = String(row.quotationNo || "").trim();
  const quotationNo = existingNo || allocateNextQuotationSerial();
  const date = formatQuotationDate();
  const computation = buildInvoiceComputation({
    taxableAmount: amt,
    withGst: Boolean(withGst),
    amountInclusive: Boolean(withGst),
    panelName: items.panelName,
    inverterName: items.inverterName,
    inverterSerial: items.inverterSerial,
    setupKw: row.setupKw,
    format: fmt,
    detailStyle: "quotation",
  });

  const quotation = {
    quotationNo,
    date,
    consumerNo: row.consumerNo,
    customerName: row.customerName,
    fatherName: row.fatherName,
    address: row.address,
    mobile: row.mobile,
    setupKw: row.setupKw,
    reference: row.reference || "",
    amount: amt,
    withGst: Boolean(withGst),
    panelName: items.panelName,
    inverterName: items.inverterName,
    inverterSerial: items.inverterSerial,
    ...computation,
  };

  const html = buildLoanQuotationHtml(quotation, fmt);
  const safe = String(quotationNo).replace(/[^\w/-]+/g, "_");
  const fileName = `Quotation-${safe}.html`;
  const subfolder = `Quotations/${safe}`;

  const existing = listCustomerDocuments(row.consumerNo, { source: "loan" }).filter(
    (d) => d.category === "loan-quotation" && String(d.fileName || "").includes(safe),
  );
  existing.forEach((doc) => removeCustomerDocument(doc.id));

  const doc = await addCustomerDocument({
    consumerNo: row.consumerNo,
    source: "loan",
    category: "loan-quotation",
    fileName,
    mimeType: "text/html",
    dataUrl: dataUrlFromHtml(html),
    subfolder,
  });

  return { quotation, quotationNo, html, doc };
}

export function findLoanQuotationDocument(consumerNo, quotationNo) {
  const docs = listCustomerDocuments(consumerNo, { source: "loan" });
  const safe = String(quotationNo || "").replace(/[^\w/-]+/g, "_");
  return (
    docs.find(
      (d) => d.category === "loan-quotation" && String(d.fileName || "").includes(safe),
    ) || docs.find((d) => d.category === "loan-quotation")
  );
}

export function downloadLoanQuotationDoc(doc) {
  if (!doc) return;
  downloadStoredDocument(doc);
}

export function openLoanQuotationHtml(html) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    window.alert("Popup blocked — quotation folder se download karein.");
    return;
  }
  w.document.write(html);
  w.document.close();
}

export function openLoanQuotationDoc(doc) {
  if (doc) downloadStoredDocument(doc);
}
