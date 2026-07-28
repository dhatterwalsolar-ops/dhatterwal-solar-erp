import { Navigate, Route, Routes } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout";
import DashboardLayout from "../layouts/DashboardLayout";
import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import ErpSheetPage from "../pages/erp/ErpSheetPage";
import SettingsPage from "../pages/erp/SettingsPage";
import LabourManagementLayout from "../components/erp/labour/LabourManagementLayout";
import LabourHub from "../components/erp/labour/LabourHub";
import LabourDetailsPage from "../components/erp/labour/LabourDetailsPage";
import DailyLabourWorkPage from "../components/erp/labour/DailyLabourWorkPage";
import PaymentManagementLayout from "../components/erp/payment/PaymentManagementLayout";
import PaymentReceivedPage from "../components/erp/payment/PaymentReceivedPage";
import PaymentGivenPage from "../components/erp/payment/PaymentGivenPage";
import PaymentTotalDashboardPage from "../components/erp/payment/PaymentTotalDashboardPage";
import CreditLimitPage from "../components/erp/payment/CreditLimitPage";
import PurchaseManagementLayout from "../components/erp/PurchaseSheet/PurchaseManagementLayout";
import PurchaseSheet from "../components/erp/PurchaseSheet/PurchaseSheet";
import PurchaseListPage from "../components/erp/PurchaseSheet/PurchaseListPage";
import ReportsLayout from "../components/erp/reports/ReportsLayout";
import ReportsDashboard from "../components/erp/reports/ReportsDashboard";
import MonthlySaleReportPage from "../components/erp/reports/MonthlySaleReportPage";
import MonthlyPurchaseReportPage from "../components/erp/reports/MonthlyPurchaseReportPage";
import MonthlyStockReportPage from "../components/erp/reports/MonthlyStockReportPage";
import MonthlyGstReportPage from "../components/erp/reports/MonthlyGstReportPage";
import HomePage from "../pages/home/HomePage";
import SiteOrderFormPage from "../pages/site/SiteOrderFormPage";
import { ERP_MENU } from "../constants/erpMenu";
import { ROUTES } from "../constants/routes";

function AppRouter() {
  return (
    <Routes>
      <Route path={ROUTES.HOME} element={<HomePage />} />
      <Route path={ROUTES.SITE_ORDER} element={<SiteOrderFormPage />} />
      <Route element={<AuthLayout />}>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      </Route>
      <Route element={<DashboardLayout />}>
        <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
        {ERP_MENU.filter(
          (item) =>
            item.key !== "labour" &&
            item.key !== "reports" &&
            item.key !== "payment" &&
            item.key !== "purchase",
        ).map((item) => (
          <Route key={item.key} path={item.path} element={<ErpSheetPage />} />
        ))}
        <Route path={ROUTES.PAYMENT_SHEET} element={<PaymentManagementLayout />}>
          <Route index element={<Navigate to={ROUTES.PAYMENT_RECEIVED} replace />} />
          <Route path="received" element={<PaymentReceivedPage />} />
          <Route path="given" element={<PaymentGivenPage />} />
          <Route path="credit" element={<CreditLimitPage />} />
          <Route path="dashboard" element={<PaymentTotalDashboardPage />} />
        </Route>
        <Route path={ROUTES.PURCHASE_SHEET} element={<PurchaseManagementLayout />}>
          <Route index element={<Navigate to={ROUTES.PURCHASE_NEW} replace />} />
          <Route path="new" element={<PurchaseSheet />} />
          <Route path="list" element={<PurchaseListPage />} />
        </Route>
        <Route path={ROUTES.LABOUR_SHEET} element={<LabourManagementLayout />}>
          <Route index element={<LabourHub />} />
          <Route path="details" element={<LabourDetailsPage />} />
          <Route path="daily" element={<DailyLabourWorkPage />} />
        </Route>
        <Route path={ROUTES.REPORTS} element={<ReportsLayout />}>
          <Route index element={<ReportsDashboard />} />
          <Route path="sales" element={<MonthlySaleReportPage />} />
          <Route path="purchase" element={<MonthlyPurchaseReportPage />} />
          <Route path="stock" element={<MonthlyStockReportPage />} />
          <Route path="gst" element={<MonthlyGstReportPage />} />
        </Route>
        <Route path={ROUTES.GST_REPORT} element={<Navigate to={ROUTES.REPORTS_GST} replace />} />
        <Route path={ROUTES.MONTHLY_REPORT} element={<Navigate to={ROUTES.REPORTS} replace />} />
        <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
    </Routes>
  );
}

export default AppRouter;
