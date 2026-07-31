import { erpGetItem, erpSetItem } from "../utils/erpStorage";

/** Default Office WhatsApp — WhatsApp Web / Business isi number se. */
export const DEFAULT_OFFICE_WHATSAPP_MOBILE = "7876686572";

const STORAGE_KEY = "dhatterwal_office_whatsapp_mobile";

export function normalizeIndianWhatsAppMobile(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits.slice(-10);
}

export function formatWhatsAppDisplay(mobile10) {
  const local = normalizeIndianWhatsAppMobile(mobile10);
  if (local.length !== 10) return String(mobile10 || "");
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}

export function getOfficeWhatsAppMobile() {
  try {
    const saved = normalizeIndianWhatsAppMobile(erpGetItem(STORAGE_KEY) || "");
    if (saved.length === 10) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_OFFICE_WHATSAPP_MOBILE;
}

export function getOfficeWhatsAppDisplay() {
  return formatWhatsAppDisplay(getOfficeWhatsAppMobile());
}

export function setOfficeWhatsAppMobile(mobile) {
  const digits = normalizeIndianWhatsAppMobile(mobile);
  if (digits.length !== 10) {
    throw new Error("Office WhatsApp 10 digit mobile chahiye.");
  }
  erpSetItem(STORAGE_KEY, digits);
  return digits;
}

/** @deprecated use getOfficeWhatsAppMobile() */
export const ERP_WHATSAPP_SENDER_MOBILE = DEFAULT_OFFICE_WHATSAPP_MOBILE;
/** @deprecated use getOfficeWhatsAppDisplay() — value may be stale if Settings change */
export const ERP_WHATSAPP_SENDER_DISPLAY = formatWhatsAppDisplay(
  DEFAULT_OFFICE_WHATSAPP_MOBILE,
);

/** WhatsApp Web — logged-in Office account se message jata hai. */
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
  const office = getOfficeWhatsAppDisplay();
  window.alert(
    `Office WhatsApp Web khulega.\n\n` +
      `1) Browser me https://web.whatsapp.com kholo\n` +
      `2) *${office}* se QR login karo (Office phone)\n` +
      `3) Chat me message ready hoga — *Send* dabao\n\n` +
      `Personal number se login mat karo — warna message office se nahi jayega.`,
  );
}
