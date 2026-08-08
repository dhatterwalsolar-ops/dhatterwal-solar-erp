import { NavLink, Navigate, Outlet } from "react-router-dom";
import { ErpSheetErrorBoundary } from "../ErpSheetErrorBoundary";
import { ROUTES } from "../../../constants/routes";
import { getAuthSession } from "../../../utils/authSession";
import { canAccessMenuKey } from "../../../utils/erpAccess";
import styles from "./PurchaseManagementLayout.module.css";

const SUB_LINKS = [
  { to: ROUTES.PURCHASE_NEW, label: "New Entry", end: true },
  { to: ROUTES.PURCHASE_LIST, label: "Purchase List", end: true },
  { to: ROUTES.PURCHASE_ACCOUNT_LEDGER, label: "Account Ledger", end: true },
];

function PurchaseManagementLayout() {
  const session = getAuthSession();
  if (!canAccessMenuKey(session, "purchase")) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return (
    <div className={styles.purchaseWrap}>
      <nav className={styles.subNav} aria-label="Purchase sections">
        {SUB_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => (isActive ? styles.active : undefined)}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <ErpSheetErrorBoundary key="purchase-mgmt">
        <Outlet />
      </ErpSheetErrorBoundary>
    </div>
  );
}

export default PurchaseManagementLayout;
