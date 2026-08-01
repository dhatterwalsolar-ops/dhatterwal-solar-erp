import { applySiteOrderFormToBom } from "./bomSheetStorage";
import {
  addCustomerDocument,
  readFileAsDataUrl,
} from "./customerDocuments";
import { findProductByName } from "./productStorage";
import { applyBomToSaleSetupDetail, SALE_BOM_SYNC_EVENT } from "./saleCaseStorage";
import { SALE_CASE_SYNC_EVENT } from "./saleCaseSync";
import { applyStockOut, notifyStockSync } from "./stockStorage";
import { serialExistsInStock } from "./stockSerialInventory";
import { markSiteOrderSubmitted } from "./siteOrderStorage";

function lineWithProductId(line) {
  const matched = findProductByName(line.itemName);
  return {
    ...line,
    productId: line.productId || matched?.id || "",
  };
}

function parseQty(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function saveSiteDoc(order, file, category, subfolder) {
  if (!file) return null;
  const dataUrl = await readFileAsDataUrl(file);
  return addCustomerDocument({
    consumerNo: order.consumerNo,
    source: "sale",
    category,
    fileName: file.name || `${category}.jpg`,
    mimeType: file.type || "application/octet-stream",
    dataUrl,
    subfolder,
  });
}

export async function submitSiteInstallationForm(order, form) {
  if (!order?.id) return { ok: false, message: "Order missing." };
  if (order.status === "submitted") {
    return { ok: false, message: "Yeh site form pehle hi submit ho chuka hai." };
  }

  const lines = [];
  const errors = [];
  const panelQty = parseQty(form.panelQty);
  const panelName = String(form.panelName || form.panelProductName || "Solar Panel").trim();

  if (!panelName) errors.push("Panel name zaroori hai.");
  if (!(panelQty > 0)) errors.push("Panel quantity zaroori hai.");

  if (panelQty > 0 && panelName) {
    lines.push(
      lineWithProductId({
        itemName: panelName,
        category: "PANEL",
        qty: panelQty,
        unit: "NOS",
      }),
    );
  }

  const inverterName =
    String(form.inverterName || "").trim() ||
    `Inverter (${form.inverterKw || "02 KW"})`;
  const inverterSerial = String(form.inverterSerial || "").trim();

  if (inverterSerial) {
    if (!serialExistsInStock(inverterSerial, { category: "INVERTER" })) {
      lines.push(
        lineWithProductId({
          itemName: inverterName,
          category: "INVERTER",
          qty: 1,
          unit: "NOS",
          serialNumbers: inverterSerial,
        }),
      );
    } else {
      lines.push(
        lineWithProductId({
          itemName: inverterName,
          category: "INVERTER",
          qty: 1,
          unit: "NOS",
          serialNumbers: inverterSerial,
        }),
      );
    }
  } else {
    lines.push(
      lineWithProductId({
        itemName: inverterName,
        category: "INVERTER",
        qty: 1,
        unit: "NOS",
      }),
    );
  }

  const wireDefs = [
    { key: "dcWireMtr", itemName: "DC Wire", category: "WIRE" },
    { key: "copperWireMtr", itemName: "Copper Wire", category: "WIRE" },
    { key: "mainWireMtr", itemName: "Main Wire", category: "WIRE" },
  ];
  for (const def of wireDefs) {
    const qty = parseQty(form[def.key]);
    if (qty <= 0) continue;
    lines.push(
      lineWithProductId({
        itemName: def.itemName,
        category: def.category,
        qty,
        unit: "MTR",
      }),
    );
  }

  /* Legacy wireLines support */
  for (const wire of form.wireLines || []) {
    const qty = parseQty(wire.qtyMtr);
    if (qty <= 0) continue;
    lines.push(
      lineWithProductId({
        productId: wire.productId || "",
        itemName: wire.itemName,
        category: wire.category || "WIRE",
        qty,
        unit: "MTR",
      }),
    );
  }

  const countDefs = [
    { key: "acBoxQty", itemName: "AC Box", category: "AC BOX", unit: "NOS" },
    { key: "dcBoxQty", itemName: "DC Box", category: "DC BOX", unit: "NOS" },
    { key: "laQty", itemName: "LA", category: "GENERAL", unit: "NOS" },
    {
      key: "earthingRodQty",
      itemName: "Earthing Rod",
      category: "GENERAL",
      unit: "NOS",
    },
  ];
  for (const def of countDefs) {
    const qty = parseQty(form[def.key]);
    if (qty <= 0) continue;
    lines.push(
      lineWithProductId({
        itemName: def.itemName,
        category: def.category,
        qty,
        unit: def.unit,
      }),
    );
  }

  const standKw = String(form.standKw || "").trim() || "02 KW";
  const standLabel =
    standKw === "OTHER"
      ? String(form.standOther || "").trim() || "OTHER Stand"
      : `${standKw} Structure Stand`;
  lines.push(
    lineWithProductId({
      itemName: standLabel,
      category: "STAND",
      qty: 1,
      unit: "SET",
    }),
  );

  for (const piece of form.countLines || []) {
    const qty = parseQty(piece.qty);
    if (qty <= 0) continue;
    lines.push(
      lineWithProductId({
        productId: piece.productId || "",
        itemName: piece.itemName,
        category: piece.category || "GENERAL",
        qty,
        unit: piece.unit || "NOS",
      }),
    );
  }

  if (!form.siteGpsPhoto) errors.push("Site GPS photo zaroori hai.");
  if (!form.earthingPhoto) errors.push("Earthing photo zaroori hai.");

  if (errors.length) {
    return { ok: false, message: errors.join("\n") };
  }

  let gpsDoc = null;
  let earthDoc = null;
  let completeDoc = null;
  try {
    gpsDoc = await saveSiteDoc(order, form.siteGpsPhoto, "site-gps-photo", "site");
    earthDoc = await saveSiteDoc(order, form.earthingPhoto, "earthing-photo", "site");
    if (form.completeFile) {
      completeDoc = await saveSiteDoc(
        order,
        form.completeFile,
        "complete-package",
        "complete",
      );
    }
  } catch (err) {
    return { ok: false, message: err?.message || "Photo / file save fail." };
  }

  const formPayload = {
    teamMembers: form.teamMembers || [],
    panelName,
    panelQty,
    inverterKw: form.inverterKw || "",
    inverterName,
    inverterSerial,
    acBoxQty: form.acBoxQty || "",
    dcBoxQty: form.dcBoxQty || "",
    standKw,
    standOther: form.standOther || "",
    standPaymentType: standKw,
    dcWireMtr: form.dcWireMtr || "",
    copperWireMtr: form.copperWireMtr || "",
    mainWireMtr: form.mainWireMtr || "",
    laQty: form.laQty || "",
    earthingRodQty: form.earthingRodQty || "",
    siteGpsDocId: gpsDoc?.id || "",
    earthingDocId: earthDoc?.id || "",
    completeDocId: completeDoc?.id || "",
    stockLines: lines,
    stockIssuedAt: new Date().toISOString(),
  };

  let issuedLines = 0;
  const stockResult = applyStockOut({
    reference: `site-${order.id}`,
    consumerNo: order.consumerNo,
    siteOrderId: order.id,
    lines,
  });

  if (stockResult.ok) {
    issuedLines = stockResult.updatedLines || 0;
    notifyStockSync();
    formPayload.stockBilledAt = new Date().toISOString();
  }
  /* Stock match fail — BOM/photos phir bhi save; Sale pe OK/Bill BOM se office retry */

  markSiteOrderSubmitted(order.id, formPayload);

  const bomResult = applySiteOrderFormToBom(order, formPayload);
  if (bomResult.ok) {
    applyBomToSaleSetupDetail(order.consumerNo);
    try {
      window.dispatchEvent(new Event(SALE_BOM_SYNC_EVENT));
      window.dispatchEvent(new Event(SALE_CASE_SYNC_EVENT));
    } catch {
      /* ignore */
    }
  }

  return {
    ok: true,
    issuedLines,
    bomUpdated: Boolean(bomResult.ok),
    stockOk: Boolean(stockResult.ok),
    stockMessage: stockResult.ok ? "" : stockResult.message || "",
  };
}
