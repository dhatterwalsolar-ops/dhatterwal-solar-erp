import { loadLoanCaseRows } from "./loanCaseStorage";
import { loadUpdateNameLoadRows } from "./updateNameLoadStorage";

export const FOLLOW_UP_AFTER_DAYS = 10;

function parseIndianDate(str) {
  const parts = String(str || "").trim().split("/");
  if (parts.length !== 3) return null;
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);
  if (!day || !month || !year) return null;
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysSinceReference(refDate) {
  if (!refDate) return null;
  const start = startOfDay(refDate);
  const today = startOfDay(new Date());
  return Math.floor((today - start) / 86400000);
}

function isDueForFollowUp(refDate) {
  const days = daysSinceReference(refDate);
  return days !== null && days >= FOLLOW_UP_AFTER_DAYS;
}

/**
 * Loan apply date ≥ 10 days ago, and Name/Load update saved ≥ 10 days ago.
 */
export function buildTodayFollowUps() {
  const items = [];

  loadLoanCaseRows().forEach((row) => {
    if (!row.consumerNo?.trim()) return;
    const ref = parseIndianDate(row.date);
    if (!isDueForFollowUp(ref)) return;
    items.push({
      id: `loan-${row.consumerNo}`,
      kind: "loan",
      kindLabel: "Loan Apply Follow-up",
      consumerNo: row.consumerNo,
      customerName: row.customerName || "—",
      mobile: row.mobile || "",
      referenceDate: row.date || "—",
      daysAgo: daysSinceReference(ref),
      detail: `Loan case — ${row.setupKw || "—"} setup`,
    });
  });

  loadUpdateNameLoadRows().forEach((row) => {
    if (!row.consumerNo?.trim()) return;
    if (!row.savedAt) return;
    const ref = new Date(row.savedAt);
    if (!isDueForFollowUp(ref)) return;
    items.push({
      id: `unl-${row.id}`,
      kind: "name-load",
      kindLabel: row.subject || "Name / Load Update",
      consumerNo: row.consumerNo,
      customerName: row.customerName || "—",
      mobile: row.mobile || "",
      referenceDate: row.date || (row.savedAt ? new Date(row.savedAt).toLocaleDateString("en-GB") : "—"),
      daysAgo: daysSinceReference(ref),
      detail: row.subject === "Load Update" ? "Load update follow-up" : "Name change follow-up",
    });
  });

  return items.sort((a, b) => (b.daysAgo || 0) - (a.daysAgo || 0));
}

export function followUpCount() {
  return buildTodayFollowUps().length;
}
