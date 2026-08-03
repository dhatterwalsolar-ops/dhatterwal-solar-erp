import { erpGetItem, erpSetItem } from "./erpStorage";

const KEY = "dhatterwal_query_sheet";
export const QUERY_SHEET_SYNC_EVENT = "dhatterwal-query-sheet-sync";
export const QUERY_STATUS = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
};

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function todayIndian() {
  const pad = (n) => String(n).padStart(2, "0");
  const d = new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Resolved = TL fix photo OR admin close with remark. Customer error photo does NOT close. */
export function isQueryResolved(row = {}) {
  if (row.closedVia === "admin" && String(row.closeRemark || "").trim()) return true;
  if (row.photoData || row.photoUrl) return true;
  return String(row.status || "") === QUERY_STATUS.RESOLVED && Boolean(row.closedVia);
}

export function normalizeQuery(row = {}) {
  const resolved = isQueryResolved(row);
  return {
    id: row.id || `qry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: row.date || todayIndian(),
    consumerNo: String(row.consumerNo || "").trim(),
    customerName: String(row.customerName || "").trim(),
    mobile: String(row.mobile || "").trim(),
    address: String(row.address || "").trim(),
    queryAbout: String(row.queryAbout || "").trim(),
    detail: String(row.detail || "").trim(),
    status: resolved ? QUERY_STATUS.RESOLVED : QUERY_STATUS.PENDING,
    source: row.source === "public" ? "public" : "erp",
    kind: String(row.kind || "").trim().toLowerCase() === "consultation"
      ? "consultation"
      : "query",
    createdBy: String(row.createdBy || "").trim(),
    createdAt: row.createdAt || new Date().toISOString(),
    assignedTeamWork: String(row.assignedTeamWork || "").trim(),
    assignedLeaderName: String(row.assignedLeaderName || "").trim(),
    assignedLeaderMobile: String(row.assignedLeaderMobile || "").trim(),
    assignedAt: row.assignedAt || "",
    /** Customer uploaded inverter/site error photo (from website) */
    customerPhotoData: row.customerPhotoData || "",
    customerPhotoName: row.customerPhotoName || "",
    /** Team leader fix / completion photo */
    photoData: row.photoData || "",
    photoName: row.photoName || "",
    photoUploadedAt: row.photoUploadedAt || "",
    photoUploadedBy: row.photoUploadedBy || "",
    closeRemark: String(row.closeRemark || "").trim(),
    closedBy: String(row.closedBy || "").trim(),
    closedAt: row.closedAt || "",
    closedVia: row.closedVia === "admin" || row.closedVia === "team_leader" ? row.closedVia : "",
    /** Website query → ERP se Jagdeep WhatsApp alert bhejna pending */
    staffAlertSent: Boolean(row.staffAlertSent),
    staffAlertSentAt: row.staffAlertSentAt || "",
  };
}

export function listQueriesNeedingStaffAlert() {
  return loadQueries().filter(
    (q) => q.source === "public" && !q.staffAlertSent && !isQueryResolved(q),
  );
}

export function loadQueries() {
  const list = safeParse(erpGetItem(KEY), []);
  return (Array.isArray(list) ? list : []).map(normalizeQuery);
}

export function saveQueries(list) {
  const cleaned = (Array.isArray(list) ? list : []).map(normalizeQuery);
  erpSetItem(KEY, JSON.stringify(cleaned));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(QUERY_SHEET_SYNC_EVENT));
  }
}

export function createEmptyQuery({ createdBy = "", source = "erp" } = {}) {
  return normalizeQuery({
    id: `qry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: todayIndian(),
    status: QUERY_STATUS.PENDING,
    createdBy,
    source,
    createdAt: new Date().toISOString(),
  });
}

export function addQuery(entry) {
  const list = loadQueries();
  const row = normalizeQuery(entry);
  list.unshift(row);
  saveQueries(list);
  return row;
}

export function updateQuery(id, patch) {
  const list = loadQueries().map((q) =>
    q.id === id ? normalizeQuery({ ...q, ...patch, id: q.id }) : q,
  );
  saveQueries(list);
  return list.find((q) => q.id === id) || null;
}

export function deleteQuery(id) {
  saveQueries(loadQueries().filter((q) => q.id !== id));
}

export function countPendingQueries() {
  return loadQueries().filter((q) => !isQueryResolved(q)).length;
}
