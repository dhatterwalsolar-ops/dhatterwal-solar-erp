import { erpGetItem, erpRemoveItem, erpSetItem } from "./erpStorage";
const STORAGE_KEY = "dhatterwal_labour_daily_entry";

export function saveLabourEntry(payload) {
  try {
    erpSetItem(STORAGE_KEY, JSON.stringify(payload));
    erpSetItem(
      `${STORAGE_KEY}_history`,
      JSON.stringify([
        ...(JSON.parse(erpGetItem(`${STORAGE_KEY}_history`) || "[]") || []),
        { ...payload, savedAt: new Date().toISOString() },
      ].slice(-30)),
    );
  } catch {
    /* ignore quota */
  }
}

export function loadLabourEntryDraft() {
  try {
    const raw = erpGetItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
