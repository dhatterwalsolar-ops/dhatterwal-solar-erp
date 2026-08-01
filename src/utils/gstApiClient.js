import { getApiBase, getApiToken } from "./erpStorage";

async function gstFetch(path, options = {}) {
  const base = getApiBase();
  if (!base) {
    return { ok: false, error: "API URL missing (VITE_API_URL)." };
  }
  const token = getApiToken();
  if (!token) {
    return { ok: false, error: "Login token missing — dubara login karein." };
  }
  try {
    const res = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || data.message || `GST API HTTP ${res.status}`,
        ...data,
      };
    }
    return data;
  } catch (err) {
    return { ok: false, error: err?.message || "GST API network fail" };
  }
}

export async function fetchGstApiStatus() {
  return gstFetch("/api/gst/status");
}

/** Server E-Way Bill API (demo ya live GSP). */
export async function apiGenerateEwayBill(payload) {
  return gstFetch("/api/gst/eway/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Server GST E-Invoice IRN API. */
export async function apiGenerateGstEinvoice(payload) {
  return gstFetch("/api/gst/einvoice/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
