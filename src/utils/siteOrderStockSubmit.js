import { findProductByName } from "./productStorage";
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

export function submitSiteInstallationForm(order, form) {
  if (!order?.id) return { ok: false, message: "Order missing." };
  if (order.status === "submitted") {
    return { ok: false, message: "Yeh site form pehle hi submit ho chuka hai." };
  }

  const lines = [];
  const errors = [];

  for (let i = 0; i < (form.panelSerials || []).length; i += 1) {
    const serial = String(form.panelSerials[i] || "").trim();
    if (!serial) {
      errors.push(`Panel ${i + 1} serial khali hai.`);
      continue;
    }
  if (!serialExistsInStock(serial, { category: "PANEL" })) {
      if (!form.allowManualSerials) {
        errors.push(`Panel serial "${serial}" stock me nahi mila.`);
        continue;
      }
    }
    lines.push(
      lineWithProductId({
        itemName: form.panelProductName || "Solar Panel",
        category: "PANEL",
        qty: 1,
        unit: "NOS",
        serialNumbers: serial,
      }),
    );
  }

  if (form.inverterSerial?.trim()) {
    const serial = form.inverterSerial.trim();
    if (!serialExistsInStock(serial, { category: "INVERTER" })) {
      if (!form.allowManualSerials) {
        errors.push(`Inverter serial "${serial}" stock me match nahi hua.`);
      } else {
        lines.push(
          lineWithProductId({
            itemName: form.inverterName || "Inverter",
            category: "INVERTER",
            qty: 1,
            unit: "NOS",
            serialNumbers: serial,
          }),
        );
      }
    } else {
      lines.push(
        lineWithProductId({
          itemName: form.inverterName || "Inverter",
          category: "INVERTER",
          qty: 1,
          unit: "NOS",
          serialNumbers: serial,
        }),
      );
    }
  } else {
    errors.push("Inverter serial zaroori hai.");
  }

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

  if (errors.length) {
    return { ok: false, message: errors.join("\n") };
  }
  if (!lines.length) {
    return { ok: false, message: "Koi stock line select nahi hui." };
  }

  const stockResult = applyStockOut({
    reference: `site-${order.id}`,
    consumerNo: order.consumerNo,
    siteOrderId: order.id,
    lines,
  });

  if (!stockResult.ok) {
    return {
      ok: false,
      message: stockResult.message || "Stock se material issue nahi ho paya.",
    };
  }

  markSiteOrderSubmitted(order.id, {
    ...form,
    teamMembers: form.teamMembers || [],
    stockLines: lines,
    stockIssuedAt: new Date().toISOString(),
  });
  notifyStockSync();

  return { ok: true, issuedLines: stockResult.updatedLines };
}
