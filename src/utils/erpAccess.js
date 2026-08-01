import { AUTH_ROLES } from "../constants/auth";
import { ERP_MENU } from "../constants/erpMenu";
import { ROUTES } from "../constants/routes";

/** Sidebar sheets default staff may open. */
export const STAFF_ALLOWED_MENU_KEYS = new Set([
  "loan",
  "cash",
  "updateNameLoad",
  "sale",
  "labour",
  "invoiceFile",
]);

/**
 * Access profiles (Settings → Add User).
 * Ajay Dhatterwal / Jagdeep / Randeep = Loan + Cash + Sale + Labour + Query (Staff).
 * Ajay Nain = Loan + Cash + Sale (sirf apne reference) + Query.
 */
export const ACCESS_PROFILES = {
  admin: {
    id: "admin",
    label: "Admin (full)",
    role: AUTH_ROLES.ADMIN,
    menuKeys: null,
  },
  ajay_dhatterwal: {
    id: "ajay_dhatterwal",
    label: "Ajay Dhatterwal (Loan/Cash/Sale/Labour/Query)",
    role: AUTH_ROLES.STAFF,
    menuKeys: ["loan", "cash", "sale", "labour", "query"],
  },
  staff: {
    id: "staff",
    label: "Staff (default)",
    role: AUTH_ROLES.STAFF,
    menuKeys: [...STAFF_ALLOWED_MENU_KEYS],
  },
  ajay_nain: {
    id: "ajay_nain",
    label: "Ajay Nain (Loan/Cash/Sale+Customer by ref/Query)",
    role: AUTH_ROLES.STAFF,
    menuKeys: ["loan", "cash", "sale", "customer", "query"],
    /** Sale + Customer All Detail me sirf is Reference wale customers */
    saleReferenceFilter: "Ajay Nain",
    saleInvoiceDownloadOnly: true,
    /** Customer All Detail — amount / received payment add-edit band */
    customerDetailAmountReadOnly: true,
  },
};

export function getAccessProfile(profileId) {
  const id = String(profileId || "").trim();
  if (id && ACCESS_PROFILES[id]) return ACCESS_PROFILES[id];
  return null;
}

export function resolveAccessProfile(session) {
  const fromSession = getAccessProfile(session?.accessProfile);
  if (fromSession) return fromSession;
  if (session?.role === AUTH_ROLES.ADMIN) return ACCESS_PROFILES.admin;
  if (session?.role === AUTH_ROLES.STAFF) return ACCESS_PROFILES.staff;
  return null;
}

export function isAdminSession(session) {
  const profile = resolveAccessProfile(session);
  if (profile) return profile.role === AUTH_ROLES.ADMIN;
  return session?.role === AUTH_ROLES.ADMIN;
}

/** Row/user delete aur critical settings change — sirf Admin. */
export function canChangeOrDelete(session) {
  return isAdminSession(session);
}

/** Admin ya Jagdeep (ajay_dhatterwal) — query remark se close kar sakte hain. */
export function canCloseQueryWithRemark(session) {
  if (isAdminSession(session)) return true;
  const profile = resolveAccessProfile(session);
  return profile?.id === "ajay_dhatterwal";
}

export function canAccessMenuKey(session, menuKey) {
  const profile = resolveAccessProfile(session);
  if (!profile) return false;
  if (!profile.menuKeys) return true;
  return profile.menuKeys.includes(menuKey);
}

export function getErpMenuForSession(session) {
  const profile = resolveAccessProfile(session);
  if (!profile) return [];
  if (!profile.menuKeys) return ERP_MENU;
  return ERP_MENU.filter((item) => profile.menuKeys.includes(item.key));
}

export function getSaleReferenceFilter(session) {
  return resolveAccessProfile(session)?.saleReferenceFilter || "";
}

/** Sale Sheet + Customer All Detail — same reference lock (e.g. Ajay Nain). */
export function getCustomerReferenceFilter(session) {
  return getSaleReferenceFilter(session);
}

export function isSaleInvoiceDownloadOnly(session) {
  return Boolean(resolveAccessProfile(session)?.saleInvoiceDownloadOnly);
}

/** Customer All Detail — amount / received payments edit (ajaynain = no). */
export function canEditCustomerDetailAmounts(session) {
  return !resolveAccessProfile(session)?.customerDetailAmountReadOnly;
}

export function canAccessPath(session, pathname) {
  if (!session?.role && !session?.accessProfile) return false;
  if (pathname === ROUTES.DASHBOARD) return true;
  if (pathname === ROUTES.SETTINGS) return isAdminSession(session);

  if (pathname === ROUTES.LABOUR_SHEET || pathname.startsWith(`${ROUTES.LABOUR_SHEET}/`)) {
    return canAccessMenuKey(session, "labour");
  }

  if (pathname === ROUTES.REPORTS || pathname.startsWith(`${ROUTES.REPORTS}/`)) {
    return canAccessMenuKey(session, "reports");
  }

  if (pathname === ROUTES.PAYMENT_SHEET || pathname.startsWith(`${ROUTES.PAYMENT_SHEET}/`)) {
    return canAccessMenuKey(session, "payment");
  }

  if (pathname === ROUTES.PURCHASE_SHEET || pathname.startsWith(`${ROUTES.PURCHASE_SHEET}/`)) {
    return canAccessMenuKey(session, "purchase");
  }

  if (pathname === ROUTES.GST_REPORT) return canAccessMenuKey(session, "reports");
  if (pathname === ROUTES.MONTHLY_REPORT) return canAccessMenuKey(session, "reports");

  const item = ERP_MENU.find((entry) => entry.path === pathname);
  if (!item) return isAdminSession(session);
  return canAccessMenuKey(session, item.key);
}
