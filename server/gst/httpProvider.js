import { gstApiConfig } from "./config.js";

async function postJson(path, body) {
  const c = gstApiConfig();
  if (!c.baseUrl) {
    return { ok: false, error: "GST_API_BASE_URL set nahi hai." };
  }
  const url = path.startsWith("http") ? path : `${c.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (c.apiKey) headers.Authorization = `Bearer ${c.apiKey}`;
  if (c.apiKey) headers["X-API-KEY"] = c.apiKey;
  if (c.apiSecret) headers["X-API-SECRET"] = c.apiSecret;
  if (c.gstin) headers["gstin"] = c.gstin;
  if (c.username) headers["username"] = c.username;
  if (c.password) headers["password"] = c.password;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), c.timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { rawText: text };
    }
    if (!res.ok) {
      return {
        ok: false,
        error:
          data.error ||
          data.message ||
          data.ErrorDetails?.[0]?.ErrorMessage ||
          `GSP HTTP ${res.status}`,
        raw: data,
        status: res.status,
      };
    }
    return { ok: true, data, status: res.status };
  } catch (err) {
    return {
      ok: false,
      error: err?.name === "AbortError" ? "GSP API timeout" : err?.message || "GSP fetch fail",
    };
  } finally {
    clearTimeout(timer);
  }
}

function pick(obj, keys) {
  for (const k of keys) {
    const parts = k.split(".");
    let cur = obj;
    for (const p of parts) {
      if (cur == null) break;
      cur = cur[p];
    }
    if (cur != null && String(cur).trim() !== "") return String(cur).trim();
  }
  return "";
}

export async function httpGenerateEway(payload) {
  const c = gstApiConfig();
  const body = {
    ...payload,
    gstin: c.gstin || payload.sellerGstin,
    action: "GENEWAYBILL",
  };
  const res = await postJson(c.ewayPath, body);
  if (!res.ok) return { ok: false, provider: "http", error: res.error, raw: res.raw };

  const data = res.data || {};
  const ewayBillNo = pick(data, [
    "ewayBillNo",
    "EwbNo",
    "ewbNo",
    "data.ewayBillNo",
    "result.ewayBillNo",
  ]);
  if (!ewayBillNo) {
    return {
      ok: false,
      provider: "http",
      error: "GSP response me ewayBillNo nahi mila — path/mapping check karein.",
      raw: data,
    };
  }
  return {
    ok: true,
    provider: "http",
    ewayBillNo,
    validUpto: pick(data, ["validUpto", "EwbValidTill", "data.validUpto"]) || "",
    message: pick(data, ["message", "Message"]) || "E-Way Bill generated via GSP",
    matched: {
      invoiceNo: payload.invoiceNo,
      vehicleNo: String(payload.vehicleNo || "").trim().toUpperCase(),
      pinCode: String(payload.pinCode || "").trim(),
      station: String(payload.station || "").trim(),
      distanceKm: Number(payload.distanceKm) || 0,
    },
    raw: data,
  };
}

export async function httpGenerateEinvoice(payload) {
  const c = gstApiConfig();
  const body = {
    ...payload,
    gstin: c.gstin || payload.sellerGstin,
    action: "GENIRN",
  };
  const res = await postJson(c.einvoicePath, body);
  if (!res.ok) return { ok: false, provider: "http", error: res.error, raw: res.raw };

  const data = res.data || {};
  const irn = pick(data, ["Irn", "irn", "data.Irn", "result.Irn", "IRN"]);
  if (!irn) {
    return {
      ok: false,
      provider: "http",
      error: "GSP response me IRN nahi mila — path/mapping check karein.",
      raw: data,
    };
  }
  return {
    ok: true,
    provider: "http",
    irn,
    ackNo: pick(data, ["AckNo", "ackNo", "data.AckNo"]) || "",
    ackDate: pick(data, ["AckDt", "ackDate", "data.AckDt"]) || new Date().toLocaleString("en-IN"),
    invoiceNo: payload.invoiceNo,
    message: pick(data, ["message", "Message"]) || "E-Invoice IRN generated via GSP",
    raw: data,
  };
}
