export const PRODUCT_CATEGORIES = [
  "PANEL",
  "INVERTER",
  "AC BOX",
  "DC BOX",
  "STAND",
  "WIRE",
  "GENERAL",
  "CONDUTER",
];

export const DEFAULT_PRODUCT_ITEMS = [
  { itemName: "Mono 550W Panel", category: "PANEL", hsn: "85414011" },
  { itemName: "Mono 540W Panel", category: "PANEL", hsn: "85414011" },
  { itemName: "5kW Hybrid Inverter", category: "INVERTER", hsn: "85044090" },
  { itemName: "3kW On-Grid Inverter", category: "INVERTER", hsn: "85044090" },
  { itemName: "ACDB Box", category: "AC BOX", hsn: "85371000" },
  { itemName: "DCDB Box", category: "DC BOX", hsn: "85371000" },
  { itemName: "GI Structure Kit 5kW", category: "STAND", hsn: "73089090" },
  { itemName: "DC Wire 4 sq mm", category: "WIRE", hsn: "85444999" },
  { itemName: "AC Wire 6 sq mm", category: "WIRE", hsn: "85444999" },
  { itemName: "Earthing Kit", category: "GENERAL", hsn: "74130000" },
  { itemName: "PVC Conduit Pipe", category: "CONDUTER", hsn: "39172390" },
  { itemName: "Net Meter Single Phase", category: "GENERAL", hsn: "90283010" },
];

export function createDraftProductRow() {
  return {
    id: `prod-draft-${Date.now()}`,
    itemName: "",
    category: "",
    hsn: "",
    stockQty: "",
    rate: "",
    isDraft: true,
  };
}
