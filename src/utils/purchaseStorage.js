import { erpGetItem, erpRemoveItem, erpSetItem } from "./erpStorage";
const KEY = "dhatterwal_purchase_drafts";

export function savePurchaseDraft(payload) {
  try {
    erpSetItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function loadPurchaseDraft() {
  try {
    const raw = erpGetItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPurchaseDraft() {
  try {
    erpRemoveItem(KEY);
  } catch {
    /* ignore */
  }
}
