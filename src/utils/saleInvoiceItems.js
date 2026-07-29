import { getBomMaterialsForConsumer } from "./bomSheetStorage";
import { getSiteOrderById, listSiteOrders } from "./siteOrderStorage";

function findSiteOrderForSale(saleRow) {
  if (saleRow?.siteOrderId) {
    const byId = getSiteOrderById(saleRow.siteOrderId);
    if (byId) return byId;
  }
  const key = String(saleRow?.consumerNo || "")
    .trim()
    .toUpperCase();
  if (!key) return null;
  const orders = listSiteOrders().filter(
    (o) => String(o.consumerNo || "").trim().toUpperCase() === key,
  );
  return (
    orders.find((o) => o.formPayload) ||
    orders.find((o) => o.status === "submitted") ||
    orders[0] ||
    null
  );
}

/** Panel / inverter lines from Setup Detail (BOM) + site order serials when available. */
export function resolveInvoiceItemDetails(saleRow) {
  const bom = getBomMaterialsForConsumer(saleRow?.consumerNo) || {};
  const site = findSiteOrderForSale(saleRow);
  const payload = site?.formPayload || {};

  const panelName =
    payload.panelProductName ||
    bom.panelDetail ||
    "Solar Panel";
  const inverterName =
    payload.inverterName ||
    bom.inverterDetail ||
    "Inverter";
  const inverterSerial =
    payload.inverterSerial ||
    bom.inverterSerial ||
    "";

  return {
    panelName,
    inverterName,
    inverterSerial,
    setupKw: saleRow?.setupKw || "",
  };
}
