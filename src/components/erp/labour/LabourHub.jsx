import { Link } from "react-router-dom";
import { ROUTES } from "../../../constants/routes";
import styles from "./LabourHub.module.css";

function LabourHub() {
  return (
    <div className={styles.hub}>
      <h1 className={styles.mainTitle}>Labour Management</h1>
      <div className={styles.cards}>
        <article className={styles.card}>
          <div className={styles.cardIconBlue} aria-hidden="true">
            👥
          </div>
          <h2>1. LABOUR DETAILS</h2>
          <p>
            Add / Manage Labour, Salary, Advance, Payments and all Labour Information
          </p>
          <Link to={ROUTES.LABOUR_DETAILS} className={styles.btnBlue}>
            OPEN LABOUR DETAILS
          </Link>
        </article>

        <article className={styles.card}>
          <div className={styles.cardIconGreen} aria-hidden="true">
            📋
          </div>
          <h2>2. DAILY LABOUR WORK</h2>
          <p>
            Daily Work Entry by Team Leader, Attendance, Site Work and Material Usage Entry
          </p>
          <Link to={ROUTES.LABOUR_DAILY} className={styles.btnGreen}>
            OPEN DAILY LABOUR WORK
          </Link>
        </article>
      </div>
    </div>
  );
}

export default LabourHub;
