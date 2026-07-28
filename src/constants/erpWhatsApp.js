/** Office WhatsApp — WhatsApp Web par isi number se login hona chahiye. */
export const ERP_WHATSAPP_SENDER_MOBILE = "7876686572";
export const ERP_WHATSAPP_SENDER_DISPLAY = "+91 78766 86572";

export function normalizeIndianWhatsAppMobile(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits.slice(-10);
}

/** WhatsApp Web — logged-in account se message jata hai (wa.me desktop app khol sakta hai). */
export function buildWhatsAppWebSendUrl(recipientMobile, text) {
  const phone = normalizeIndianWhatsAppMobile(recipientMobile);
  if (phone.length !== 10) return null;
  const encoded = typeof text === "string" ? encodeURIComponent(text) : text;
  return `https://web.whatsapp.com/send?phone=91${phone}&text=${encoded}`;
}

export function remindWhatsAppWebSenderLogin() {
  const key = "dhatterwal-wa-sender-tip-seen";
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
  window.alert(
    `WhatsApp Web khulega.\n\nPehle confirm karein: Web par *${ERP_WHATSAPP_SENDER_DISPLAY}* se login hai.\n\nHar chat me message ready hoga — *Send* dabate hi team leader ke paas chala jayega.`,
  );
}
