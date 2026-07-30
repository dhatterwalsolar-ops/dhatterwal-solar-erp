import { SALE_CASE_SAMPLE_ROWS } from "../constants/saleCase";
import { syncCustomerDetailFromSaleSheet } from "./customerDetailSaleSync";
import { syncBomFilesFromSaleRows } from "./bomSheetStorage";
import { erpGetItem, erpRemoveItem, erpSetItem } from "./erpStorage";

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
  if (Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  return SALE_CASE_SAMPLE_ROWS.map((row) => ({ ...row }));
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
