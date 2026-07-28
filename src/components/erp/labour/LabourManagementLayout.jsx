import { Navigate, Outlet } from "react-router-dom";
import { ErpSheetErrorBoundary } from "../ErpSheetErrorBoundary";
import { ROUTES } from "../../../constants/routes";
import { getAuthSession } from "../../../utils/authSession";
import { canAccessMenuKey } from "../../../utils/erpAccess";
import styles from "./LabourManagementLayout.module.css";

function LabourManagementLayout() {
  const session = getAuthSession();
  if (!canAccessMenuKey(session, "labour")) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.subHeader}>
        <p className={styles.subTitle}>LABOUR MANAGEMENT SYSTEM</p>
      </div>
      <ErpSheetErrorBoundary key="labour">
        <Outlet />
      </ErpSheetErrorBoundary>
    </div>
  );
}

export default LabourManagementLayout;
