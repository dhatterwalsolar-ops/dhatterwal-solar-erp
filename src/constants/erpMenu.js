import { ROUTES } from "./routes";

export const ERP_MENU = [
  { key: "loan", label: "Loan Case", path: ROUTES.LOAN_CASE, icon: "loan" },
  { key: "cash", label: "Cash Case", path: ROUTES.CASH_CASE, icon: "cash" },
  { key: "sale", label: "Sale Sheet", path: ROUTES.SALE_SHEET, icon: "sale" },
  { key: "purchase", label: "Purchase Sheet", path: ROUTES.PURCHASE_SHEET, icon: "purchase" },
  { key: "product", label: "Product Sheet", path: ROUTES.PRODUCT_SHEET, icon: "product" },
  { key: "payment", label: "Payment Sheet", path: ROUTES.PAYMENT_SHEET, icon: "payment" },
  { key: "stock", label: "Stock Sheet", path: ROUTES.STOCK_SHEET, icon: "stock" },
  { key: "bom", label: "BOM Sheet", path: ROUTES.BOM_SHEET, icon: "bom" },
  { key: "labour", label: "Labour Sheet", path: ROUTES.LABOUR_SHEET, icon: "labour" },
  {
    key: "customer",
    label: "Customer All Detail",
    path: ROUTES.CUSTOMER_DETAIL,
    icon: "customer",
  },
  {
    key: "query",
    label: "Query Pending",
    path: ROUTES.QUERY_PENDING,
    icon: "query",
    badge: 7,
  },
  { key: "monthly", label: "Monthly Report", path: ROUTES.MONTHLY_REPORT, icon: "report" },
  { key: "gst", label: "GST Report", path: ROUTES.GST_REPORT, icon: "gst" },
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
    rows: [
      ["CC-881", "Amit Sharma", "5 kW", "₹2,10,000", "Cash", "20 Jul 2025"],
      ["CC-880", "Neha Gupta", "3 kW", "₹1,35,000", "UPI", "19 Jul 2025"],
    ],
  },
  sale: {
    title: "Sale Sheet",
    columns: ["Invoice No", "Customer", "Items", "Tax", "Total", "Date"],
    rows: [
      ["INV-2407-18", "Dhatterwal Traders", "Inverter + Panels", "₹18,000", "₹1,18,000", "20 Jul 2025"],
      ["INV-2407-17", "Green Homes", "5kW Package", "₹32,400", "₹2,12,400", "19 Jul 2025"],
    ],
  },
  purchase: {
    title: "Purchase Sheet",
    columns: ["PO No", "Vendor", "Material", "Qty", "Amount", "Date"],
    rows: [
      ["PO-778", "Waaree Solar", "540W Panels", "40", "₹4,80,000", "20 Jul 2025"],
      ["PO-777", "Growatt India", "5kW Inverter", "6", "₹1,80,000", "18 Jul 2025"],
    ],
  },
  product: {
    title: "Product Sheet",
    columns: ["SKU", "Product Name", "Category", "MRP", "Stock", "Status"],
    rows: [
      ["P-540-M", "Mono 540W Panel", "Panel", "₹12,500", "86", "Active"],
      ["I-5K-H", "5kW Hybrid Inverter", "Inverter", "₹42,000", "14", "Active"],
    ],
  },
  payment: {
    title: "Payment Sheet",
    columns: ["Payment ID", "Party", "Type", "Mode", "Amount", "Date"],
    rows: [
      ["PAY-991", "Ramesh Kumar", "Received", "Bank", "₹50,000", "20 Jul 2025"],
      ["PAY-990", "Waaree Solar", "Paid", "NEFT", "₹1,20,000", "19 Jul 2025"],
    ],
  },
  stock: {
    title: "Stock Sheet",
    columns: ["Item Code", "Product", "Warehouse", "In", "Out", "Balance"],
    rows: [
      ["ST-11", "540W Panel", "Main Store", "40", "8", "156"],
      ["ST-22", "Structure Kit", "Main Store", "20", "5", "42"],
    ],
  },
  bom: {
    title: "BOM Sheet",
    columns: ["BOM ID", "Project", "Panel", "Inverter", "Structure", "Status"],
    rows: [
      ["BOM-301", "5kW Residential", "8 Nos", "1 Nos", "1 Set", "Finalized"],
      ["BOM-300", "10kW Commercial", "18 Nos", "2 Nos", "2 Set", "Draft"],
    ],
  },
  labour: {
    title: "Labour Sheet",
    columns: ["Worker", "Site", "Days", "Rate/Day", "Payable", "Status"],
    rows: [
      ["Rajesh Team", "Rohtak Site A", "4", "₹1,200", "₹4,800", "Pending"],
      ["Sunil Electric", "Jind Site B", "2", "₹1,500", "₹3,000", "Paid"],
    ],
  },
  customer: {
    title: "Customer All Detail",
    columns: ["Customer ID", "Name", "Phone", "City", "System", "Lead Status"],
    rows: [
      ["CU-501", "Ramesh Kumar", "9992891023", "Rohtak", "5 kW On-Grid", "Installed"],
      ["CU-502", "Sunita Devi", "9467564675", "Jind", "3 kW Hybrid", "Quotation Sent"],
    ],
  },
  query: {
    title: "Query Pending",
    columns: ["Query ID", "Customer", "Subject", "Priority", "Assigned To", "Due"],
    rows: [
      ["Q-701", "Amit Sharma", "Net meter delay", "High", "Staff Team", "21 Jul 2025"],
      ["Q-700", "Neha Gupta", "AMC renewal", "Medium", "Support", "22 Jul 2025"],
    ],
  },
  monthly: {
    title: "Monthly Report",
    columns: ["Month", "Sales", "Purchases", "Collections", "Profit", "Remarks"],
    rows: [
      ["Jul 2025", "₹12,40,000", "₹8,10,000", "₹9,85,000", "₹2,45,000", "On track"],
      ["Jun 2025", "₹10,90,000", "₹7,40,000", "₹8,70,000", "₹2,10,000", "Closed"],
    ],
  },
  gst: {
    title: "GST Report",
    columns: ["Period", "GSTR-1", "GSTR-3B", "Tax Payable", "Due Date", "Status"],
    rows: [
      ["Jun 2025", "Filed", "Pending", "₹48,500", "20 Jul 2025", "Due Soon"],
      ["May 2025", "Filed", "Filed", "₹41,200", "20 Jun 2025", "Completed"],
    ],
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
  const item = ERP_MENU.find((entry) => entry.path === pathname);
  return item?.label ?? "Dashboard";
}
