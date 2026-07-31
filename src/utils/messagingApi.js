import { getApiBase, getApiToken } from "./erpStorage";

async function messagingFetch(path, options = {}) {
  const base = getApiBase();
  if (!base) throw new Error("API URL missing (VITE_API_URL).");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getApiToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

export async function getMessagingStatus() {
  const base = getApiBase();
  if (!base) return { ok: false, smsLive: false, whatsappLive: false };
  const res = await fetch(`${base}/api/messaging/status`);
  return res.json().catch(() => ({ ok: false }));
}

export async function apiSendOtp({ purpose = "settings", mobile } = {}) {
  return messagingFetch("/api/otp/send", {
    method: "POST",
    body: JSON.stringify({ purpose, mobile }),
  });
}

export async function apiVerifyOtp({ purpose = "settings", code } = {}) {
  return messagingFetch("/api/otp/verify", {
    method: "POST",
    body: JSON.stringify({ purpose, code }),
  });
}

/** Live WhatsApp API; if useWebFallback, caller should open WhatsApp Web. */
export async function apiSendWhatsApp({ to, text } = {}) {
  return messagingFetch("/api/messaging/whatsapp", {
    method: "POST",
    body: JSON.stringify({ to, text }),
  });
}
