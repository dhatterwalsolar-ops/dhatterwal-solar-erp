import { panelCountFromSetupKw } from "./panelCountFromKw";
import { getSaleTeamLeaderConfig } from "../constants/saleTeamMapping";
import { erpGetItem, erpRemoveItem, erpSetItem } from "./erpStorage";
import { buildSiteStockCatalog, stockCatalogNames } from "./siteStockCatalog";

function attachStockCatalog(order) {
  try {
    const cat = buildSiteStockCatalog();
    return {
      ...order,
      stockCatalog: {
        panels: stockCatalogNames(cat.panels),
        inverters: stockCatalogNames(cat.inverters),
        acBoxes: stockCatalogNames(cat.acBoxes),
        dcBoxes: stockCatalogNames(cat.dcBoxes),
        wires: stockCatalogNames(cat.wires),
        laItems: stockCatalogNames(cat.laItems),
        earthingItems: stockCatalogNames(cat.earthingItems),
      },
    };
  } catch {
    return {
      ...order,
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
  }
}

const ORDERS_KEY = "dhatterwal_site_orders";
export const SITE_ORDER_SYNC_EVENT = "dhatterwal-site-order-sync";

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readOrders() {
  return safeParse(erpGetItem(ORDERS_KEY), []);
}

function writeOrders(list) {
  try {
    erpSetItem(ORDERS_KEY, JSON.stringify(list.slice(0, 500)));
    window.dispatchEvent(new Event(SITE_ORDER_SYNC_EVENT));
  } catch {
    /* ignore */
  }
}

export function listSiteOrders() {
  return readOrders();
}

export function getSiteOrderById(id) {
  return readOrders().find((o) => o.id === id) ?? null;
}

export function getSiteOrderForConsumer(consumerNo) {
  const key = String(consumerNo || "").trim().toUpperCase();
  if (!key) return null;
  return (
    readOrders().find(
      (o) =>
        String(o.consumerNo || "")
          .trim()
          .toUpperCase() === key && o.status !== "submitted",
    ) ?? null
  );
}

export function buildSiteOrderFromSaleRow(row) {
  const team = getSaleTeamLeaderConfig(row.teamWork);
  const today = new Date().toLocaleDateString("en-GB");
  const panelCount = panelCountFromSetupKw(row.setupKw);
  return attachStockCatalog({
    id: `site-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    consumerNo: row.consumerNo || "",
    customerName: row.customerName || "",
    fatherName: row.fatherName || "",
    address: row.address || "",
    customerMobile: row.mobile || "",
    setupKw: row.setupKw || "",
    teamWork: row.teamWork || "",
    teamLeaderName: team?.leaderName || "",
    teamLeaderMobile: team?.mobile || "",
    defaultMembers: team?.defaultMembers ?? [],
    siteDate: today,
    panelCount,
    status: "pending",
    createdAt: new Date().toISOString(),
    submittedAt: "",
    formPayload: null,
  });
}

export function upsertSiteOrderForSaleRow(row) {
  if (!row?.consumerNo?.trim() || !row?.teamWork?.trim()) return null;

  const list = readOrders();
  const cn = String(row.consumerNo).trim().toUpperCase();
  let existing = list.find(
    (o) =>
      String(o.consumerNo || "")
        .trim()
        .toUpperCase() === cn && o.status !== "submitted",
  );

  if (existing) {
    existing = attachStockCatalog({
      ...existing,
      customerName: row.customerName || existing.customerName,
      fatherName: row.fatherName || existing.fatherName,
      address: row.address || existing.address,
      customerMobile: row.mobile || existing.customerMobile,
      setupKw: row.setupKw || existing.setupKw,
      teamWork: row.teamWork,
      teamLeaderName: getSaleTeamLeaderConfig(row.teamWork)?.leaderName || existing.teamLeaderName,
      teamLeaderMobile: getSaleTeamLeaderConfig(row.teamWork)?.mobile || existing.teamLeaderMobile,
      defaultMembers: getSaleTeamLeaderConfig(row.teamWork)?.defaultMembers ?? existing.defaultMembers,
      panelCount: panelCountFromSetupKw(row.setupKw || existing.setupKw),
      updatedAt: new Date().toISOString(),
    });
    const next = list.map((o) => (o.id === existing.id ? existing : o));
    writeOrders(next);
    return existing;
  }

  const created = buildSiteOrderFromSaleRow(row);
  writeOrders([created, ...list]);
  return created;
}

export function markSiteOrderSubmitted(orderId, formPayload) {
  const list = readOrders();
  const idx = list.findIndex((o) => o.id === orderId);
  if (idx < 0) return null;
  list[idx] = {
    ...list[idx],
    status: "submitted",
    submittedAt: new Date().toISOString(),
    formPayload,
  };
  writeOrders(list);
  return list[idx];
}

/** Link se khula order — office browser me save (stock submit ke liye). */
export function ensureSiteOrderInStorage(order) {
  if (!order?.id) return null;
  const list = readOrders();
  const idx = list.findIndex((o) => o.id === order.id);
  const merged = {
    ...(idx >= 0 ? list[idx] : {}),
    ...order,
    status: order.status || "pending",
  };
  if (idx >= 0) list[idx] = merged;
  else list.unshift(merged);
  writeOrders(list);
  return merged;
}
