const STORAGE_KEY = "dhatterwal_labour_daily_entry";

export function saveLabourEntry(payload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(
      `${STORAGE_KEY}_history`,
      JSON.stringify([
        ...(JSON.parse(localStorage.getItem(`${STORAGE_KEY}_history`) || "[]") || []),
        { ...payload, savedAt: new Date().toISOString() },
      ].slice(-30)),
    );
  } catch {
    /* ignore quota */
  }
}

export function loadLabourEntryDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
