import { NavLink, Navigate, Outlet } from "react-router-dom";
import { ErpSheetErrorBoundary } from "../ErpSheetErrorBoundary";
import { ROUTES } from "../../../constants/routes";
import { getAuthSession } from "../../../utils/authSession";
import { canAccessMenuKey } from "../../../utils/erpAccess";
import styles from "./BomManagement.module.css";

const SUB_LINKS = [
  { to: ROUTES.BOM_SHEET, label: "BOM Sheet", end: true },
  { to: ROUTES.BOM_MONTHLY_PROFIT, label: "Monthly Profit" },
];

function BomManagementLayout() {
  const session = getAuthSession();
  if (!canAccessMenuKey(session, "bom")) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return (
    <div className={styles.bomWrap}>
      <nav className={styles.subNav} aria-label="BOM sections">
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
      <ErpSheetErrorBoundary key="bom-mgmt">
        <Outlet />
      </ErpSheetErrorBoundary>
    </div>
  );
}

export default BomManagementLayout;
