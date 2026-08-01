import { getSiteOrderById } from "./siteOrderStorage";
import { erpGetItem, erpRemoveItem, erpSetItem } from "./erpStorage";

const PUBLIC_URL_KEY = "dhatterwal_public_app_url";

/** WhatsApp link ke liye — localhost team leader ke phone par kaam nahi karta. */
export function getPublicAppBaseUrl() {
  try {
    const stored = erpGetItem(PUBLIC_URL_KEY);
    if (stored?.trim()) return stored.trim().replace(/\/$/, "");
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/$/, "");
  }
  return "";
}

export function setPublicAppBaseUrl(url) {
  try {
    erpSetItem(PUBLIC_URL_KEY, String(url || "").trim());
  } catch {
    /* ignore */
  }
}

export function isLocalhostBaseUrl(url) {
  return /localhost|127\.0\.0\.1/i.test(String(url || ""));
}

export function isBrowserLocalhostHost() {
  if (typeof window === "undefined") return false;
  return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}

/** WhatsApp / team leader ke liye link localhost par valid nahi — LAN IP ya saved URL chahiye. */
export function needsLanUrlForTeamLinks() {
  return isLocalhostBaseUrl(getPublicAppBaseUrl());
}

export function getSavedPublicAppBaseUrl() {
  try {
    const stored = erpGetItem(PUBLIC_URL_KEY);
    if (stored?.trim()) return stored.trim().replace(/\/$/, "");
  } catch {
    /* ignore */
  }
  return "";
}

export function packSiteOrderForUrl(order) {
  if (!order?.id) return "";
  const payload = {
    id: order.id,
    consumerNo: order.consumerNo,
    customerName: order.customerName,
    fatherName: order.fatherName || "",
    customerMobile: order.customerMobile || order.mobile || "",
    address: order.address || "",
    setupKw: order.setupKw || "",
    teamWork: order.teamWork || "",
    teamLeaderName: order.teamLeaderName || "",
    teamLeaderMobile: order.teamLeaderMobile || "",
    siteDate: order.siteDate || "",
    panelCount: order.panelCount || 4,
    defaultMembers: order.defaultMembers || [],
    status: order.status || "pending",
    /* Stock names for TL phone form selects */
    stockCatalog: order.stockCatalog || {
      panels: [],
      inverters: [],
      acBoxes: [],
      dcBoxes: [],
      wires: [],
      laItems: [],
      earthingItems: [],
    },
  };
  try {
    return encodeURIComponent(JSON.stringify(payload));
  } catch {
    return "";
  }
}

export function unpackSiteOrderFromSearch(search) {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const packed = params.get("d");
  if (!packed) return null;
  try {
    const order = JSON.parse(decodeURIComponent(packed));
    if (!order?.id) return null;
    return order;
  } catch {
    return null;
  }
}

export function buildSiteOrderFormPath(order) {
  const packed = packSiteOrderForUrl(order);
  const id = encodeURIComponent(order.id);
  return packed ? `/site-order/${id}?d=${packed}` : `/site-order/${id}`;
}

export function buildSiteOrderFormAbsoluteUrl(order) {
  const base = getPublicAppBaseUrl();
  if (!base) return buildSiteOrderFormPath(order);
  return `${base}${buildSiteOrderFormPath(order)}`;
}

export function resolveSiteOrder(orderId, search) {
  if (orderId) {
    const fromStore = getSiteOrderById(orderId);
    if (fromStore) return fromStore;
  }

  const fromUrl = unpackSiteOrderFromSearch(search);
  if (!fromUrl) return null;
  if (!orderId || fromUrl.id === orderId || decodeURIComponent(orderId) === fromUrl.id) {
    return fromUrl;
  }
  return fromUrl;
}
