import { ROUTES } from "./routes";

export const ERP_MENU = [
  { key: "loan", label: "Loan Case", path: ROUTES.LOAN_CASE, icon: "loan" },
  { key: "cash", label: "Cash Case", path: ROUTES.CASH_CASE, icon: "cash" },
  {
    key: "updateNameLoad",
    label: "Update Name / Load",
    path: ROUTES.UPDATE_NAME_LOAD,
    icon: "updateNameLoad",
  },
  { key: "sale", label: "Sale Sheet", path: ROUTES.SALE_SHEET, icon: "sale" },
  { key: "purchase", label: "Purchase Sheet", path: ROUTES.PURCHASE_SHEET, icon: "purchase" },
  { key: "product", label: "Product Sheet", path: ROUTES.PRODUCT_SHEET, icon: "product" },
  { key: "payment", label: "Payment Sheet", path: ROUTES.PAYMENT_SHEET, icon: "payment" },
  { key: "stock", label: "Stock Sheet", path: ROUTES.STOCK_SHEET, icon: "stock" },
  { key: "bom", label: "BOM Sheet", path: ROUTES.BOM_SHEET, icon: "bom" },
  { key: "labour", label: "Labour Management", path: ROUTES.LABOUR_SHEET, icon: "labour" },
  {
    key: "customer",
    label: "Customer All Detail",
    path: ROUTES.CUSTOMER_DETAIL,
    icon: "customer",
  },
  { key: "invoiceFile", label: "Invoice File", path: ROUTES.INVOICE_FILE, icon: "invoiceFile" },
  {
    key: "query",
    label: "Query Sheet",
    path: ROUTES.QUERY_PENDING,
    icon: "query",
  },
  { key: "reports", label: "Reports", path: ROUTES.REPORTS, icon: "report" },
];

export const ERP_SHEET_CONFIG = {
  loan: {
    title: "Loan Case",
    columns: [],
    rows: [],
  },
  cash: {
    title: "Cash Case",
    columns: ["Case ID", "Customer", "System kW", "Amount", "Payment Mode", "Date"],
    rows: [],
  },
  updateNameLoad: {
    title: "Update Name / Load",
    columns: [],
    rows: [],
  },
  sale: {
    title: "Sale Sheet",
    columns: [],
    rows: [],
  },
  invoiceFile: {
    title: "Invoice File",
    columns: [],
    rows: [],
  },
  purchase: {
    title: "Purchase Sheet",
    columns: ["PO No", "Vendor", "Material", "Qty", "Amount", "Date"],
    rows: [],
  },
  product: {
    title: "Product Sheet",
    columns: ["SKU", "Product Name", "Category", "MRP", "Stock", "Status"],
    rows: [],
  },
  payment: {
    title: "Payment Sheet",
    columns: ["Payment ID", "Party", "Type", "Mode", "Amount", "Date"],
    rows: [],
  },
  stock: {
    title: "Stock Sheet",
    columns: ["Item Code", "Product", "Warehouse", "In", "Out", "Balance"],
    rows: [],
  },
  bom: {
    title: "BOM Sheet",
    columns: ["BOM ID", "Project", "Panel", "Inverter", "Structure", "Status"],
    rows: [],
  },
  labour: {
    title: "Labour Sheet",
    columns: ["Worker", "Site", "Days", "Rate/Day", "Payable", "Status"],
    rows: [],
  },
  customer: {
    title: "Customer All Detail",
    columns: ["Customer ID", "Name", "Phone", "City", "System", "Lead Status"],
    rows: [],
  },
  query: {
    title: "Query Pending",
    columns: ["Query ID", "Customer", "Subject", "Priority", "Assigned To", "Due"],
    rows: [],
  },
  monthly: {
    title: "Monthly Report",
    columns: ["Month", "Sales", "Purchases", "Collections", "Profit", "Remarks"],
    rows: [],
  },
  gst: {
    title: "GST Report",
    columns: ["Period", "GSTR-1", "GSTR-3B", "Tax Payable", "Due Date", "Status"],
    rows: [],
  },
};

export function getSheetConfigByPath(pathname) {
  const item = ERP_MENU.find((entry) => entry.path === pathname);
  if (!item) return null;
  return ERP_SHEET_CONFIG[item.key] ?? null;
}

export function getPageTitleByPath(pathname) {
  if (pathname === ROUTES.DASHBOARD) return "Dashboard";
  if (pathname === ROUTES.SETTINGS) return "Settings";
  if (pathname === ROUTES.PURCHASE_SHEET) return "Purchase Sheet";
  if (pathname === ROUTES.PURCHASE_NEW) return "New Purchase Entry";
  if (pathname === ROUTES.PURCHASE_LIST) return "Purchase List";
  if (pathname === ROUTES.LABOUR_DETAILS) return "Labour Details";
  if (pathname === ROUTES.LABOUR_DAILY) return "Daily Labour Work";
  if (pathname === ROUTES.LABOUR_SHEET || pathname.startsWith(`${ROUTES.LABOUR_SHEET}/`)) {
    return "Labour Management";
  }
  if (pathname === ROUTES.REPORTS || pathname.startsWith(`${ROUTES.REPORTS}/`)) {
    if (pathname === ROUTES.REPORTS_SALE) return "Monthly Sale Report";
    if (pathname === ROUTES.REPORTS_PURCHASE) return "Monthly Purchase Report";
    if (pathname === ROUTES.REPORTS_STOCK) return "Monthly Stock Report";
    if (pathname === ROUTES.REPORTS_GST) return "Monthly GST Report";
    return "Reports Dashboard";
  }
  if (pathname === ROUTES.PAYMENT_SHEET || pathname.startsWith(`${ROUTES.PAYMENT_SHEET}/`)) {
    if (pathname === ROUTES.PAYMENT_RECEIVED) return "Payment Received";
    if (pathname === ROUTES.PAYMENT_GIVEN) return "Payment Given";
    if (pathname === ROUTES.PAYMENT_CREDIT) return "Credit & Bank Limit";
    if (pathname === ROUTES.PAYMENT_DASHBOARD) return "Total Payment Dashboard";
    return "Payment Sheet";
  }
  if (pathname === ROUTES.PURCHASE_SHEET || pathname.startsWith(`${ROUTES.PURCHASE_SHEET}/`)) {
    if (pathname === ROUTES.PURCHASE_LIST) return "Purchase List";
    return "New Purchase Entry";
  }
  if (pathname === ROUTES.BOM_SHEET || pathname.startsWith(`${ROUTES.BOM_SHEET}/`)) {
    if (pathname === ROUTES.BOM_MONTHLY_PROFIT) return "BOM Monthly Profit";
    return "BOM Sheet";
  }
  const item = ERP_MENU.find((entry) => entry.path === pathname);
  return item?.label ?? "Dashboard";
}
