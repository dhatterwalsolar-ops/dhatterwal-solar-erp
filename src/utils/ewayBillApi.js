/**
 * E-Way Bill generate (local ERP adapter).
 * Validates invoice + transport fields, then issues an e-way bill number.
 * Replace `callEwayGenerateApi` body with real GST portal / GSP API when credentials are ready.
 */

function pad(n, w = 2) {
  return String(n).padStart(w, "0");
}

function buildEwayBillNo() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rnd = String(Math.floor(100 + Math.random() * 900));
  return `EWB${stamp}${rnd}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callEwayGenerateApi(payload) {
  await delay(700);

  const required = [
    ["invoiceNo", payload.invoiceNo],
    ["consumerNo", payload.consumerNo],
    ["vehicleNo", payload.vehicleNo],
    ["pinCode", payload.pinCode],
    ["station", payload.station],
    ["distanceKm", payload.distanceKm],
  ];

  for (const [label, value] of required) {
    if (!String(value || "").trim()) {
      return {
        ok: false,
        error: `${label} missing — API data match failed.`,
      };
    }
  }

  const distance = Number(payload.distanceKm);
  if (!Number.isFinite(distance) || distance <= 0) {
    return {
      ok: false,
      error: "Distance (km) invalid — API rejected request.",
    };
  }

  if (String(payload.pinCode).trim().length < 6) {
    return {
      ok: false,
      error: "Pin code invalid — API data match failed.",
    };
  }

  const ewayBillNo = buildEwayBillNo();
  return {
    ok: true,
    ewayBillNo,
    validUpto: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString("en-IN"),
    message: "E-Way Bill generated successfully",
    matched: {
      invoiceNo: payload.invoiceNo,
      vehicleNo: String(payload.vehicleNo).trim().toUpperCase(),
      pinCode: String(payload.pinCode).trim(),
      station: String(payload.station).trim(),
      distanceKm: distance,
    },
  };
}
