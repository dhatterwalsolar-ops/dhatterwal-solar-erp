/**
 * GST E-Invoice + E-Way Bill API config (Railway / server/.env).
 *
 * GST_API_PROVIDER=
 *   demo  — local test IRN / EWB numbers (default)
 *   http  — aapka GSP / ClearTax-style HTTP API (GST_API_BASE_URL)
 */

export function gstApiConfig() {
  const provider = String(process.env.GST_API_PROVIDER || "demo")
    .trim()
    .toLowerCase();
  return {
    provider: provider === "http" ? "http" : "demo",
    baseUrl: String(process.env.GST_API_BASE_URL || "").trim().replace(/\/$/, ""),
    apiKey: String(process.env.GST_API_KEY || "").trim(),
    apiSecret: String(process.env.GST_API_SECRET || "").trim(),
    username: String(process.env.GST_API_USERNAME || "").trim(),
    password: String(process.env.GST_API_PASSWORD || "").trim(),
    gstin: String(process.env.GST_GSTIN || process.env.COMPANY_GSTIN || "").trim(),
    ewayPath: String(process.env.GST_EWAY_PATH || "/ewaybill/generate").trim(),
    einvoicePath: String(process.env.GST_EINVOICE_PATH || "/einvoice/generate").trim(),
    timeoutMs: Number(process.env.GST_API_TIMEOUT_MS || 45000) || 45000,
  };
}

export function gstApiStatus() {
  const c = gstApiConfig();
  return {
    ok: true,
    provider: c.provider,
    configured: c.provider === "demo" || Boolean(c.baseUrl && (c.apiKey || c.username)),
    gstinSet: Boolean(c.gstin),
    baseUrlSet: Boolean(c.baseUrl),
    message:
      c.provider === "demo"
        ? "Demo mode — test IRN / E-Way numbers. Live GSP ke liye GST_API_PROVIDER=http + credentials set karein."
        : c.baseUrl
          ? "HTTP GSP mode — requests GST_API_BASE_URL pe jayenge."
          : "HTTP mode me GST_API_BASE_URL missing.",
  };
}
