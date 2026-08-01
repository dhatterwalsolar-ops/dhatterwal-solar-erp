import {
  ensureBomChargesOnFile,
  getBomFile,
  syncBomFilesFromSaleRows,
} from "./bomSheetStorage";
import { getConsumerReference } from "./consumerReference";
import {
  applyBomToSaleSetupDetail,
  loadSaleCaseRows,
  SALE_BOM_SYNC_EVENT,
  saveSaleCaseRows,
} from "./saleCaseStorage";
import { SALE_CASE_SYNC_EVENT } from "./saleCaseSync";
import { getSiteOrderById, markSiteOrderSubmitted } from "./siteOrderStorage";
import { applyStockOut, hasSiteStockOut, notifyStockSync } from "./stockStorage";

/**
 * Sale Sheet → OK / Bill BOM:
 * Team Leader site form items → stock out (agar pehle nahi hua)
 * + BOM charges / site kharch sync.
 */
export function billBomFromSaleRow(saleRow) {
  if (!saleRow?.consumerNo?.trim()) {
    return { ok: false, message: "Consumer No. missing." };
  }

  const order =
    (saleRow.siteOrderId && getSiteOrderById(saleRow.siteOrderId)) || null;
  if (!order || order.status !== "submitted") {
    return {
      ok: false,
      message:
        "Pehle Team Leader site form submit karein (WhatsApp form). Uske baad OK / Bill BOM.",
    };
  }

  const lines = order.formPayload?.stockLines || [];
  const stockRef = `site-${order.id}`;
  let issuedLines = 0;
  let stockMessage = "";

  const already =
    Boolean(order.formPayload?.stockBilledAt) || hasSiteStockOut(stockRef);

  if (lines.length && !already) {
    const stockResult = applyStockOut({
      reference: stockRef,
      consumerNo: order.consumerNo,
      siteOrderId: order.id,
      lines,
    });
    if (stockResult.ok) {
      issuedLines = stockResult.updatedLines || 0;
      notifyStockSync();
      markSiteOrderSubmitted(order.id, {
        ...order.formPayload,
        stockLines: lines,
        stockBilledAt: new Date().toISOString(),
      });
    } else {
      return {
        ok: false,
        message: stockResult.message || "Stock deduct fail — stock balance check karein.",
        issuedLines: 0,
      };
    }
  } else if (already) {
    stockMessage = "Stock pehle hi deduct ho chuka hai.";
  } else if (!lines.length) {
    stockMessage = "Site form me stock lines nahi mili — BOM charges phir bhi set.";
  }

  const saleRows = loadSaleCaseRows();
  syncBomFilesFromSaleRows(saleRows);

  const reference =
    getConsumerReference(saleRow.consumerNo) ||
    String(saleRow.reference || "").trim();
  ensureBomChargesOnFile(saleRow.consumerNo, {
    reference,
    setupKw: saleRow.setupKw || order.setupKw || "",
    saleDate: saleRow.date || order.siteDate || "",
  });

  applyBomToSaleSetupDetail(saleRow.consumerNo);

  const nextSale = saleRows.map((r) => {
    if (
      String(r.consumerNo || "")
        .trim()
        .toUpperCase() !==
      String(saleRow.consumerNo || "")
        .trim()
        .toUpperCase()
    ) {
      return r;
    }
    return {
      ...r,
      bomBilled: true,
      bomBilledAt: new Date().toISOString(),
      siteOrderStatus: "submitted",
    };
  });
  saveSaleCaseRows(nextSale);

  try {
    window.dispatchEvent(new Event(SALE_BOM_SYNC_EVENT));
    window.dispatchEvent(new Event(SALE_CASE_SYNC_EVENT));
  } catch {
    /* ignore */
  }

  const file = getBomFile(saleRow.consumerNo);
  return {
    ok: true,
    issuedLines,
    stockMessage,
    totalKharch: file?.totalKharch ?? 0,
    message: stockMessage,
  };
}
