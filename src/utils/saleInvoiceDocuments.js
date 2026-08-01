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
    const lines = invoice.lines;
    let hsnSummary = Array.isArray(invoice.hsnSummary) ? invoice.hsnSummary : [];
    if (!hsnSummary.length) {
      hsnSummary = lines.map((line) => ({
        hsn: line.hsn,
        taxRate: Number(line.gstRate) > 1 ? Number(line.gstRate) : (Number(line.gstRate) || 0) * 100,
        taxableAmt: line.amount,
        cgstAmt: line.cgstAmt || 0,
        sgstAmt: line.sgstAmt || 0,
        totalTax: Number(line.cgstAmt || 0) + Number(line.sgstAmt || 0),
      }));
    }
    let taxRows = Array.isArray(invoice.taxRows) ? invoice.taxRows : [];
    if (!taxRows.length && invoice.withGst) {
      lines.forEach((line) => {
        const half =
          Number(line.cgstRate) > 0
            ? Number(line.cgstRate) > 1
              ? Number(line.cgstRate)
              : Number(line.cgstRate) * 100
            : (Number(line.gstRate) > 1 ? Number(line.gstRate) : (Number(line.gstRate) || 0) * 100) / 2;
        if (Number(line.cgstAmt) > 0 || Number(line.sgstAmt) > 0) {
          taxRows.push({ label: "Add: CGST", rate: half, amount: line.cgstAmt || 0 });
          taxRows.push({ label: "Add: SGST", rate: half, amount: line.sgstAmt || 0 });
        }
      });
    }
    return {
      taxableAmount: invoice.taxableAmount,
      gstAmount: invoice.gstAmount,
      totalAmount: invoice.totalAmount,
      lines,
      taxRows,
      hsnSummary,
      totalQty: invoice.totalQty || lines.reduce((s, l) => s + (l.qty || 0), 0),
      amountInWords: invoice.amountInWords || "",
      withGst: Boolean(invoice.withGst),
    };
  }
  return {
    ...buildInvoiceComputation({
      taxableAmount: invoice.taxableAmount ?? invoice.totalAmount,
      withGst: invoice.withGst,
      amountInclusive: Boolean(invoice.withGst),
      panelName: invoice.panelName,
      inverterName: invoice.inverterName,
      inverterSerial: invoice.inverterSerial,
      setupKw: invoice.setupKw,
      format,
    }),
    withGst: Boolean(invoice.withGst),
  };
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
        <td class="c hsn-cell">${esc(line.hsn)}</td>
        <td class="r">${esc(fmtQty(line.qty))}</td>
        <td class="c">${esc(line.unit || unit)}</td>
        <td class="r">${esc(fmtMoney(line.price))}</td>
        <td class="r">${esc(fmtMoney(line.amount))}</td>
      </tr>`;
    })
    .join("");

  /* Upar GST — items table me (saved format jaisa Add: CGST / SGST) */
  const taxRowsHtml = (calc.taxRows || [])
    .map(
      (row) => `<tr class="gst-add-row">
        <td colspan="5" class="noborder-left"></td>
        <td class="r tax-label">${esc(row.label)}&nbsp;&nbsp;@&nbsp;${esc(fmtRate(row.rate))}%</td>
        <td class="r">${esc(fmtMoney(row.amount))}</td>
      </tr>`,
    )
    .join("");

  /* Niche GST — HSN/SAC tax summary (format stationery) */
  const hsnRows = calc.hsnSummary || [];
  const hsnTotals = hsnRows.reduce(
    (acc, row) => ({
      taxable: acc.taxable + (Number(row.taxableAmt) || 0),
      cgst: acc.cgst + (Number(row.cgstAmt) || 0),
      sgst: acc.sgst + (Number(row.sgstAmt) || 0),
      tax: acc.tax + (Number(row.totalTax) || 0),
    }),
    { taxable: 0, cgst: 0, sgst: 0, tax: 0 },
  );
  const hsnSummaryHtml =
    calc.withGst && hsnRows.length
      ? `<table class="hsn-tax">
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
          ${hsnRows
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
            .join("")}
          <tr class="hsn-total">
            <td colspan="2" class="r b">Total</td>
            <td class="r b">${esc(fmtMoney(hsnTotals.taxable))}</td>
            <td class="r b">${esc(fmtMoney(hsnTotals.cgst))}</td>
            <td class="r b">${esc(fmtMoney(hsnTotals.sgst))}</td>
            <td class="r b">${esc(fmtMoney(hsnTotals.tax))}</td>
          </tr>
        </tbody>
      </table>`
      : "";

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
<title>Tax Invoice ${esc(invoice.invoiceNo)}</title>
<style>
  @page { size: A4 portrait; margin: 6mm; }
  * { box-sizing: border-box; }
  html, body { width: 210mm; height: 297mm; }
  body {
    margin: 0; padding: 0; background:#fff; color:#000;
    font-family: "Times New Roman", Times, serif; font-size: 12px;
  }
  .sheet {
    width: 198mm; max-width: 198mm; height: 285mm; min-height: 285mm;
    margin: 0 auto; border: 2px solid #000;
    display: flex; flex-direction: column; overflow: hidden;
  }
  .sheet-top, .sheet-bottom { flex: 0 0 auto; }
  .sheet-mid {
    flex: 1 1 auto; min-height: 0;
    display: flex; flex-direction: column;
  }
  table { border-collapse: collapse; width: 100%; }
  .c { text-align: center; } .r { text-align: right; } .b { font-weight: 700; }
  .header-table { width: 100%; table-layout: fixed; }
  .header-table td { vertical-align: middle; padding: 8px 7px; }
  .header-table td.logo-cell { width: 84px; }
  .header-table td.copy-cell { width: 68px; }
  .logo { width: 78px; height: 78px; object-fit: contain; display: block; }
  .company { text-align: center; overflow: hidden; padding: 2px 0; }
  .inv-title {
    font-size: 15px; font-weight: 800; margin: 0 0 4px;
    font-family: Arial, sans-serif; letter-spacing: 0.6px;
  }
  .co-name {
    font-size: 17.5px; font-weight: 900; margin: 0 0 5px; letter-spacing: 0.35px;
    font-family: Arial Black, Arial, sans-serif; text-transform: uppercase;
    white-space: nowrap; line-height: 1.15; color: #0b1f4d;
  }
  .co-line { margin: 3px 0; font-size: 11.5px; font-family: Arial, sans-serif; line-height: 1.35; }
  .gstin { font-weight: 700; }
  .copy { font-style: italic; font-size: 11px; text-align: right; white-space: nowrap; font-family: Arial, sans-serif; }
  .meta td { border: 1px solid #000; vertical-align: top; padding: 0; width: 50%; }
  .meta-inner { width: 100%; }
  .meta-inner td { border: none; padding: 4px 9px; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; }
  .meta-inner .k { font-weight: 700; width: 120px; }
  .eway-no { font-weight: 700; }
  .party td { border: 1px solid #000; border-top: none; vertical-align: top; padding: 8px 9px; width: 50%; font-family: Arial, sans-serif; }
  .party-head { font-weight: 700; margin-bottom: 5px; }
  .party-name { font-weight: 700; text-transform: uppercase; line-height: 1.35; }
  .party-addr { text-transform: uppercase; margin-top: 3px; line-height: 1.4; }
  .gstin-line { margin-top: 12px; }
  .items { height: 100%; }
  .items th, .items td { border: 1px solid #000; padding: 5px 6px; font-family: Arial, sans-serif; font-size: 12px; vertical-align: top; }
  .items th { font-weight: 700; background: #f3f3f3; }
  .sn { width: 30px; }
  .desc { width: 48%; }
  .hsn-cell { width: 54px; max-width: 58px; font-size: 10.5px; padding: 5px 2px !important; word-break: break-all; }
  .items th:nth-child(3) { width: 54px; max-width: 58px; font-size: 10.5px; padding: 5px 2px; }
  .item-title { font-weight: 700; text-transform: uppercase; line-height: 1.35; }
  .item-sub { font-size: 11.5px; margin-top: 3px; text-transform: uppercase; line-height: 1.35; }
  .spacer-row td { height: 100%; border: 1px solid #000; padding: 0 !important; vertical-align: top; }
  .noborder-left { border-left: 1px solid #000; border-right: none; }
  .gst-add-row td { font-size: 11.5px; }
  .tax-label { white-space: nowrap; font-weight: 700; }
  .grand td { font-weight: 900; }
  .hsn-tax { width: 100%; border-collapse: collapse; margin-top: 0; }
  .hsn-tax th, .hsn-tax td {
    border: 1px solid #000; padding: 5px 6px; font-family: Arial, sans-serif; font-size: 11.5px;
  }
  .hsn-tax th { font-weight: 700; background: #f3f3f3; }
  .hsn-total td { font-weight: 700; }
  .words { padding: 8px 10px; border: 1px solid #000; border-top: none; font-weight: 700; font-family: Arial, sans-serif; line-height: 1.4; }
  .pay-head { border: 1px solid #000; border-top: none; padding: 7px 10px; font-weight: 700; font-family: Arial, sans-serif; }
  .banks td { border: 1px solid #000; border-top: none; vertical-align: top; padding: 8px 10px; width: 50%; font-family: Arial, sans-serif; font-size: 11.5px; line-height: 1.4; }
  .bank-name { font-weight: 700; margin-bottom: 3px; }
  .foot { height: 100%; }
  .foot td { border: 1px solid #000; border-top: none; vertical-align: top; padding: 8px 10px; font-family: Arial, sans-serif; font-size: 11.5px; line-height: 1.4; }
  .terms-title { font-weight: 700; margin-bottom: 6px; }
  .sign-wrap { min-height: 155px; position: relative; }
  .recv-row td { min-height: 52px; padding: 12px 10px 22px; }
  .recv { font-weight: 700; }
  .auth { text-align: right; margin-top: 4px; }
  .auth-for {
    font-weight: 900; font-size: 11.5px; font-family: Arial, sans-serif;
    white-space: nowrap; line-height: 1.25; letter-spacing: 0.2px;
  }
  .auth-space {
    min-height: 82px; height: 82px; margin: 8px 0 3px;
    display: flex; align-items: flex-end; justify-content: flex-end;
  }
  .auth-sign { max-height: 78px; max-width: 230px; width: auto; height: auto; object-fit: contain; }
  .auth-label { font-weight: 900; font-size: 12.5px; margin-top: 2px; font-family: Arial, sans-serif; white-space: nowrap; }
  @media print {
    html, body { width: 210mm; height: 297mm; }
    body { padding: 0; margin: 0; }
    .sheet { width: 198mm; height: 285mm; box-shadow: none; page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="sheet-top">
      <table class="header-table">
        <tr>
          <td class="logo-cell"><img class="logo" src="${logoSrc}" alt="Logo" /></td>
          <td class="company">
            <div class="inv-title">${esc(fmt.title)}</div>
            <div class="co-name">${esc(fmt.legalName)}</div>
            <div class="co-line">${esc(fmt.address)}</div>
            <div class="co-line">${esc(fmt.phones)}</div>
            <div class="co-line gstin">GSTIN : ${esc(fmt.gstin)}</div>
            <div class="co-line">${esc(fmt.telEmailLine || `Tel.:${fmt.phones}-email:${fmt.email}`)}</div>
          </td>
          <td class="copy-cell"><div class="copy">${esc(fmt.copyLabel || "Original Copy")}</div></td>
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
              <tr><td class="k">E-Way Bill No.</td><td class="eway-no">: ${
                invoice.ewayBillNo
                  ? `<strong>${esc(invoice.ewayBillNo)}</strong>`
                  : ""
              }</td></tr>
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
    </div>

    <div class="sheet-mid">
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
          <tr class="spacer-row"><td colspan="7"></td></tr>
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
      ${hsnSummaryHtml}
    </div>

    <div class="sheet-bottom">
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

function invoiceFileKindTag(invoice) {
  if (invoice?.invoiceKind === "net-meter") return "NetMeter";
  if (invoice && !invoice.withGst) return "WithoutGST";
  return "WithGST";
}

function purgeMatchingInvoiceDocs(consumerNo, invoiceNo, kind) {
  const safe = String(invoiceNo || "").replace(/[^\w/-]+/g, "_");
  const docs = listCustomerDocuments(consumerNo, { source: "sale" }).filter(
    (d) => d.category === "sale-invoice",
  );
  docs.forEach((doc) => {
    const name = String(doc.fileName || "");
    if (!name.includes(safe)) return;
    /* Same kind, or legacy file without kind tag */
    if (name.includes(kind) || (!name.includes("WithGST") && !name.includes("WithoutGST") && !name.includes("NetMeter"))) {
      removeCustomerDocument(doc.id);
    }
  });
}

export async function saveInvoiceDocumentToFolder(invoice) {
  const withEway = {
    ...invoice,
    ewayBillNo: invoice.ewayBillNo || "",
  };
  const html = buildSaleInvoiceHtml(withEway);
  const safeNo = String(invoice.invoiceNo).replace(/[^\w/-]+/g, "_");
  const kind = invoiceFileKindTag(invoice);
  const fileName = `Invoice-${safeNo}-${kind}.html`;
  const subfolder = `${invoiceSubfolder(invoice.invoiceNo)}/${kind}`;

  purgeMatchingInvoiceDocs(invoice.consumerNo, invoice.invoiceNo, kind);

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
  const kind = invoiceFileKindTag(invoice);
  const fileName = `EWayBill-${String(eway.ewayBillNo).replace(/[^\w/-]+/g, "_")}-${kind}.html`;
  const subfolder = `${invoiceSubfolder(invoice.invoiceNo)}/${kind}`;
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

export function findInvoiceDocument(consumerNo, invoiceNo, kindHint) {
  const docs = listCustomerDocuments(consumerNo, { source: "sale" });
  const safe = String(invoiceNo || "").replace(/[^\w/-]+/g, "_");
  const tag =
    kindHint === "net-meter"
      ? "NetMeter"
      : kindHint === "without-gst"
        ? "WithoutGST"
        : kindHint === "with-gst"
          ? "WithGST"
          : "";
  const invoiceDocs = docs.filter((d) => d.category === "sale-invoice");
  if (tag) {
    const hit = invoiceDocs.find(
      (d) =>
        String(d.fileName || "").includes(safe) && String(d.fileName || "").includes(tag),
    );
    if (hit) return hit;
  }
  return (
    invoiceDocs.find((d) => String(d.fileName || "").includes(safe)) || invoiceDocs[0] || null
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
    amountInclusive: false,
    panelName: sample.panelName,
    inverterName: sample.inverterName,
    inverterSerial: sample.inverterSerial,
    setupKw: sample.setupKw,
    format,
  });
  return buildSaleInvoiceHtml({ ...sample, ...calc, withGst: true }, format);
}
