import { syncCustomerDetailFromSaleSheet } from "./customerDetailSaleSync";
import { syncBomFilesFromSaleRows } from "./bomSheetStorage";
import { erpGetItem, erpSetItem } from "./erpStorage";

const STORAGE_KEY = "dhatterwal_sale_case_rows";
export const SALE_BOM_SYNC_EVENT = "dhatterwal-sale-bom-sync";

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
  const { syncCustomerDetail = true } = options;
  try {
    erpSetItem(STORAGE_KEY, JSON.stringify(rows));
    syncBomFilesFromSaleRows(rows);
    window.dispatchEvent(new Event(SALE_BOM_SYNC_EVENT));
    if (syncCustomerDetail) {
      syncCustomerDetailFromSaleSheet({ dispatchEvent: true });
    }
  } catch {
    /* ignore quota */
  }
}
