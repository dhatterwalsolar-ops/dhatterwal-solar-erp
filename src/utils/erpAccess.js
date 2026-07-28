import { AUTH_ROLES } from "../constants/auth";
import { ERP_MENU } from "../constants/erpMenu";
import { ROUTES } from "../constants/routes";

/** Sidebar sheets staff may open (admin gets full ERP_MENU). */
export const STAFF_ALLOWED_MENU_KEYS = new Set([
  "loan",
  "cash",
  "updateNameLoad",
  "sale",
  "labour",
  "invoiceFile",
]);

export function isAdminSession(session) {
  return session?.role === AUTH_ROLES.ADMIN;
}

export function canAccessMenuKey(session, menuKey) {
  if (isAdminSession(session)) return true;
  if (session?.role === AUTH_ROLES.STAFF) {
    return STAFF_ALLOWED_MENU_KEYS.has(menuKey);
  }
  return false;
}

export function getErpMenuForSession(session) {
  if (isAdminSession(session)) return ERP_MENU;
  if (session?.role === AUTH_ROLES.STAFF) {
    return ERP_MENU.filter((item) => STAFF_ALLOWED_MENU_KEYS.has(item.key));
  }
  return [];
}

export function canAccessPath(session, pathname) {
  if (!session?.role) return false;
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
