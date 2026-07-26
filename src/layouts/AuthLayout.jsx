import { Outlet } from "react-router-dom";
import styles from "./AuthLayout.module.css";

function AuthLayout() {
  return (
    <div className={styles.shell}>
      <Outlet />
    </div>
  );
}

export default AuthLayout;
