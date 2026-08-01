import { applySiteOrderFormToBom } from "./bomSheetStorage";
import { saveBomSheetDocumentToFolder } from "./bomSheetDocuments";
import {
  addCustomerDocument,
  readFileAsDataUrl,
} from "./customerDocuments";
import { findProductByName } from "./productStorage";
import { applyBomToSaleSetupDetail, SALE_BOM_SYNC_EVENT } from "./saleCaseStorage";
import { SALE_CASE_SYNC_EVENT } from "./saleCaseSync";
import { applyStockOut, notifyStockSync } from "./stockStorage";
import { syncSiteFormToCloud } from "./siteFormCloudSync";
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

  const inverterName = String(form.inverterName || "").trim();
  const inverterSerial = String(form.inverterSerial || "").trim();
  if (!inverterName) errors.push("Inverter name (stock) zaroori hai.");

  if (inverterName) {
    lines.push(
      lineWithProductId({
        itemName: inverterName,
        category: "INVERTER",
        qty: 1,
        unit: "NOS",
        ...(inverterSerial ? { serialNumbers: inverterSerial } : {}),
      }),
    );
  }

  const namedWires = [
    { nameKey: "dcWireName", mtrKey: "dcWireMtr", fallback: "DC Wire" },
    { nameKey: "copperWireName", mtrKey: "copperWireMtr", fallback: "Copper Wire" },
    { nameKey: "mainWireName", mtrKey: "mainWireMtr", fallback: "Main Wire" },
  ];
  for (const def of namedWires) {
    const qty = parseQty(form[def.mtrKey]);
    const itemName = String(form[def.nameKey] || "").trim();
    if (qty <= 0 || !itemName) continue;
    lines.push(
      lineWithProductId({
        itemName,
        category: "WIRE",
        qty,
        unit: "MTR",
      }),
    );
  }

  /* wireLines from form (stock-selected names) */
  for (const wire of form.wireLines || []) {
    const qty = parseQty(wire.qtyMtr);
    const itemName = String(wire.itemName || "").trim();
    if (qty <= 0 || !itemName) continue;
    lines.push(
      lineWithProductId({
        productId: wire.productId || "",
        itemName,
        category: wire.category || "WIRE",
        qty,
        unit: "MTR",
      }),
    );
  }

  const acName = String(form.acBoxName || "").trim();
  const acQty = parseQty(form.acBoxQty);
  if (acName && acQty > 0) {
    lines.push(
      lineWithProductId({
        itemName: acName,
        category: "AC BOX",
        qty: acQty,
        unit: "NOS",
      }),
    );
  }

  const dcName = String(form.dcBoxName || "").trim();
  const dcQty = parseQty(form.dcBoxQty);
  if (dcName && dcQty > 0) {
    lines.push(
      lineWithProductId({
        itemName: dcName,
        category: "DC BOX",
        qty: dcQty,
        unit: "NOS",
      }),
    );
  }

  const laName = String(form.laName || "").trim();
  const laQty = parseQty(form.laQty);
  if (laName && laQty > 0) {
    lines.push(
      lineWithProductId({
        itemName: laName,
        category: "GENERAL",
        qty: laQty,
        unit: "NOS",
      }),
    );
  }

  const earthingName = String(form.earthingName || "").trim();
  const earthingQty = parseQty(form.earthingRodQty);
  if (earthingName && earthingQty > 0) {
    lines.push(
      lineWithProductId({
        itemName: earthingName,
        category: "GENERAL",
        qty: earthingQty,
        unit: "NOS",
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
    acBoxName: form.acBoxName || "",
    acBoxQty: form.acBoxQty || "",
    dcBoxName: form.dcBoxName || "",
    dcBoxQty: form.dcBoxQty || "",
    standKw,
    standOther: form.standOther || "",
    standPaymentType: standKw,
    dcWireName: form.dcWireName || "",
    dcWireMtr: form.dcWireMtr || "",
    copperWireName: form.copperWireName || "",
    copperWireMtr: form.copperWireMtr || "",
    mainWireName: form.mainWireName || "",
    mainWireMtr: form.mainWireMtr || "",
    wireLines: form.wireLines || [],
    laName: form.laName || "",
    laQty: form.laQty || "",
    earthingName: form.earthingName || "",
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
  let bomFolderSaved = false;
  if (bomResult.ok) {
    applyBomToSaleSetupDetail(order.consumerNo);
    try {
      window.dispatchEvent(new Event(SALE_BOM_SYNC_EVENT));
      window.dispatchEvent(new Event(SALE_CASE_SYNC_EVENT));
    } catch {
      /* ignore */
    }
    try {
      const folder = await saveBomSheetDocumentToFolder(order.consumerNo);
      bomFolderSaved = Boolean(folder?.ok);
    } catch (err) {
      console.warn("[site BOM folder]", err?.message || err);
    }
  }

  /* TL phone pe local BOM office ko nahi dikhta — server sync zaroori */
  const cloud = await syncSiteFormToCloud(order, formPayload);
  if (cloud.ok) {
    markSiteOrderSubmitted(order.id, {
      ...formPayload,
      cloudSyncedAt: new Date().toISOString(),
    });
  }

  return {
    ok: true,
    issuedLines,
    bomUpdated: Boolean(bomResult.ok),
    bomFolderSaved,
    cloudSynced: Boolean(cloud.ok),
    cloudMessage: cloud.ok ? "" : cloud.message || "",
    stockOk: Boolean(stockResult.ok),
    stockMessage: stockResult.ok ? "" : stockResult.message || "",
  };
}

/** Already-submitted form dubara office BOM pe bhejein (Aman Dware jaise stuck cases). */
export async function resyncSubmittedSiteFormToCloud(order) {
  if (!order?.id) return { ok: false, message: "Order missing." };
  const formPayload = order.formPayload;
  if (!formPayload || !formPayload.panelName) {
    return {
      ok: false,
      message:
        "Is phone pe form payload nahi mila. Form dubara fill karke Submit karein (naya WhatsApp link).",
    };
  }
  const cloud = await syncSiteFormToCloud(order, formPayload);
  if (cloud.ok) {
    markSiteOrderSubmitted(order.id, {
      ...formPayload,
      cloudSyncedAt: new Date().toISOString(),
    });
    /* Local BOM bhi refresh */
    applySiteOrderFormToBom(order, formPayload);
    applyBomToSaleSetupDetail(order.consumerNo);
    try {
      window.dispatchEvent(new Event(SALE_BOM_SYNC_EVENT));
      window.dispatchEvent(new Event(SALE_CASE_SYNC_EVENT));
    } catch {
      /* ignore */
    }
  }
  return cloud.ok
    ? { ok: true, message: "Office BOM Sheet me sync ho gaya." }
    : { ok: false, message: cloud.message || "Cloud sync fail." };
}
