import {
  BOM_CHARGE_FIELDS,
  computeTotalKharch,
  fileTotalAmount,
  getBomFile,
  isDirectReference,
  lineAmount,
} from "./bomSheetStorage";
import {
  addCustomerDocument,
  listCustomerDocuments,
  removeCustomerDocument,
} from "./customerDocuments";
import {
  renderHtmlToJpegDataUrl,
  renderHtmlToPdfDataUrl,
} from "./htmlToPdfDownload";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function dataUrlFromHtml(html) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function approxBytes(dataUrl) {
  return Math.ceil((String(dataUrl || "").length * 3) / 4);
}

export function buildBomSheetHtml(file) {
  if (!file) return "";
  const items = (file.items || []).filter(
    (row) => String(row.detail || "").trim() && String(row.detail).trim() !== "—",
  );
  const charges = file.charges || {};
  const materialsTotal = fileTotalAmount(file.items || []);
  const totalKharch = computeTotalKharch(file);
  const refPay = isDirectReference(file.reference)
    ? 0
    : Number(file.referencePayment) || 0;

  const itemRows = items
    .map(
      (row) => `
      <tr>
        <td>${esc(row.itemName)}</td>
        <td>${esc(row.detail)}</td>
        <td class="num">${esc(row.qty)}</td>
        <td>${esc(row.unit)}</td>
        <td class="num">${fmtMoney(row.rate)}</td>
        <td class="num">${fmtMoney(lineAmount(row))}</td>
      </tr>`,
    )
    .join("");

  const chargeRows = BOM_CHARGE_FIELDS.map(
    (f) => `
      <tr>
        <td colspan="5">${esc(f.label)}</td>
        <td class="num">${fmtMoney(charges[f.key])}</td>
      </tr>`,
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>BOM Sheet — ${esc(file.consumerNo)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      color: #12241a;
      margin: 0;
      padding: 18px 20px 28px;
      background: #fff;
      font-size: 12px;
    }
    h1 {
      margin: 0 0 4px;
      font-size: 20px;
      letter-spacing: 0.02em;
      color: #0b3d2c;
    }
    .sub { color: #4a6356; margin-bottom: 14px; }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 16px;
      margin-bottom: 14px;
      padding: 10px 12px;
      background: #f3f8f4;
      border: 1px solid #d5e5db;
    }
    .meta div span { color: #5a7264; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    th, td {
      border: 1px solid #c5d6cb;
      padding: 6px 7px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #0b3d2c;
      color: #fff;
      font-weight: 600;
    }
    .num { text-align: right; white-space: nowrap; }
    .section { margin-top: 16px; font-weight: 700; color: #0b3d2c; }
    .total-row td {
      background: #e8f3ec;
      font-weight: 700;
    }
    .foot {
      margin-top: 14px;
      color: #6a7f72;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <h1>Dhatterwal Solar — BOM Sheet</h1>
  <div class="sub">Site / material &amp; site kharch summary</div>
  <div class="meta">
    <div><span>Consumer No.</span><br /><strong>${esc(file.consumerNo)}</strong></div>
    <div><span>Customer</span><br /><strong>${esc(file.customerName || "—")}</strong></div>
    <div><span>Setup</span><br /><strong>${esc(file.setupKw || "—")}</strong></div>
    <div><span>Team</span><br /><strong>${esc(file.teamWork || "—")}</strong></div>
    <div><span>Reference</span><br /><strong>${esc(file.reference || "—")}</strong></div>
    <div><span>Labour / Sale Date</span><br /><strong>${esc(
      file.materials?.labourDate || file.saleDate || "—",
    )}</strong></div>
    <div style="grid-column:1/-1"><span>Address</span><br /><strong>${esc(
      file.address || "—",
    )}</strong></div>
  </div>

  <div class="section">Materials</div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>Detail</th>
        <th>Qty</th>
        <th>Unit</th>
        <th>Rate</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || `<tr><td colspan="6">No material lines</td></tr>`}
      <tr class="total-row">
        <td colspan="5">Materials total</td>
        <td class="num">₹ ${fmtMoney(materialsTotal)}</td>
      </tr>
    </tbody>
  </table>

  <div class="section">Site charges</div>
  <table>
    <thead>
      <tr>
        <th colspan="5">Charge</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${chargeRows}
      <tr>
        <td colspan="5">Reference payment${
          isDirectReference(file.reference) ? " (Direct = 0)" : ""
        }</td>
        <td class="num">₹ ${fmtMoney(refPay)}</td>
      </tr>
      <tr class="total-row">
        <td colspan="5">Total Kharch</td>
        <td class="num">₹ ${fmtMoney(totalKharch)}</td>
      </tr>
    </tbody>
  </table>
  <div class="foot">Auto-saved to customer folder · ${esc(
    new Date().toLocaleString("en-IN"),
  )}</div>
</body>
</html>`;
}

function purgePreviousBomDocs(consumerNo) {
  const docs = listCustomerDocuments(consumerNo, { source: "sale" }).filter(
    (d) => d.category === "bom-sheet" || d.category === "bom-sheet-image",
  );
  docs.forEach((d) => removeCustomerDocument(d.id));
}

/**
 * BOM Sheet → PDF + JPG → customer folder (automatic).
 * PDF fail / too large hone pe HTML fallback.
 */
export async function saveBomSheetDocumentToFolder(consumerNo, { alsoJpeg = true } = {}) {
  const cn = String(consumerNo || "").trim().toUpperCase();
  if (!cn) return { ok: false, message: "Consumer No. missing." };

  const file = getBomFile(cn);
  if (!file) return { ok: false, message: "BOM file nahi mili." };

  const html = buildBomSheetHtml(file);
  if (!html) return { ok: false, message: "BOM HTML empty." };

  const safe = cn.replace(/[^\w/-]+/g, "_");
  const stamp = new Date().toISOString().slice(0, 10);
  const subfolder = "BOM";
  const saved = [];

  purgePreviousBomDocs(cn);

  /* Always keep HTML (small, previewable) */
  try {
    const htmlDoc = await addCustomerDocument({
      consumerNo: cn,
      source: "sale",
      category: "bom-sheet",
      fileName: `BOM-Sheet-${safe}-${stamp}.html`,
      mimeType: "text/html",
      dataUrl: dataUrlFromHtml(html),
      subfolder,
    });
    saved.push(htmlDoc);
  } catch (err) {
    return { ok: false, message: err?.message || "BOM HTML folder save fail." };
  }

  /* PDF */
  try {
    const pdf = await renderHtmlToPdfDataUrl(html);
    if (pdf?.dataUrl && approxBytes(pdf.dataUrl) <= 4 * 1024 * 1024) {
      const pdfDoc = await addCustomerDocument({
        consumerNo: cn,
        source: "sale",
        category: "bom-sheet",
        fileName: `BOM-Sheet-${safe}-${stamp}.pdf`,
        mimeType: "application/pdf",
        dataUrl: pdf.dataUrl,
        subfolder,
      });
      saved.push(pdfDoc);
    }
  } catch (err) {
    console.warn("[BOM PDF folder]", err?.message || err);
  }

  /* JPG snapshot */
  if (alsoJpeg) {
    try {
      const jpg = await renderHtmlToJpegDataUrl(html, { quality: 0.8 });
      if (jpg?.dataUrl && approxBytes(jpg.dataUrl) <= 4 * 1024 * 1024) {
        const jpgDoc = await addCustomerDocument({
          consumerNo: cn,
          source: "sale",
          category: "bom-sheet-image",
          fileName: `BOM-Sheet-${safe}-${stamp}.jpg`,
          mimeType: "image/jpeg",
          dataUrl: jpg.dataUrl,
          subfolder,
        });
        saved.push(jpgDoc);
      }
    } catch (err) {
      console.warn("[BOM JPG folder]", err?.message || err);
    }
  }

  return { ok: true, saved, consumerNo: cn };
}

/** Debounced auto-save (BomSheet edits). */
const pendingTimers = new Map();

export function scheduleBomSheetFolderSave(consumerNo, delayMs = 1600) {
  const cn = String(consumerNo || "").trim().toUpperCase();
  if (!cn || typeof window === "undefined") return;
  const prev = pendingTimers.get(cn);
  if (prev) window.clearTimeout(prev);
  const t = window.setTimeout(() => {
    pendingTimers.delete(cn);
    void saveBomSheetDocumentToFolder(cn).catch((err) => {
      console.warn("[BOM folder auto-save]", err?.message || err);
    });
  }, delayMs);
  pendingTimers.set(cn, t);
}
