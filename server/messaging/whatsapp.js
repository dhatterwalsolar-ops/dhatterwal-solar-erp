import { messagingConfig } from "./config.js";

function toE164India(mobile) {
  const d = String(mobile || "").replace(/\D/g, "");
  const local = d.length >= 10 ? d.slice(-10) : d;
  if (local.length !== 10) throw new Error("Invalid WhatsApp mobile");
  return local;
}

async function sendMetaWhatsApp(mobile, text) {
  const c = messagingConfig();
  if (!c.metaToken || !c.metaPhoneNumberId) {
    throw new Error("WHATSAPP_META_TOKEN / WHATSAPP_META_PHONE_NUMBER_ID missing");
  }
  const to = toE164India(mobile);
  const url = `https://graph.facebook.com/${c.metaApiVersion}/${c.metaPhoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.metaToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: `91${to}`,
      type: "text",
      text: { preview_url: false, body: String(text || "").slice(0, 4096) },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg =
      data?.error?.message || data?.error?.error_user_msg || `Meta WA HTTP ${res.status}`;
    throw new Error(errMsg);
  }
  return { provider: "meta", id: data?.messages?.[0]?.id || null, live: true };
}

async function sendTwilioWhatsApp(mobile, text) {
  const c = messagingConfig();
  if (!c.twilioAccountSid || !c.twilioAuthToken || !c.twilioWhatsAppFrom) {
    throw new Error("Twilio WhatsApp env incomplete");
  }
  const to = `whatsapp:+91${toE164India(mobile)}`;
  const auth = Buffer.from(`${c.twilioAccountSid}:${c.twilioAuthToken}`).toString("base64");
  const body = new URLSearchParams({
    To: to,
    From: c.twilioWhatsAppFrom,
    Body: String(text || "").slice(0, 1500),
  });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${c.twilioAccountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Twilio WA HTTP ${res.status}`);
  return { provider: "twilio", sid: data.sid, live: true };
}

/**
 * Live WhatsApp API send. provider=web → { live:false, useWebFallback:true }
 */
export async function sendWhatsAppMessage(mobile, text) {
  const c = messagingConfig();
  if (c.waProvider === "meta") return sendMetaWhatsApp(mobile, text);
  if (c.waProvider === "twilio") return sendTwilioWhatsApp(mobile, text);

  return {
    provider: "web",
    live: false,
    useWebFallback: true,
    message: "WHATSAPP_PROVIDER=web — browser WhatsApp Web fallback use karein.",
  };
}

export async function sendQueryAlertWhatsApp(text) {
  const c = messagingConfig();
  return sendWhatsAppMessage(c.queryAlertMobile, text);
}
