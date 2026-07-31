import {
  getOfficeWhatsAppDisplay,
  normalizeIndianWhatsAppMobile,
} from "../constants/erpWhatsApp";
import { officeWhatsAppFooterLine, sendOfficeWhatsApp } from "./officeWhatsAppSend";
import {
  buildSiteOrderFormAbsoluteUrl,
  getPublicAppBaseUrl,
  isLocalhostBaseUrl,
} from "./siteOrderUrl";
import { erpGetItem, erpSetItem } from "./erpStorage";

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
    return erpGetItem(GOOGLE_FORM_KEY) || "";
  } catch {
    return "";
  }
}

export function setSiteOrderGoogleFormUrl(url) {
  try {
    erpSetItem(GOOGLE_FORM_KEY, String(url || "").trim());
  } catch {
    /* ignore */
  }
}

export function getGoogleFormEntryIdMap() {
  return safeParseJson(erpGetItem(GOOGLE_FORM_PREFILL_KEY), {});
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
    `*ERP site form — yahi open karke fill/submit karein:*`,
    erpFormUrl,
    "",
    "Submit ke baad BOM Sheet + Sale Setup Detail automatic update + stock less.",
    "",
  ];

  if (isLocalhostBaseUrl(getPublicAppBaseUrl())) {
    lines.push(
      "⚠️ Link abhi localhost hai — team leader ke phone par khulne ke liye live website URL / WiFi IP set karein.",
      "",
    );
  }

  lines.push(officeWhatsAppFooterLine());

  return lines.join("\n");
}

/**
 * Office WhatsApp se team leader ko site form message.
 */
export async function openWhatsAppSiteOrder(order, options = {}) {
  const messageText = buildSiteOrderWhatsAppMessage(order);
  const mobile = normalizeIndianWhatsAppMobile(order.teamLeaderMobile);

  if (!mobile || mobile.length !== 10) {
    window.alert(
      `"${order.teamWork || "Team"}" ke leader ka mobile nahi mila — Labour Details me Team Leader mobile set karein.`,
    );
    return false;
  }

  return sendOfficeWhatsApp(mobile, messageText, {
    skipConfirm: Boolean(options.skipConfirm),
    confirmText:
      `Office WhatsApp (${getOfficeWhatsAppDisplay()}) se *${order.teamLeaderName || "Team leader"}* (${order.teamWork}) ko site form bhejein?\n\n` +
      `Consumer: ${order.customerName} (${order.consumerNo})`,
  });
}
