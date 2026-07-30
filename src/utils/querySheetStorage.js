import { erpGetItem, erpSetItem } from "./erpStorage";

const KEY = "dhatterwal_query_sheet";
export const QUERY_SHEET_SYNC_EVENT = "dhatterwal-query-sheet-sync";

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function loadQueries() {
  const list = safeParse(erpGetItem(KEY), []);
  return Array.isArray(list) ? list : [];
}

export function saveQueries(list) {
  erpSetItem(KEY, JSON.stringify(Array.isArray(list) ? list : []));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(QUERY_SHEET_SYNC_EVENT));
  }
}

export function createEmptyQuery({ createdBy = "" } = {}) {
  const pad = (n) => String(n).padStart(2, "0");
  const d = new Date();
  return {
    id: `qry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    consumerNo: "",
    customerName: "",
    queryAbout: "",
    detail: "",
    status: "Pending",
    createdBy: createdBy || "",
    createdAt: new Date().toISOString(),
  };
}

export function addQuery(entry) {
  const list = loadQueries();
  list.unshift(entry);
  saveQueries(list);
  return entry;
}

export function updateQuery(id, patch) {
  const list = loadQueries().map((q) => (q.id === id ? { ...q, ...patch } : q));
  saveQueries(list);
  return list.find((q) => q.id === id) || null;
}

export function deleteQuery(id) {
  saveQueries(loadQueries().filter((q) => q.id !== id));
}
