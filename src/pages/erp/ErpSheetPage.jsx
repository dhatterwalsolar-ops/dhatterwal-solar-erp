import { Navigate, useLocation } from "react-router-dom";
import { ErpSheetErrorBoundary } from "../../components/erp/ErpSheetErrorBoundary";
import DataSheet from "../../components/erp/DataSheet/DataSheet";
import CashCaseSheet from "../../components/erp/CashCaseSheet/CashCaseSheet";
import CustomerDetailSheet from "../../components/erp/CustomerDetailSheet/CustomerDetailSheet";
import InvoiceFileSheet from "../../components/erp/InvoiceFileSheet/InvoiceFileSheet";
import LoanCaseSheet from "../../components/erp/LoanCaseSheet/LoanCaseSheet";
import SaleCaseSheet from "../../components/erp/SaleCaseSheet/SaleCaseSheet";
import BomSheet from "../../components/erp/BomSheet/BomSheet";
import UpdateNameLoadSheet from "../../components/erp/UpdateNameLoadSheet/UpdateNameLoadSheet";
import ProductSheet from "../../components/erp/ProductSheet/ProductSheet";
import QuerySheet from "../../components/erp/QuerySheet/QuerySheet";
import StockSheet from "../../components/erp/StockSheet/StockSheet";
import { ERP_MENU, ERP_SHEET_CONFIG } from "../../constants/erpMenu";
import { ROUTES } from "../../constants/routes";
import { getAuthSession } from "../../utils/authSession";
import { canAccessMenuKey } from "../../utils/erpAccess";

function ErpSheetPage() {
  const { pathname } = useLocation();
  const menuItem = ERP_MENU.find((item) => item.path === pathname);

  if (!menuItem) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  const session = getAuthSession();
  if (!canAccessMenuKey(session, menuItem.key)) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  let content;

  if (menuItem.key === "loan") {
    content = <LoanCaseSheet />;
  } else if (menuItem.key === "cash") {
    content = <CashCaseSheet />;
  } else if (menuItem.key === "updateNameLoad") {
    content = <UpdateNameLoadSheet />;
  } else if (menuItem.key === "sale") {
    content = <SaleCaseSheet />;
  } else if (menuItem.key === "invoiceFile") {
    content = <InvoiceFileSheet />;
  } else if (menuItem.key === "gst") {
    content = <Navigate to={ROUTES.REPORTS_GST} replace />;
  } else if (menuItem.key === "monthly") {
    content = <Navigate to={ROUTES.REPORTS} replace />;
  } else if (menuItem.key === "customer") {
    content = <CustomerDetailSheet />;
  } else if (menuItem.key === "product") {
    content = <ProductSheet />;
  } else if (menuItem.key === "bom") {
    content = <BomSheet />;
  } else if (menuItem.key === "stock") {
    content = <StockSheet />;
  } else if (menuItem.key === "query") {
    content = <QuerySheet />;
  } else {
    const config = ERP_SHEET_CONFIG[menuItem.key];
    content = (
      <DataSheet title={config.title} columns={config.columns} rows={config.rows} />
    );
  }

  return <ErpSheetErrorBoundary key={menuItem.key}>{content}</ErpSheetErrorBoundary>;
}

export default ErpSheetPage;
