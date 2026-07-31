import { formatSetupDetail } from "../constants/bomRegistry";
import { syncCustomerDetailFromSaleSheet } from "./customerDetailSaleSync";
import { getBomMaterialsForConsumer, syncBomFilesFromSaleRows } from "./bomSheetStorage";
import { erpGetItem, erpSetItem } from "./erpStorage";

const STORAGE_KEY = "dhatterwal_sale_case_rows";
export const SALE_BOM_SYNC_EVENT = "dhatterwal-sale-bom-sync";
export const SALE_SETUP_DETAIL_SYNC_EVENT = "dhatterwal-sale-setup-detail-sync";

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function loadSaleCaseRows() {
  const stored = safeParse(erpGetItem(STORAGE_KEY), null);
  return Array.isArray(stored) ? stored : [];
}

export function saveSaleCaseRows(rows, options = {}) {
  const { syncCustomerDetail = true, syncBom = true } = options;
  try {
    erpSetItem(STORAGE_KEY, JSON.stringify(rows));
    if (syncBom) {
      syncBomFilesFromSaleRows(rows);
      window.dispatchEvent(new Event(SALE_BOM_SYNC_EVENT));
    }
    if (syncCustomerDetail) {
      syncCustomerDetailFromSaleSheet({ dispatchEvent: true });
    }
  } catch {
    /* ignore quota */
  }
}

/** Site form / BOM materials → Sale Sheet Setup Detail column */
export function applyBomToSaleSetupDetail(consumerNo) {
  const key = String(consumerNo || "").trim().toUpperCase();
  if (!key) return { ok: false, changed: false };

  const materials = getBomMaterialsForConsumer(key);
  const setupDetail = formatSetupDetail(materials);
  const rows = loadSaleCaseRows();
  let changed = false;
  const next = rows.map((row) => {
    if (String(row.consumerNo || "").trim().toUpperCase() !== key) return row;
    if (String(row.setupDetail || "") === setupDetail) return row;
    changed = true;
    return { ...row, setupDetail };
  });

  if (changed) {
    /* BOM pehle se site-order se update ho chuka — dubara placeholder mat likho */
    saveSaleCaseRows(next, { syncBom: false, syncCustomerDetail: true });
    window.dispatchEvent(new Event(SALE_SETUP_DETAIL_SYNC_EVENT));
    window.dispatchEvent(new Event(SALE_BOM_SYNC_EVENT));
  }
  return { ok: true, changed, setupDetail };
}
