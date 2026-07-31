import { loadCashCaseRows } from "./cashCaseStorage";
import { followUpCount } from "./dashboardFollowUp";
import { loadLoanCaseRows } from "./loanCaseStorage";
import { loadPurchaseHistory } from "./purchaseHistoryStorage";
import { countPendingQueries } from "./querySheetStorage";
import { loadSaleCaseRows } from "./saleCaseStorage";
import { listStockSheetRows } from "./stockStorage";
import { ROUTES } from "../constants/routes";

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function todayIndianDate() {
  const d = new Date();
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function parseMoney(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(String(value ?? "").replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatInr(amount) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function hasConsumer(row) {
  return Boolean(String(row?.consumerNo || "").trim());
}

export function buildDashboardStatCards() {
  const today = todayIndianDate();
  const loanRows = loadLoanCaseRows().filter((r) => !r.isBackupEntry && hasConsumer(r));
  const cashRows = loadCashCaseRows().filter(hasConsumer);
  const saleToday = loadSaleCaseRows().filter(
    (r) => hasConsumer(r) && String(r.date || "").trim() === today,
  );
  const saleTotal = saleToday.reduce((sum, r) => sum + parseMoney(r.amount), 0);
  const purchaseToday = loadPurchaseHistory().filter(
    (p) => String(p.invoiceDate || "").trim() === today,
  );
  const purchaseTotal = purchaseToday.reduce(
    (sum, p) => sum + (Number(p.grandTotal) || Number(p.totalAmount) || 0),
    0,
  );
  const stockRows = listStockSheetRows();
  const stockQty = stockRows.reduce((sum, r) => sum + (Number(r.balance) || 0), 0);
  const pendingCount = countPendingQueries();

  return [
    {
      title: "Total Loan Cases",
      value: String(loanRows.length),
      note: "Active Loan Cases",
      tone: "green",
      icon: "loan",
      to: ROUTES.LOAN_CASE,
    },
    {
      title: "Total Cash Cases",
      value: String(cashRows.length),
      note: "All Cash Cases",
      tone: "yellow",
      icon: "cash",
      to: ROUTES.CASH_CASE,
    },
    {
      title: "Today's Sales",
      value: formatInr(saleTotal),
      note: `${saleToday.length} Sale entr${saleToday.length === 1 ? "y" : "ies"}`,
      tone: "blue",
      icon: "sale",
      to: ROUTES.SALE_SHEET,
    },
    {
      title: "Today's Purchases",
      value: formatInr(purchaseTotal),
      note: `${purchaseToday.length} Purchase${purchaseToday.length === 1 ? "" : "s"}`,
      tone: "purple",
      icon: "purchase",
      to: ROUTES.PURCHASE_NEW,
    },
    {
      title: "Available Stock",
      value: String(Math.round(stockQty)),
      note: `${stockRows.length} Stock lines`,
      tone: "orange",
      icon: "stock",
      to: ROUTES.STOCK_SHEET,
    },
    {
      title: "Pending Queries",
      value: String(pendingCount).padStart(2, "0"),
      note: "Requires Action",
      tone: "red",
      icon: "query",
      to: ROUTES.QUERY_PENDING,
    },
  ];
}

export function getNotificationCount() {
  return followUpCount() + countPendingQueries();
}

export function getLowStockRows(limit = 5) {
  return listStockSheetRows()
    .filter((r) => (Number(r.balance) || 0) > 0 && (Number(r.balance) || 0) <= 15)
    .sort((a, b) => (Number(a.balance) || 0) - (Number(b.balance) || 0))
    .slice(0, limit)
    .map((r) => [
      r.itemName || "—",
      r.category || "—",
      String(Math.round(Number(r.balance) || 0)),
      "Low Stock",
    ]);
}

export const DASHBOARD_SYNC_EVENTS = [
  "dhatterwal-erp-cloud-sync",
  "dhatterwal-loan-case-sync",
  "dhatterwal-cash-case-sync",
  "dhatterwal-sale-bom-sync",
  "dhatterwal-purchase-history-sync",
  "dhatterwal-stock-sync",
  "dhatterwal-query-sheet-sync",
];
