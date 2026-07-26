import { Navigate, Route, Routes } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout";
import DashboardLayout from "../layouts/DashboardLayout";
import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import ErpSheetPage from "../pages/erp/ErpSheetPage";
import SettingsPage from "../pages/erp/SettingsPage";
import HomePage from "../pages/home/HomePage";
import { ERP_MENU } from "../constants/erpMenu";
import { ROUTES } from "../constants/routes";

function AppRouter() {
  return (
    <Routes>
      <Route path={ROUTES.HOME} element={<HomePage />} />
      <Route element={<AuthLayout />}>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      </Route>
      <Route element={<DashboardLayout />}>
        <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
        {ERP_MENU.map((item) => (
          <Route key={item.key} path={item.path} element={<ErpSheetPage />} />
        ))}
        <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
    </Routes>
  );
}

export default AppRouter;
