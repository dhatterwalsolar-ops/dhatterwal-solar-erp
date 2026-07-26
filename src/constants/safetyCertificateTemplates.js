const COMPANY = {
  name: "Dhatterwal Solar",
  tagline: "Work OS — Safety Certificate (Proforma)",
};

function kwKey(setupKw) {
  const s = String(setupKw || "").toUpperCase();
  if (s.includes("05")) return "05";
  if (s.includes("03")) return "03";
  return "02";
}

const SETUP_NOTES = {
  "02": "02 kW rooftop solar — standard PPE, ladder safety, and DC isolation checklist.",
  "03": "03 kW rooftop solar — extended DC run; earthing verification mandatory.",
  "05": "05 kW rooftop solar — multi-string layout; additional fall-protection measures.",
};

export function buildSafetyCertificateHtml({ customer, bom, setupKw, date }) {
  const k = kwKey(setupKw);
  const note = SETUP_NOTES[k] || SETUP_NOTES["02"];
  const labourDate = bom?.labourDate || "—";
  const panel = bom?.panelDetail || "As per BOM Sheet";
  const inverter = bom?.inverterDetail || "As per BOM Sheet";
  const serial = bom?.inverterSerial || "—";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Work OS Safety Certificate — ${customer?.consumerNo || ""}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; color: #1a1a1a; }
    h1 { color: #004D00; font-size: 1.25rem; }
    .meta { margin: 1rem 0; line-height: 1.6; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    td, th { border: 1px solid #ccc; padding: 0.5rem; text-align: left; font-size: 0.9rem; }
    th { background: #edf5ef; }
    .footer { margin-top: 2rem; font-size: 0.85rem; color: #555; }
  </style>
</head>
<body>
  <h1>${COMPANY.name} — ${COMPANY.tagline}</h1>
  <p><strong>Certificate Date:</strong> ${date || new Date().toLocaleDateString("en-GB")}</p>
  <div class="meta">
    <p><strong>Consumer No.:</strong> ${customer?.consumerNo || "—"}</p>
    <p><strong>Consumer Name:</strong> ${customer?.customerName || "—"}</p>
    <p><strong>Father Name:</strong> ${customer?.fatherName || "—"}</p>
    <p><strong>Address:</strong> ${customer?.address || "—"}</p>
    <p><strong>Setup:</strong> ${setupKw || "—"}</p>
    <p><strong>Setup guideline:</strong> ${note}</p>
  </div>
  <table>
    <tr><th colspan="2">Installation details (from BOM / labour Google Form)</th></tr>
    <tr><td>Labour completion date</td><td>${labourDate}</td></tr>
    <tr><td>Panel detail</td><td>${panel}</td></tr>
    <tr><td>Inverter detail</td><td>${inverter}</td></tr>
    <tr><td>Inverter serial no.</td><td>${serial}</td></tr>
    <tr><td>Copper wire</td><td>${bom?.copperWire || "—"}</td></tr>
    <tr><td>Main wire</td><td>${bom?.mainWire || "—"}</td></tr>
    <tr><td>Structure stand</td><td>${bom?.stand || "—"}</td></tr>
  </table>
  <p class="footer">This proforma is auto-filled from ERP setup and BOM data. Replace with your final signed Work OS template when ready.</p>
</body>
</html>`;
}

export function buildBomAnnexureHtml({ customer, bom, setupKw }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>Annexure — BOM Details</title>
<style>body{font-family:Arial,sans-serif;margin:2rem}h1{color:#004D00;font-size:1.1rem}pre{background:#f5f5f5;padding:1rem;border-radius:8px;white-space:pre-wrap}</style>
</head>
<body>
<h1>Annexure — Panel &amp; Inverter (Consumer ${customer?.consumerNo || ""})</h1>
<p><strong>Setup:</strong> ${setupKw || "—"}</p>
<pre>${[
    `Consumer: ${customer?.customerName || "—"}`,
    `Labour Date: ${bom?.labourDate || "—"}`,
    `Panel Detail: ${bom?.panelDetail || "—"}`,
    `Inverter Detail: ${bom?.inverterDetail || "—"}`,
    `Inverter Serial: ${bom?.inverterSerial || "—"}`,
    `Copper Wire: ${bom?.copperWire || "—"}`,
    `Main Wire: ${bom?.mainWire || "—"}`,
    `Stand: ${bom?.stand || "—"}`,
  ].join("\n")}</pre>
</body></html>`;
}
