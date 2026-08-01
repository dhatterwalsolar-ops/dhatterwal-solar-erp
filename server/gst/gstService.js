import { gstApiConfig, gstApiStatus } from "./config.js";
import { demoGenerateEinvoice, demoGenerateEway } from "./demoProvider.js";
import { httpGenerateEinvoice, httpGenerateEway } from "./httpProvider.js";

function requireFields(payload, fields) {
  for (const [label, value] of fields) {
    if (!String(value ?? "").trim()) {
      return { ok: false, error: `${label} missing — API data match failed.` };
    }
  }
  return null;
}

export function getGstStatus() {
  return gstApiStatus();
}

export async function generateEwayBill(payload = {}) {
  const miss = requireFields(payload, [
    ["invoiceNo", payload.invoiceNo],
    ["consumerNo", payload.consumerNo],
    ["vehicleNo", payload.vehicleNo],
    ["pinCode", payload.pinCode],
    ["station", payload.station],
    ["distanceKm", payload.distanceKm],
  ]);
  if (miss) return miss;

  const distance = Number(payload.distanceKm);
  if (!Number.isFinite(distance) || distance <= 0) {
    return { ok: false, error: "Distance (km) invalid — API rejected request." };
  }
  if (String(payload.pinCode).trim().length < 6) {
    return { ok: false, error: "Pin code invalid — API data match failed." };
  }

  const c = gstApiConfig();
  if (c.provider === "http") {
    return httpGenerateEway({
      ...payload,
      vehicleNo: String(payload.vehicleNo).trim().toUpperCase(),
      pinCode: String(payload.pinCode).trim(),
      station: String(payload.station).trim(),
      distanceKm: distance,
    });
  }
  return demoGenerateEway({
    ...payload,
    vehicleNo: String(payload.vehicleNo).trim().toUpperCase(),
    pinCode: String(payload.pinCode).trim(),
    station: String(payload.station).trim(),
    distanceKm: distance,
  });
}

export async function generateGstEinvoice(payload = {}) {
  const miss = requireFields(payload, [
    ["invoiceNo", payload.invoiceNo],
    ["consumerNo", payload.consumerNo],
    ["customerName", payload.customerName],
  ]);
  if (miss) return miss;

  const amount = Number(payload.totalAmount ?? payload.taxableAmount ?? 0);
  if (!(amount > 0)) {
    return { ok: false, error: "Invoice amount missing / invalid." };
  }

  const c = gstApiConfig();
  const body = {
    ...payload,
    totalAmount: amount,
    taxableAmount: Number(payload.taxableAmount) || amount,
    gstAmount: Number(payload.gstAmount) || 0,
    sellerGstin: c.gstin || payload.sellerGstin || "",
  };

  if (c.provider === "http") {
    return httpGenerateEinvoice(body);
  }
  return demoGenerateEinvoice(body);
}
