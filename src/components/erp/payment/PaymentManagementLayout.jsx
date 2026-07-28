import { NavLink, Navigate, Outlet } from "react-router-dom";
import { ErpSheetErrorBoundary } from "../ErpSheetErrorBoundary";
import { ROUTES } from "../../../constants/routes";
import { getAuthSession } from "../../../utils/authSession";
import { canAccessMenuKey } from "../../../utils/erpAccess";
import styles from "./PaymentManagement.module.css";

const SUB_LINKS = [
  { to: ROUTES.PAYMENT_RECEIVED, label: "Payment Received" },
  { to: ROUTES.PAYMENT_GIVEN, label: "Payment Given" },
  { to: ROUTES.PAYMENT_CREDIT, label: "Credit & Limit" },
  { to: ROUTES.PAYMENT_DASHBOARD, label: "Total Payment", end: true },
];

function PaymentManagementLayout() {
  const session = getAuthSession();
  if (!canAccessMenuKey(session, "payment")) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return (
    <div className={styles.paymentWrap}>
      <nav className={styles.subNav} aria-label="Payment sections">
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
      <ErpSheetErrorBoundary key="payment-mgmt">
        <Outlet />
      </ErpSheetErrorBoundary>
    </div>
  );
}

export default PaymentManagementLayout;
