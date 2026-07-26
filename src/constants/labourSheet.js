export const LABOUR_TEAM_LEADERS = [
  { id: "tl-1", name: "Ravi Kumar", type: "Team Leader", wage: 700 },
  { id: "tl-2", name: "Sunil Kumar", type: "Team Leader", wage: 700 },
  { id: "tl-3", name: "Mohit", type: "Team Leader", wage: 700 },
  { id: "tl-4", name: "Aman", type: "Team Leader", wage: 700 },
  { id: "tl-5", name: "Vikas", type: "Team Leader", wage: 700 },
];

export const LABOUR_HELPERS = [
  { id: "h-1", name: "Mohit", type: "Helper", wage: 500 },
  { id: "h-2", name: "Aman", type: "Helper", wage: 500 },
  { id: "h-3", name: "Vikas", type: "Helper", wage: 500 },
  { id: "h-4", name: "Rohit", type: "Helper", wage: 500 },
  { id: "h-5", name: "Suresh", type: "Helper", wage: 500 },
  { id: "h-6", name: "Rajesh", type: "Helper", wage: 500 },
  { id: "h-7", name: "Deepak", type: "Helper", wage: 500 },
  { id: "h-8", name: "Sanjay", type: "Helper", wage: 500 },
  { id: "h-9", name: "Nitin", type: "Helper", wage: 500 },
  { id: "h-10", name: "Manoj", type: "Helper", wage: 500 },
  { id: "h-11", name: "Pankaj", type: "Helper", wage: 500 },
  { id: "h-12", name: "Ankit", type: "Helper", wage: 500 },
  { id: "h-13", name: "Rakesh", type: "Helper", wage: 500 },
  { id: "h-14", name: "Sunil", type: "Helper", wage: 500 },
  { id: "h-15", name: "Ajay", type: "Helper", wage: 500 },
];

export const LABOUR_ALL_WORKERS = [...LABOUR_TEAM_LEADERS, ...LABOUR_HELPERS];

export const INSTALLATION_ITEM_ROWS = [
  { key: "panelCompany", label: "1. Panel Company", placeholder: "WAAREE" },
  { key: "panelWatt", label: "2. Panel Watt", placeholder: "550 WATT" },
  { key: "panelQty", label: "3. Panel Quantity", placeholder: "10 NOS." },
  {
    key: "panelSerial",
    label: "4. Panel Serial No.",
    multiline: true,
    placeholder: "One serial per line",
  },
  { key: "inverterCompany", label: "5. Inverter Company", placeholder: "GROWATT" },
  { key: "inverterModel", label: "6. Inverter Model", placeholder: "5 KW ON GRID" },
  { key: "inverterSerial", label: "7. Inverter Serial No.", placeholder: "GRW-5K-99214" },
  { key: "structureType", label: "8. Structure Type", placeholder: "GI STRUCTURE" },
  { key: "dcWire", label: "9. DC Wire", placeholder: "4 SQ MM — 40 MTR" },
  { key: "acWire", label: "10. AC Wire", placeholder: "6 SQ MM — 25 MTR" },
  { key: "earthing", label: "11. Earthing", placeholder: "COPPER — 2 SET" },
  { key: "la", label: "12. LA (Lightning Arrester)", placeholder: "1 NOS." },
  { key: "dcdb", label: "13. DCDB", placeholder: "1 NOS." },
  { key: "acdb", label: "14. ACDB", placeholder: "1 NOS." },
  { key: "netMeter", label: "15. Net Meter", placeholder: "PENDING / DONE" },
  { key: "otherItems", label: "16. Other Items", placeholder: "Extra material if any" },
  { key: "sitePhotos", label: "17. Site Photos", isPhotos: true },
];

export const BOM_STOCK_BASE = [
  { material: "Solar Panel 550W", unit: "NOS", stockBefore: 120 },
  { material: "Inverter 5KW", unit: "NOS", stockBefore: 18 },
  { material: "DC Wire 4 sq mm", unit: "MTR", stockBefore: 500 },
  { material: "AC Wire 6 sq mm", unit: "MTR", stockBefore: 350 },
  { material: "Earthing Copper", unit: "SET", stockBefore: 40 },
  { material: "Structure Kit", unit: "SET", stockBefore: 25 },
  { material: "DCDB Box", unit: "NOS", stockBefore: 30 },
  { material: "ACDB Box", unit: "NOS", stockBefore: 28 },
];

export const DEFAULT_LEAVE_ROWS = [
  { employeeName: "Rohit", date: "20/07/2025", type: "Leave", remarks: "Personal" },
  { employeeName: "Sanjay", date: "21/07/2025", type: "Holiday", remarks: "Sunday" },
];

export const DEFAULT_INSTALLATION = {
  panelCompany: "WAAREE",
  panelWatt: "550 WATT",
  panelQty: "10",
  panelSerial:
    "WA-550-77821\nWA-550-77822\nWA-550-77823\nWA-550-77824\nWA-550-77825\nWA-550-77826\nWA-550-77827\nWA-550-77828\nWA-550-77829\nWA-550-77830",
  inverterCompany: "GROWATT",
  inverterModel: "5 KW ON GRID",
  inverterSerial: "GRW-5K-99214",
  structureType: "GI STRUCTURE",
  dcWire: "40",
  acWire: "25",
  earthing: "2",
  la: "1",
  dcdb: "1",
  acdb: "1",
  netMeter: "PENDING",
  otherItems: "",
};

export function parseFirstNumber(text) {
  const match = String(text || "").match(/[\d.]+/);
  return match ? Number(match[0]) : 0;
}

export function calcWorkingHours(start, end) {
  if (!start || !end) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return "";
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function buildBomRows(installation) {
  const panelQty = parseFirstNumber(installation.panelQty);
  const dcMtr = parseFirstNumber(installation.dcWire);
  const acMtr = parseFirstNumber(installation.acWire);
  const earthSet = parseFirstNumber(installation.earthing) || 2;
  const structSet = 1;
  const dcdb = parseFirstNumber(installation.dcdb) || 1;
  const acdb = parseFirstNumber(installation.acdb) || 1;

  const used = [
    panelQty,
    1,
    dcMtr,
    acMtr,
    earthSet,
    structSet,
    dcdb,
    acdb,
  ];

  return BOM_STOCK_BASE.map((row, i) => {
    const qtyUsed = used[i] || 0;
    const stockAfter = Math.max(0, row.stockBefore - qtyUsed);
    return {
      ...row,
      qtyUsed,
      stockAfter,
    };
  });
}

export function buildWorkSummary(installation) {
  const qty = parseFirstNumber(installation.panelQty);
  const watt = parseFirstNumber(installation.panelWatt) || 550;
  const kwp = ((qty * watt) / 1000).toFixed(1);
  return {
    totalPanel: `${qty} NOS / ${kwp} KWp`,
    totalInverter: "1 NOS",
    totalDcWire: `${parseFirstNumber(installation.dcWire)} MTR`,
    totalAcWire: `${parseFirstNumber(installation.acWire)} MTR`,
    status: installation.netMeter?.toUpperCase().includes("DONE") ? "COMPLETED" : "IN PROGRESS",
  };
}
