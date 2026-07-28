import { NavLink, Outlet } from "react-router-dom";
import { ErpSheetErrorBoundary } from "../ErpSheetErrorBoundary";
import { ROUTES } from "../../../constants/routes";
import styles from "./Reports.module.css";

const SUB_LINKS = [
  { to: ROUTES.REPORTS, label: "Reports Dashboard", end: true },
  { to: ROUTES.REPORTS_SALE, label: "Monthly Sale" },
  { to: ROUTES.REPORTS_PURCHASE, label: "Monthly Purchase" },
  { to: ROUTES.REPORTS_STOCK, label: "Monthly Stock" },
  { to: ROUTES.REPORTS_GST, label: "Monthly GST" },
];

function ReportsLayout() {
  return (
    <div className={styles.reportsWrap}>
      <nav className={styles.subNav} aria-label="Reports sections">
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
      <ErpSheetErrorBoundary key="reports">
        <Outlet />
      </ErpSheetErrorBoundary>
    </div>
  );
}

export default ReportsLayout;
