export const SETTINGS_OTP_MOBILE = "9992891723";
export const SETTINGS_OTP_MOBILE_DISPLAY = "+91 99928 91723";

export const DEFAULT_ERP_USERS = [
  {
    id: "admin",
    userType: "Admin",
    userName: "Sonu Ji",
    passwordMask: "********",
    lastUpdated: "20/07/2025",
  },
  {
    id: "staff",
    userType: "Staff",
    userName: "Rohit Kumar",
    passwordMask: "********",
    lastUpdated: "18/07/2025",
  },
];

export const DEFAULT_INVOICE_SERIES = {
  prefix: "DS/",
  nextNumber: "323",
  suffix: "/2026-27",
  separator: "",
};

export const DEFAULT_QUOTATION_SERIES = {
  prefix: "DS/Q/",
  nextNumber: "000045",
  suffix: "/2026-27",
  separator: "",
};

export const SETTINGS_ACTIVITY_LOG = [
  ["20/07/2025 04:12 PM", "Sonu Ji", "Invoice series updated"],
  ["18/07/2025 11:30 AM", "Sonu Ji", "Admin password changed"],
  ["15/07/2025 09:05 AM", "Rohit Kumar", "Staff login from new device"],
];

export function buildSeriesPreview({ prefix, nextNumber, suffix, separator }) {
  const join = separator === undefined || separator === null ? "-" : separator;
  return `${prefix || ""}${join}${nextNumber || ""}${suffix || ""}`;
}
