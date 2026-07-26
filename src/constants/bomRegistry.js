function standForKw(setupKw) {
  const kw = String(setupKw || "").replace(/\s/g, "").toUpperCase();
  if (kw.includes("05")) return "05 kW Structure Stand";
  if (kw.includes("03")) return "03 kW Structure Stand";
  return "02 kW Structure Stand";
}

export const BOM_BY_CONSUMER = {
  "CN-240701": {
    labourDate: "15/07/2025",
    panelDetail: "Mono PERC 540W × 4 Nos",
    inverterDetail: "3kW On-Grid Inverter",
    inverterSerial: "GRW-3K-77821",
    copperWire: "Copper Wire 4 sq mm — 12 m",
    mainWire: "Main Wire 6 sq mm — 18 m",
    stand: standForKw("02 kW"),
  },
  "CN-240702": {
    labourDate: "14/07/2025",
    panelDetail: "Mono PERC 540W × 6 Nos",
    inverterDetail: "5kW Hybrid Inverter",
    inverterSerial: "GRW-5K-99214",
    copperWire: "Copper Wire 4 sq mm — 16 m",
    mainWire: "Main Wire 10 sq mm — 22 m",
    stand: standForKw("03 kW"),
  },
  "CN-C240701": {
    labourDate: "16/07/2025",
    panelDetail: "Mono PERC 540W × 4 Nos",
    inverterDetail: "3kW On-Grid Inverter",
    inverterSerial: "GRW-3K-88102",
    copperWire: "Copper Wire 4 sq mm — 12 m",
    mainWire: "Main Wire 6 sq mm — 18 m",
    stand: standForKw("02 kW"),
  },
  "CN-C240702": {
    labourDate: "13/07/2025",
    panelDetail: "Mono PERC 540W × 10 Nos",
    inverterDetail: "8kW Hybrid Inverter",
    inverterSerial: "GRW-8K-44110",
    copperWire: "Copper Wire 6 sq mm — 20 m",
    mainWire: "Main Wire 10 sq mm — 28 m",
    stand: standForKw("05 kW"),
  },
};

export function lookupBom(consumerNo) {
  const key = String(consumerNo || "").trim().toUpperCase();
  return BOM_BY_CONSUMER[key] ?? null;
}

export function formatSetupDetail(bom) {
  if (!bom) {
    return "BOM not found — fill BOM Sheet for this Consumer No.";
  }

  return [
    `Labour Date: ${bom.labourDate}`,
    `Panel Detail: ${bom.panelDetail}`,
    `Inverter Detail: ${bom.inverterDetail}`,
    `Inverter Serial No.: ${bom.inverterSerial}`,
    `Copper Wire: ${bom.copperWire}`,
    `Main Wire: ${bom.mainWire}`,
    `Stand: ${bom.stand}`,
  ].join("\n");
}
