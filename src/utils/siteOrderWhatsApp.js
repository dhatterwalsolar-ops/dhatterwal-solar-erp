import {
  ERP_WHATSAPP_SENDER_DISPLAY,
  buildWhatsAppWebSendUrl,
  remindWhatsAppWebSenderLogin,
  normalizeIndianWhatsAppMobile,
} from "../constants/erpWhatsApp";
import {
  buildSiteOrderFormAbsoluteUrl,
  getPublicAppBaseUrl,
  isLocalhostBaseUrl,
} from "./siteOrderUrl";

const GOOGLE_FORM_KEY = "dhatterwal_site_order_google_form_url";
/** Map field → Google Form query key, e.g. { "customerName": "entry.123456789" } */
const GOOGLE_FORM_PREFILL_KEY = "dhatterwal_google_form_entry_ids";

export function buildSiteOrderFormUrl(orderOrId) {
  if (orderOrId && typeof orderOrId === "object" && orderOrId.id) {
    return buildSiteOrderFormAbsoluteUrl(orderOrId);
  }
  const id = String(orderOrId || "");
  const base = getPublicAppBaseUrl();
  return `${base}/site-order/${encodeURIComponent(id)}`;
}

function safeParseJson(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function getSiteOrderGoogleFormUrl() {
  try {
    return localStorage.getItem(GOOGLE_FORM_KEY) || "";
  } catch {
    return "";
  }
}

export function setSiteOrderGoogleFormUrl(url) {
  try {
    localStorage.setItem(GOOGLE_FORM_KEY, String(url || "").trim());
  } catch {
    /* ignore */
  }
}

export function getGoogleFormEntryIdMap() {
  return safeParseJson(localStorage.getItem(GOOGLE_FORM_PREFILL_KEY), {});
}

export function buildGoogleFormUrlForOrder(order) {
  const base = getSiteOrderGoogleFormUrl();
  if (!base) return "";

  const ids = getGoogleFormEntryIdMap();
  const pairs = [];

  const add = (mapKey, value) => {
    const entryKey = ids[mapKey];
    const text = String(value ?? "").trim();
    if (!entryKey || !text) return;
    pairs.push(`${encodeURIComponent(entryKey)}=${encodeURIComponent(text)}`);
  };

  add("consumerNo", order.consumerNo);
  add("customerName", order.customerName);
  add("fatherName", order.fatherName);
  add("mobile", order.customerMobile || order.mobile);
  add("address", order.address);
  add("setupKw", order.setupKw);
  add("teamWork", order.teamWork);
  add("teamLeaderName", order.teamLeaderName);
  add("siteDate", order.siteDate);

  if (!pairs.length) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${pairs.join("&")}`;
}

export function buildSiteOrderWhatsAppMessage(order) {
  const erpFormUrl = buildSiteOrderFormUrl(order);
  const googleUrl = buildGoogleFormUrlForOrder(order);

  const lines = [
    `*Dhatterwal Solar — Site Order*`,
    `Site date: ${order.siteDate || "Aaj"}`,
    `Team: ${order.teamWork || "—"}`,
    `Team leader: ${order.teamLeaderName || "—"}`,
    ``,
    `*Consumer / customer detail*`,
    `Consumer No.: ${order.consumerNo || "—"}`,
    `Name: ${order.customerName || "—"}`,
    `Father/Husband: ${order.fatherName || "—"}`,
    `Mobile: ${order.customerMobile || order.mobile || "—"}`,
    `Address: ${order.address || "—"}`,
    `Setup: ${order.setupKw || "—"}`,
    ``,
  ];

  if (googleUrl) {
    lines.push(`*Google Form (consumer detail ke sath link):*`, googleUrl, "");
  }

  lines.push(`*ERP site form (detail fill karein):*`, erpFormUrl, "");

  if (isLocalhostBaseUrl(getPublicAppBaseUrl())) {
    lines.push(
      "⚠️ Link abhi localhost hai — team leader ke phone par khulne ke liye Settings me live website URL set karein (ya office WiFi par same PC ka IP use karein).",
      "",
    );
  }

  lines.push(
    "Google Form + ERP form dono me upar wali consumer detail use karein.",
    "ERP form office ERP wale browser par submit karein to stock automatic less hoga.",
    "",
    `— Office WhatsApp: ${ERP_WHATSAPP_SENDER_DISPLAY}`,
  );

  return lines.join("\n");
}

/**
 * Sirf is setup ke liye select kiye gaye team leader ko WhatsApp Web par message.
 */
export function openWhatsAppSiteOrder(order, options = {}) {
  const skipConfirm = Boolean(options.skipConfirm);
  const messageText = buildSiteOrderWhatsAppMessage(order);
  const mobile = normalizeIndianWhatsAppMobile(order.teamLeaderMobile);

  if (!mobile || mobile.length !== 10) {
    window.alert(
      `"${order.teamWork || "Team"}" ke leader ka mobile nahi mila — Labour Details me Team Leader mobile set karein.`,
    );
    return false;
  }

  if (
    !skipConfirm &&
    !window.confirm(
      `WhatsApp Web (${ERP_WHATSAPP_SENDER_DISPLAY} login) se *${order.teamLeaderName || "Team leader"}* (${order.teamWork}) ko site form bhejein?\n\nConsumer: ${order.customerName} (${order.consumerNo})`,
    )
  ) {
    return false;
  }

  remindWhatsAppWebSenderLogin();
  const url = buildWhatsAppWebSendUrl(mobile, messageText);
  if (!url) {
    window.alert("WhatsApp link nahi bana — mobile number check karein.");
    return false;
  }
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

export function buildWhatsAppSiteOrderLink(order) {
  const mobile = normalizeIndianWhatsAppMobile(order.teamLeaderMobile);
  if (!mobile) return null;
  return buildWhatsAppWebSendUrl(mobile, buildSiteOrderWhatsAppMessage(order));
}
