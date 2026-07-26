import { Navigate, useLocation } from "react-router-dom";
import { ErpSheetErrorBoundary } from "../../components/erp/ErpSheetErrorBoundary";
import DataSheet from "../../components/erp/DataSheet/DataSheet";
import CashCaseSheet from "../../components/erp/CashCaseSheet/CashCaseSheet";
import CustomerDetailSheet from "../../components/erp/CustomerDetailSheet/CustomerDetailSheet";
import GstReportSheet from "../../components/erp/GstReportSheet/GstReportSheet";
import LabourSheet from "../../components/erp/LabourSheet/LabourSheet";
import LoanCaseSheet from "../../components/erp/LoanCaseSheet/LoanCaseSheet";
import SaleCaseSheet from "../../components/erp/SaleCaseSheet/SaleCaseSheet";
import { ERP_MENU, ERP_SHEET_CONFIG } from "../../constants/erpMenu";
import { ROUTES } from "../../constants/routes";

function ErpSheetPage() {
  const { pathname } = useLocation();
  const menuItem = ERP_MENU.find((item) => item.path === pathname);

  if (!menuItem) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  let content;

  if (menuItem.key === "loan") {
    content = <LoanCaseSheet />;
  } else if (menuItem.key === "cash") {
    content = <CashCaseSheet />;
  } else if (menuItem.key === "sale") {
    content = <SaleCaseSheet />;
  } else if (menuItem.key === "gst") {
    content = <GstReportSheet />;
  } else if (menuItem.key === "customer") {
    content = <CustomerDetailSheet />;
  } else if (menuItem.key === "labour") {
    content = <LabourSheet />;
  } else {
    const config = ERP_SHEET_CONFIG[menuItem.key];
    content = (
      <DataSheet title={config.title} columns={config.columns} rows={config.rows} />
    );
  }

  return <ErpSheetErrorBoundary key={menuItem.key}>{content}</ErpSheetErrorBoundary>;
}

export default ErpSheetPage;
