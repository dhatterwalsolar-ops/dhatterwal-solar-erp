import {
  buildWhatsAppWebSendUrl,
  getOfficeWhatsAppDisplay,
  getOfficeWhatsAppMobile,
  normalizeIndianWhatsAppMobile,
  remindWhatsAppWebSenderLogin,
} from "../constants/erpWhatsApp";
import { apiSendWhatsApp } from "./messagingApi";

/**
 * Sab ERP WhatsApp messages Office WhatsApp se.
 * 1) Live API (Meta/Twilio) — office Business number
 * 2) Fallback: WhatsApp Web — browser me Office number se login hona chahiye
 */
export async function sendOfficeWhatsApp(toMobile, text, options = {}) {
  const digits = normalizeIndianWhatsAppMobile(toMobile);
  if (!digits || digits.length !== 10) {
    window.alert("Mobile 10 digit nahi hai — WhatsApp nahi bhej sakte.");
    return false;
  }

  const officeDisplay = getOfficeWhatsAppDisplay();
  const confirmText =
    options.confirmText ||
    `Office WhatsApp (${officeDisplay}) se message bhejein?`;

  try {
    const data = await apiSendWhatsApp({ to: digits, text });
    if (data.live) {
      window.alert(`Message Office WhatsApp (${officeDisplay}) se bhej diya.`);
      return true;
    }
    if (data.useWebFallback || data.provider === "web") {
      if (!options.skipConfirm && !window.confirm(confirmText)) return false;
      remindWhatsAppWebSenderLogin();
      const url = buildWhatsAppWebSendUrl(digits, text);
      if (!url) return false;
      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    }
    window.alert(data.error || "WhatsApp API send fail.");
    return false;
  } catch (err) {
    if (options.skipWebFallbackOnError) {
      window.alert(err?.message || "WhatsApp send fail.");
      return false;
    }
    if (!options.skipConfirm && !window.confirm(confirmText)) return false;
    remindWhatsAppWebSenderLogin();
    const url = buildWhatsAppWebSendUrl(digits, text);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    }
    window.alert(err?.message || "WhatsApp send fail.");
    return false;
  }
}

export function officeWhatsAppFooterLine() {
  return `— Office WhatsApp: ${getOfficeWhatsAppDisplay()} (${getOfficeWhatsAppMobile()})`;
}
