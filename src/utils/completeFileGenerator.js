import {
  buildBomAnnexureHtml,
  buildSafetyCertificateHtml,
} from "../constants/safetyCertificateTemplates";
import {
  addCustomerDocument,
  downloadStoredDocument,
  listCustomerDocuments,
} from "./customerDocuments";

function timestampSlug() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function dataUrlFromText(html, mime = "text/html") {
  return `data:${mime};charset=utf-8,${encodeURIComponent(html)}`;
}

function buildManifestHtml({ customer, setupKw, packageFolder, included }) {
  const rows = included
    .map(
      (item) =>
        `<tr><td>${item.type}</td><td>${item.fileName}</td><td>${item.source || "generated"}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>Complete File Package</title>
<style>
body{font-family:Arial,sans-serif;margin:2rem}
h1{color:#004D00}
table{border-collapse:collapse;width:100%;margin-top:1rem}
td,th{border:1px solid #ccc;padding:0.5rem;text-align:left}
th{background:#edf5ef}
</style></head>
<body>
<h1>Complete File Package</h1>
<p><strong>Consumer No.:</strong> ${customer.consumerNo}</p>
<p><strong>Name:</strong> ${customer.customerName}</p>
<p><strong>Setup:</strong> ${setupKw || "—"}</p>
<p><strong>Virtual folder:</strong> ${packageFolder}</p>
<table><thead><tr><th>Type</th><th>File</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table>
<p>All items are saved under this consumer folder in ERP storage (browser). Use Sale Sheet to download individual uploads.</p>
</body></html>`;
}

export async function generateCompleteFilePackage({
  customer,
  bom,
  setupKw,
  date,
  jointReportDataUrl,
  jointReportFileName,
}) {
  const subfolder = `CompleteFile-${timestampSlug()}`;
  const included = [];

  const safetyHtml = buildSafetyCertificateHtml({ customer, bom, setupKw, date });
  const safetyName = `Work-OS-Safety-Certificate-${customer.consumerNo}.html`;
  await addCustomerDocument({
    consumerNo: customer.consumerNo,
    source: "sale",
    category: "safety-certificate",
    fileName: safetyName,
    mimeType: "text/html",
    dataUrl: dataUrlFromText(safetyHtml),
    subfolder,
  });
  included.push({ type: "Work OS Safety Certificate", fileName: safetyName, source: "auto (setup + BOM)" });

  const annexHtml = buildBomAnnexureHtml({ customer, bom, setupKw });
  const annexName = `Annexure-BOM-Panel-Inverter-${customer.consumerNo}.html`;
  await addCustomerDocument({
    consumerNo: customer.consumerNo,
    source: "sale",
    category: "annexure",
    fileName: annexName,
    mimeType: "text/html",
    dataUrl: dataUrlFromText(annexHtml),
    subfolder,
  });
  included.push({ type: "Annexure (Panel / Inverter)", fileName: annexName, source: "BOM Sheet" });

  const loanCashDocs = listCustomerDocuments(customer.consumerNo).filter(
    (d) => d.source === "loan" || d.source === "cash",
  );
  for (const doc of loanCashDocs) {
    included.push({
      type: "Customer document",
      fileName: doc.fileName,
      source: doc.source,
    });
  }

  if (jointReportDataUrl && jointReportFileName) {
    await addCustomerDocument({
      consumerNo: customer.consumerNo,
      source: "sale",
      category: "joint-report",
      fileName: jointReportFileName,
      mimeType: "application/octet-stream",
      dataUrl: jointReportDataUrl,
      subfolder,
    });
    included.push({ type: "Joint Report", fileName: jointReportFileName, source: "upload (Sale Sheet)" });
  }

  const packageFolder = `CustomerDocuments/${customer.consumerNo}/${subfolder}`;
  const manifestName = `Complete-File-Manifest-${customer.consumerNo}.html`;
  const manifestHtml = buildManifestHtml({
    customer,
    setupKw,
    packageFolder,
    included,
  });
  const manifestDoc = await addCustomerDocument({
    consumerNo: customer.consumerNo,
    source: "sale",
    category: "complete-package",
    fileName: manifestName,
    mimeType: "text/html",
    dataUrl: dataUrlFromText(manifestHtml),
    subfolder,
  });

  downloadStoredDocument(manifestDoc);

  return { packageFolder, included, subfolder };
}
